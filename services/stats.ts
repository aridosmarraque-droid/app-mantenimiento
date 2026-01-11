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
    machineId: string;
    machineName: string;
    period: string;
    totalLiters: number;
    consumedLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
}

export interface FluidTrend {
    fluidType: 'MOTOR' | 'HYDRAULIC' | 'COOLANT';
    baselineRate: number; 
    recentRate: number;    
    deviation: number;     
    workedHoursRecent: number;
    logsCount: number;
    series: any[];
}

export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

// Obtener el lunes de la semana en formato YYYY-MM-DD sin desfases de zona horaria
const getMondayISO = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0=Dom, 1=Lun...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
};

const getPlannedHoursForDate = (date: Date, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 8; // Fallback razonable si no hay plan
    
    // Usamos el día local para que coincida con lo que el usuario ve en el calendario
    const dayOfWeek = date.getDay(); 
    
    switch (dayOfWeek) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; // Fines de semana no suelen planificarse
    }
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    today.setHours(12, 0, 0, 0); // Evitar cambios de día por zona horaria

    const daily = await calculateStats(today, today, "Día", today);

    // Comparativas
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const endOfPrevWeek = new Date(startOfPrevWeek);
    endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);

    const weekly = await compareStats(
        await calculateStats(startOfWeek, endOfWeek, "Esta Semana", today),
        await calculateStats(startOfPrevWeek, endOfPrevWeek, "Semana Anterior", endOfPrevWeek)
    );

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthly = await compareStats(
        await calculateStats(thisMonthStart, thisMonthEnd, "Mes Actual", today),
        await calculateStats(lastMonthStart, lastMonthEnd, "Mes Anterior", lastMonthEnd)
    );

    const yearly = await compareStats(
        await calculateStats(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31), "Año Actual", today),
        await calculateStats(new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31), "Año Anterior", new Date(today.getFullYear() - 1, 11, 31))
    );

    return { daily, weekly, monthly, yearly };
};

const calculateStats = async (start: Date, end: Date, label: string, limitDate: Date): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    const cutoffStr = limitDate.toISOString().split('T')[0];
    
    const filtered = reports.filter(r => {
        const rDate = new Date(r.date).toISOString().split('T')[0];
        return rDate <= cutoffStr;
    });
    
    let totalActual = 0;
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();

    for (const report of filtered) {
        const reportDate = new Date(report.date);
        const mondayStr = getMondayISO(reportDate);
        
        if (!planCache.has(mondayStr)) {
            const plan = await getCPWeeklyPlan(mondayStr);
            planCache.set(mondayStr, plan);
        }

        const plan = planCache.get(mondayStr) || null;
        const plannedHours = getPlannedHoursForDate(reportDate, plan);
        
        totalActual += (report.millsEnd - report.millsStart);
        totalPlanned += plannedHours;
    }

    return {
        period: label,
        dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        totalActualHours: parseFloat(totalActual.toFixed(2)),
        totalPlannedHours: parseFloat(totalPlanned.toFixed(2)),
        efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0,
        reports: filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
};

const compareStats = (current: ProductionStat, previous: ProductionStat): ProductionComparison => {
    const diff = current.efficiency - previous.efficiency;
    return {
        current,
        previous,
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal',
        diff: parseFloat(diff.toFixed(1))
    };
};

// --- MANTENIMIENTO Y FLUIDOS (Se mantienen igual) ---

const getRateFromLogs = (logs: OperationLog[], type: 'MOTOR' | 'HYDRAULIC' | 'COOLANT'): number => {
    if (logs.length < 2) return 0;
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const hours = last.hoursAtExecution - first.hoursAtExecution;
    if (hours <= 0) return 0;

    const totalLiters = sorted.reduce((acc, l) => {
        if (type === 'MOTOR') return acc + (l.motorOil || 0);
        if (type === 'HYDRAULIC') return acc + (l.hydraulicOil || 0);
        if (type === 'COOLANT') return acc + (l.coolant || 0);
        return acc;
    }, 0);

    let lastAdded = 0;
    if (type === 'MOTOR') lastAdded = last.motorOil || 0;
    if (type === 'HYDRAULIC') lastAdded = last.hydraulicOil || 0;
    if (type === 'COOLANT') lastAdded = last.coolant || 0;

    return ((totalLiters - lastAdded) / hours) * 100;
};

export const analyzeFluidTrend = (allLogs: OperationLog[], type: 'MOTOR' | 'HYDRAULIC' | 'COOLANT'): FluidTrend => {
    const fluidLogs = allLogs.filter(l => {
        if (type === 'MOTOR') return (l.motorOil ?? 0) > 0;
        if (type === 'HYDRAULIC') return (l.hydraulicOil ?? 0) > 0;
        if (type === 'COOLANT') return (l.coolant ?? 0) > 0;
        return false;
    }).sort((a, b) => a.date.getTime() - b.date.getTime());

    const series = fluidLogs.map(l => ({
        date: new Date(l.date).toLocaleDateString('es-ES'),
        hours: l.hoursAtExecution,
        added: (type === 'MOTOR' ? l.motorOil : type === 'HYDRAULIC' ? l.hydraulicOil : l.coolant) || 0
    }));

    if (fluidLogs.length < 3) {
        return { fluidType: type, baselineRate: 0, recentRate: 0, deviation: 0, workedHoursRecent: 0, logsCount: fluidLogs.length, series };
    }

    const recentLogs = fluidLogs.slice(-4);
    const recentRate = getRateFromLogs(recentLogs, type);
    const baselineLogs = fluidLogs.length > 5 ? fluidLogs.slice(0, -3) : fluidLogs;
    const baselineRate = getRateFromLogs(baselineLogs, type);
    const deviation = baselineRate > 0 ? ((recentRate - baselineRate) / baselineRate) * 100 : 0;

    return {
        fluidType: type,
        baselineRate: parseFloat(baselineRate.toFixed(3)),
        recentRate: parseFloat(recentRate.toFixed(3)),
        deviation: parseFloat(deviation.toFixed(1)),
        workedHoursRecent: recentLogs[recentLogs.length-1].hoursAtExecution - recentLogs[0].hoursAtExecution,
        logsCount: fluidLogs.length,
        series
    };
};

export const getMachineFuelStats = async (machineId: string, baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    const yearStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const yearLogs = await getFuelLogs(machineId, yearStart, today);
    return {
        monthly: calculateFuelConsumptionFromLogs(yearLogs.slice(-5), "Mes Actual"),
        quarterly: calculateFuelConsumptionFromLogs(yearLogs.slice(-15), "Último Trimestre"),
        yearly: calculateFuelConsumptionFromLogs(yearLogs, "Último Año"),
        logs: yearLogs.slice().reverse()
    };
};

export const calculateFuelConsumptionFromLogs = (logs: OperationLog[], periodLabel: string = "Periodo"): FuelConsumptionStat => {
    if (logs.length < 2) return { machineId: '', machineName: '', period: periodLabel, totalLiters: 0, consumedLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const workedHours = sorted[sorted.length-1].hoursAtExecution - sorted[0].hoursAtExecution;
    const consumedLiters = sorted.reduce((acc, l) => acc + (l.fuelLitres || 0), 0) - (sorted[sorted.length-1].fuelLitres || 0);
    return {
        machineId: sorted[0].machineId, machineName: '', period: periodLabel, totalLiters: consumedLiters,
        consumedLiters, workedHours, consumptionPerHour: workedHours > 0 ? consumedLiters / workedHours : 0, logsCount: sorted.length
    };
};

export const getMachineFluidStats = async (machineId: string, baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    const yearStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const allLogs = await getMachineLogs(machineId, yearStart, today, ['LEVELS']);
    return {
        motor: analyzeFluidTrend(allLogs, 'MOTOR'),
        hydraulic: analyzeFluidTrend(allLogs, 'HYDRAULIC'),
        coolant: analyzeFluidTrend(allLogs, 'COOLANT'),
        history: allLogs.slice().reverse()
    };
};
