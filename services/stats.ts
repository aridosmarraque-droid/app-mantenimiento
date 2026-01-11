import { getCPReportsByRange, getCPWeeklyPlan, getFuelLogs, getMachineLogs } from './db';
import { CPDailyReport, CPWeeklyPlan, OperationLog } from '../types';

export interface ProductionStat {
    period: string;
    dateLabel: string;
    totalActualHours: number;
    totalPlannedHours: number;
    efficiency: number;
    reports: CPDailyReport[];
}

export interface ProductionComparison {
    current: ProductionStat;
    previous: ProductionStat;
    trend: 'up' | 'down' | 'equal';
    diff: number;
}

export interface FuelConsumptionStat {
    period: string;
    totalLiters: number;
    consumedLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
}

export interface FluidDataPoint {
    date: string;
    rate: number; // L/100h en ese intervalo
    added: number;
    hours: number;
}

export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

const getMondayISOString = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

const getPlannedHoursForDay = (dateInput: Date | string, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 9;
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0);
    const dayOfWeek = d.getDay(); 
    switch (dayOfWeek) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; 
    }
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    today.setHours(12, 0, 0, 0);
    const daily = await calculateStats(today, today, "Día", today);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekly = await compareStats(
        await calculateStats(startOfWeek, endOfWeek, "Esta Semana", today),
        await calculateStats(startOfWeek, endOfWeek, "Semana Anterior", today) // Simplificado
    );
    return { daily, weekly, monthly: weekly, yearly: weekly }; // Simplificado para enfoque técnico
};

const calculateStats = async (start: Date, end: Date, label: string, limitDate: Date): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    let totalActual = 0;
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();
    for (const report of reports) {
        const reportDate = new Date(report.date);
        const mondayStr = getMondayISOString(reportDate);
        if (!planCache.has(mondayStr)) {
            const plan = await getCPWeeklyPlan(mondayStr);
            planCache.set(mondayStr, plan);
        }
        const plan = planCache.get(mondayStr) || null;
        totalActual += (report.millsEnd - report.millsStart);
        totalPlanned += getPlannedHoursForDay(reportDate, plan);
    }
    return {
        period: label,
        dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        totalActualHours: Number(totalActual.toFixed(2)),
        totalPlannedHours: Number(totalPlanned.toFixed(2)),
        efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
        reports: reports.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
};

const compareStats = (current: ProductionStat, previous: ProductionStat): ProductionComparison => {
    const diff = current.efficiency - previous.efficiency;
    return { current, previous, trend: diff >= 0 ? 'up' : 'down', diff: Number(diff.toFixed(1)) };
};

export const analyzeFluidTrend = (allLogs: OperationLog[], type: 'MOTOR' | 'HYDRAULIC' | 'COOLANT'): any => {
    const fluidLogs = allLogs.filter(l => {
        if (type === 'MOTOR') return (l.motorOil ?? 0) > 0;
        if (type === 'HYDRAULIC') return (l.hydraulicOil ?? 0) > 0;
        if (type === 'COOLANT') return (l.coolant ?? 0) > 0;
        return false;
    }).sort((a, b) => a.date.getTime() - b.date.getTime());

    const series: FluidDataPoint[] = [];
    for (let i = 1; i < fluidLogs.length; i++) {
        const prev = fluidLogs[i - 1];
        const curr = fluidLogs[i];
        const hDiff = curr.hoursAtExecution - prev.hoursAtExecution;
        const added = (type === 'MOTOR' ? curr.motorOil : type === 'HYDRAULIC' ? curr.hydraulicOil : curr.coolant) || 0;
        
        if (hDiff > 0) {
            series.push({
                date: new Date(curr.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
                rate: (added / hDiff) * 100,
                added,
                hours: curr.hoursAtExecution
            });
        }
    }

    const recentRate = series.length > 0 ? series[series.length - 1].rate : 0;
    const baselineRate = series.length > 3 ? series.slice(0, -2).reduce((acc, p) => acc + p.rate, 0) / (series.length - 2) : recentRate;
    const deviation = baselineRate > 0 ? ((recentRate - baselineRate) / baselineRate) * 100 : 0;

    return {
        fluidType: type,
        baselineRate: Number(baselineRate.toFixed(3)),
        recentRate: Number(recentRate.toFixed(3)),
        deviation: Number(deviation.toFixed(1)),
        logsCount: fluidLogs.length,
        series: series.slice(-6) // Últimos 6 puntos para la gráfica
    };
};

export const getMachineFuelStats = async (machineId: string, baseDate: Date = new Date()) => {
    const yearLogs = await getFuelLogs(machineId, new Date(baseDate.getFullYear() - 1, 0, 1), baseDate);
    return {
        monthly: calculateFuelConsumptionFromLogs(yearLogs.slice(-5), "Mes Actual"),
        quarterly: calculateFuelConsumptionFromLogs(yearLogs.slice(-15), "Trimestre"),
        yearly: calculateFuelConsumptionFromLogs(yearLogs, "Año"),
        logs: yearLogs.slice().reverse()
    };
};

export const calculateFuelConsumptionFromLogs = (logs: OperationLog[], periodLabel: string = "Periodo"): FuelConsumptionStat => {
    if (logs.length < 2) return { period: periodLabel, totalLiters: 0, consumedLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const workedHours = sorted[sorted.length-1].hoursAtExecution - sorted[0].hoursAtExecution;
    const consumedLiters = sorted.reduce((acc, l) => acc + (l.fuelLitres || 0), 0) - (sorted[sorted.length-1].fuelLitres || 0);
    return { period: periodLabel, totalLiters: consumedLiters, consumedLiters, workedHours, consumptionPerHour: workedHours > 0 ? consumedLiters / workedHours : 0, logsCount: sorted.length };
};

export const getMachineFluidStats = async (machineId: string, baseDate: Date = new Date()) => {
    const allLogs = await getMachineLogs(machineId, undefined, baseDate, ['LEVELS']);
    return {
        motor: analyzeFluidTrend(allLogs, 'MOTOR'),
        hydraulic: analyzeFluidTrend(allLogs, 'HYDRAULIC'),
        coolant: analyzeFluidTrend(allLogs, 'COOLANT'),
        history: allLogs.slice().reverse()
    };
};
