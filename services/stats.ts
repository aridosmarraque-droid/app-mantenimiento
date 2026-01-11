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

const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return monday;
};

const getPlannedHoursForDate = (date: Date, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 8; // Fallback a 8 si no hay plan configurado
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    
    switch (dayOfWeek) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; // Sábados y Domingos no suelen tener planificación estándar
    }
};

// --- CÁLCULO DE EFICIENCIA DE PRODUCCIÓN ---

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    today.setHours(0,0,0,0);

    // 1. DÍA SELECCIONADO
    const daily = await calculateStats(today, today, "Día", today);

    // 2. SEMANA ACTUAL VS ANTERIOR
    const thisMon = getMonday(today);
    const lastMon = new Date(thisMon);
    lastMon.setDate(lastMon.getDate() - 7);
    const thisSun = new Date(thisMon);
    thisSun.setDate(thisSun.getDate() + 6);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastSun.getDate() + 6);

    const weekly = await compareStats(
        await calculateStats(thisMon, thisSun, "Esta Semana", today),
        await calculateStats(lastMon, lastSun, "Semana Anterior", lastSun)
    );

    // 3. MES ACTUAL VS ANTERIOR
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthly = await compareStats(
        await calculateStats(thisMonthStart, thisMonthEnd, "Mes Actual", today),
        await calculateStats(lastMonthStart, lastMonthEnd, "Mes Anterior", lastMonthEnd)
    );

    // 4. AÑO ACTUAL VS ANTERIOR
    const thisYearStart = new Date(today.getFullYear(), 0, 1);
    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const thisYearEnd = new Date(today.getFullYear(), 11, 31);
    const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);

    const yearly = await compareStats(
        await calculateStats(thisYearStart, thisYearEnd, "Año Actual", today),
        await calculateStats(lastYearStart, lastYearEnd, "Año Anterior", lastYearEnd)
    );

    return { daily, weekly, monthly, yearly };
};

const calculateStats = async (start: Date, end: Date, label: string, limitDate: Date): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    const cutoff = new Date(limitDate);
    cutoff.setHours(23, 59, 59, 999);
    
    const filtered = reports.filter(r => new Date(r.date) <= cutoff);
    
    let totalActual = 0;
    let totalPlanned = 0;

    // Cache de planes semanales para evitar múltiples llamadas en rangos largos (Mes/Año)
    const planCache = new Map<string, CPWeeklyPlan | null>();

    for (const report of filtered) {
        const reportDate = new Date(report.date);
        const mon = getMonday(reportDate).toISOString().split('T')[0];
        
        if (!planCache.has(mon)) {
            const plan = await getCPWeeklyPlan(mon);
            planCache.set(mon, plan);
        }

        const plan = planCache.get(mon)!;
        const plannedForDay = getPlannedHoursForDate(reportDate, plan);
        
        totalActual += (report.millsEnd - report.millsStart);
        totalPlanned += plannedForDay;
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

// --- MANTENIMIENTO Y FLUIDOS ---

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

    return ((totalLiters - lastAdded) / hours) * 100; // Normalizado a L / 100h
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
