
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

export interface CombinedFluidEvolution {
    date: string;
    hours: number;
    motorRate: number | null;
    hydRate: number | null;
    coolRate: number | null;
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
        await calculateStats(startOfWeek, endOfWeek, "Semana Anterior", today)
    );
    return { daily, weekly, monthly: weekly, yearly: weekly };
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
        const val = type === 'MOTOR' ? l.motorOil : type === 'HYDRAULIC' ? l.hydraulicOil : l.coolant;
        return (val ?? 0) > 0;
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
    const baselineRate = series.length > 3 ? series.slice(0, -2).reduce((acc, p) => acc + p.rate, 0) / (series.length - 2) : (series.length > 0 ? series[0].rate : 0);
    const deviation = baselineRate > 0 ? ((recentRate - baselineRate) / baselineRate) * 100 : 0;

    return {
        fluidType: type,
        baselineRate: Number(baselineRate.toFixed(3)),
        recentRate: Number(recentRate.toFixed(3)),
        deviation: Number(deviation.toFixed(1)),
        logsCount: fluidLogs.length,
        series: series.slice(-15) // Aumentado para tener más contexto
    };
};

export const getCombinedFluidEvolution = (allLogs: OperationLog[]): CombinedFluidEvolution[] => {
    // Fix: Access date.getTime() on 'b' instead of 'b.getTime()' which was causing a property not found error.
    const sortedLogs = [...allLogs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const evolution: CombinedFluidEvolution[] = [];
    
    let lastMotor: OperationLog | null = null;
    let lastHyd: OperationLog | null = null;
    let lastCool: OperationLog | null = null;

    for (const log of sortedLogs) {
        let mRate = null, hRate = null, cRate = null;

        if ((log.motorOil ?? 0) > 0) {
            if (lastMotor) {
                const hDiff = log.hoursAtExecution - lastMotor.hoursAtExecution;
                if (hDiff > 0) mRate = (log.motorOil! / hDiff) * 100;
            }
            lastMotor = log;
        }

        if ((log.hydraulicOil ?? 0) > 0) {
            if (lastHyd) {
                const hDiff = log.hoursAtExecution - lastHyd.hoursAtExecution;
                if (hDiff > 0) hRate = (log.hydraulicOil! / hDiff) * 100;
            }
            lastHyd = log;
        }

        if ((log.coolant ?? 0) > 0) {
            if (lastCool) {
                const hDiff = log.hoursAtExecution - lastCool.hoursAtExecution;
                if (hDiff > 0) cRate = (log.coolant! / hDiff) * 100;
            }
            lastCool = log;
        }

        if (mRate !== null || hRate !== null || cRate !== null) {
            evolution.push({
                date: new Date(log.date).toLocaleDateString('es-ES'),
                hours: log.hoursAtExecution,
                motorRate: mRate,
                hydRate: hRate,
                coolRate: cRate
            });
        }
    }

    return evolution.reverse();
};

export const getMachineFuelStats = async (machineId: string, baseDate: Date = new Date()) => {
    const yearLogs = await getFuelLogs(machineId, new Date(baseDate.getFullYear() - 1, baseDate.getMonth(), baseDate.getDate()), baseDate);
    const monthly = calculateFuelConsumptionFromLogs(yearLogs.filter(l => l.date >= new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)), "Mes Actual");
    const yearly = calculateFuelConsumptionFromLogs(yearLogs, "Media Año");
    
    // Calcular desviación combustible
    const fuelDeviation = yearly.consumptionPerHour > 0 
        ? ((monthly.consumptionPerHour - yearly.consumptionPerHour) / yearly.consumptionPerHour) * 100 
        : 0;

    return {
        monthly,
        quarterly: calculateFuelConsumptionFromLogs(yearLogs.slice(-15), "Trimestre"),
        yearly,
        fuelDeviation,
        logs: yearLogs.slice().reverse()
    };
};

export const calculateFuelConsumptionFromLogs = (logs: OperationLog[], periodLabel: string = "Periodo"): FuelConsumptionStat => {
    if (logs.length < 2) return { period: periodLabel, totalLiters: 0, consumedLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const workedHours = sorted[sorted.length-1].hoursAtExecution - sorted[0].hoursAtExecution;
    const consumedLiters = sorted.reduce((acc, l) => acc + (l.fuelLitres || 0), 0) - (sorted[0].fuelLitres || 0);
    return { period: periodLabel, totalLiters: consumedLiters, consumedLiters, workedHours, consumptionPerHour: workedHours > 0 ? consumedLiters / workedHours : 0, logsCount: sorted.length };
};

export const getMachineFluidStats = async (machineId: string, baseDate: Date = new Date()) => {
    // Para fluidos pedimos histórico de 6 meses (aprox 180 días)
    const startDate = new Date(baseDate);
    startDate.setMonth(startDate.getMonth() - 6);
    
    const allLogs = await getMachineLogs(machineId, startDate, baseDate, ['LEVELS']);
    return {
        motor: analyzeFluidTrend(allLogs, 'MOTOR'),
        hydraulic: analyzeFluidTrend(allLogs, 'HYDRAULIC'),
        coolant: analyzeFluidTrend(allLogs, 'COOLANT'),
        evolution: getCombinedFluidEvolution(allLogs),
        history: allLogs.slice().reverse()
    };
};
