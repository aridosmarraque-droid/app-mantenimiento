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
    baselineRate: number; // Media histórica larga
    recentRate: number;    // Media últimos registros o periodo actual
    deviation: number;     // % de cambio
    workedHoursRecent: number;
    logsCount: number;
}

const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return monday;
};

const toLocalISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getHoursFromPlan = (plan: CPWeeklyPlan | null, date: Date): number => {
    if (!plan) return 8;
    const day = date.getDay();
    switch (day) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0;
    }
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()) => {
    const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const daily = await calculateStats(today, today, "Día Seleccionado", today, 'day');
    const startWeek = getMonday(today);
    const endWeek = new Date(startWeek);
    endWeek.setDate(endWeek.getDate() + 6); 
    const startLastWeek = new Date(startWeek);
    startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(endWeek);
    endLastWeek.setDate(endLastWeek.getDate() - 7);
    const lastWeekLimit = new Date(today);
    lastWeekLimit.setDate(lastWeekLimit.getDate() - 7);

    const weeklyCurr = await calculateStats(startWeek, endWeek, "Semana Seleccionada", today, 'day');
    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior", lastWeekLimit, 'day');
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthLimit = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), endLastMonth.getDate()));

    const monthlyCurr = await calculateStats(startMonth, endMonth, "Mes Seleccionado", today, 'month');
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior", lastWeekLimit, 'month');
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    const startLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearLimit = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    const yearlyCurr = await calculateStats(startYear, endYear, "Año Seleccionado", today, 'year');
    const yearlyPrev = await calculateStats(startLastYear, new Date(today.getFullYear()-1, 11, 31), "Año Anterior", lastYearLimit, 'year');

    const compare = (curr: ProductionStat, prev: ProductionStat): ProductionComparison => ({
        current: curr,
        previous: prev,
        trend: curr.efficiency > prev.efficiency ? 'up' : curr.efficiency < prev.efficiency ? 'down' : 'equal',
        diff: parseFloat((curr.efficiency - prev.efficiency).toFixed(1))
    });

    return { daily, weekly: compare(weeklyCurr, weeklyPrev), monthly: compare(monthlyCurr, monthlyPrev), yearly: compare(yearlyCurr, yearlyPrev) };
};

const calculateStats = async (start: Date, end: Date, label: string, limitDate: Date, dateFormat: 'day' | 'month' | 'year' = 'day'): Promise<ProductionStat> => {
    const allReportsInRange = await getCPReportsByRange(start, end);
    const cutoff = new Date(limitDate);
    cutoff.setHours(23, 59, 59, 999);

    const filteredReports = allReportsInRange.filter(r => {
        const reportDate = new Date(r.date);
        return reportDate <= cutoff;
    });
    
    const totalActual = filteredReports.reduce((acc, r) => acc + (r.millsEnd - r.millsStart), 0);

    let totalPlanned = 0;
    const loopCurrent = new Date(start);
    loopCurrent.setHours(0,0,0,0);
    
    const planCache: Record<string, CPWeeklyPlan | null> = {};

    while (loopCurrent <= new Date(end)) {
        if (loopCurrent > cutoff) break;
        const mondayStr = toLocalISO(getMonday(loopCurrent));
        if (planCache[mondayStr] === undefined) {
            planCache[mondayStr] = await getCPWeeklyPlan(mondayStr);
        }
        totalPlanned += getHoursFromPlan(planCache[mondayStr], loopCurrent);
        loopCurrent.setDate(loopCurrent.getDate() + 1);
    }

    let dateLabel = "";
    if (dateFormat === 'day') dateLabel = start.toLocaleDateString('es-ES'); 
    else if (dateFormat === 'month') {
        dateLabel = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    } else if (dateFormat === 'year') dateLabel = start.getFullYear().toString();

    const efficiency = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    return {
        period: label,
        dateLabel,
        totalActualHours: parseFloat(totalActual.toFixed(2)),
        totalPlannedHours: parseFloat(totalPlanned.toFixed(2)),
        efficiency,
        reports: filteredReports
    };
};

export const calculateFuelConsumptionFromLogs = (logs: OperationLog[], periodLabel: string = "Periodo"): FuelConsumptionStat => {
    if (logs.length < 2) {
        return {
            machineId: '', machineName: '', period: periodLabel, totalLiters: logs.reduce((acc, l) => acc + (l.fuelLitres || 0), 0),
            consumedLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length
        };
    }
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstLog = sorted[0];
    const lastLog = sorted[sorted.length - 1];
    const workedHours = lastLog.hoursAtExecution - firstLog.hoursAtExecution;
    const totalLiters = sorted.reduce((acc, l) => acc + (l.fuelLitres || 0), 0);
    const consumedLiters = totalLiters - (lastLog.fuelLitres || 0);
    const consumptionPerHour = workedHours > 0 ? (consumedLiters / workedHours) : 0;

    return {
        machineId: firstLog.machineId, machineName: '', period: periodLabel, totalLiters,
        consumedLiters, workedHours, consumptionPerHour: parseFloat(consumptionPerHour.toFixed(2)), logsCount: sorted.length
    };
};

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

    return ((totalLiters - lastAdded) / hours) * 100; // L / 100h
};

export const analyzeFluidTrend = (allLogs: OperationLog[], type: 'MOTOR' | 'HYDRAULIC' | 'COOLANT'): FluidTrend => {
    const fluidLogs = allLogs.filter(l => {
        if (type === 'MOTOR') return (l.motorOil ?? 0) > 0;
        if (type === 'HYDRAULIC') return (l.hydraulicOil ?? 0) > 0;
        if (type === 'COOLANT') return (l.coolant ?? 0) > 0;
        return false;
    }).sort((a, b) => a.date.getTime() - b.date.getTime());

    if (fluidLogs.length < 3) {
        return { fluidType: type, baselineRate: 0, recentRate: 0, deviation: 0, workedHoursRecent: 0, logsCount: fluidLogs.length };
    }

    // Tendencia Reciente: Últimos 4 registros
    const recentLogs = fluidLogs.slice(-4);
    const recentRate = getRateFromLogs(recentLogs, type);
    
    // Línea de Base: Todo lo anterior (excluyendo el último periodo si es posible, o todo el histórico)
    const baselineLogs = fluidLogs.length > 5 ? fluidLogs.slice(0, -3) : fluidLogs;
    const baselineRate = getRateFromLogs(baselineLogs, type);

    const deviation = baselineRate > 0 ? ((recentRate - baselineRate) / baselineRate) * 100 : 0;
    
    const lastRecent = recentLogs[recentLogs.length - 1];
    const firstRecent = recentLogs[0];

    return {
        fluidType: type,
        baselineRate: parseFloat(baselineRate.toFixed(3)),
        recentRate: parseFloat(recentRate.toFixed(3)),
        deviation: parseFloat(deviation.toFixed(1)),
        workedHoursRecent: lastRecent.hoursAtExecution - firstRecent.hoursAtExecution,
        logsCount: fluidLogs.length
    };
};

export const getMachineFuelStats = async (machineId: string, baseDate: Date = new Date()) => {
    const today = new Date(baseDate);
    const yearStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const yearLogs = await getFuelLogs(machineId, yearStart, today);
    const quarterStart = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    const quarterLogs = yearLogs.filter(l => new Date(l.date) >= quarterStart);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthLogs = quarterLogs.filter(l => new Date(l.date) >= monthStart);

    return {
        monthly: calculateFuelConsumptionFromLogs(monthLogs, "Mes Actual"),
        quarterly: calculateFuelConsumptionFromLogs(quarterLogs, "Último Trimestre"),
        yearly: calculateFuelConsumptionFromLogs(yearLogs, "Último Año"),
        logs: yearLogs.slice().reverse()
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
