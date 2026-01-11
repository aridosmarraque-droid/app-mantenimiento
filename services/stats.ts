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

// Fix: Export FuelConsumptionStat interface for use in reports
export interface FuelConsumptionStat {
    period: string;
    totalLiters: number;
    consumedLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
}

// Helper para formatear números de forma consistente
export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

// Obtiene el Lunes de la semana de una fecha en formato YYYY-MM-DD para evitar TZ shifts
const getMondayISOString = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    // Forzamos mediodía para evitar que desfases de 1-3 horas cambien el día
    d.setHours(12, 0, 0, 0);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
};

/**
 * Obtiene las horas planificadas para un día concreto de la semana.
 * Si no hay plan, devuelve 9 (valor estándar solicitado).
 */
const getPlannedHoursForDay = (dateInput: Date | string, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 9; // Fallback a 9h (Corregido de 8h que causaba el 112%)
    
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0);
    const dayOfWeek = d.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
    
    switch (dayOfWeek) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; // Sábados y Domingos 0h por defecto si no están en plan
    }
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()) => {
    // Estabilizamos la fecha base para evitar cambios de día accidentales
    const today = new Date(baseDate);
    today.setHours(12, 0, 0, 0);

    // 1. DÍA SELECCIONADO
    const daily = await calculateStats(today, today, "Día", today);

    // 2. SEMANA ACTUAL
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

    // 3. MES ACTUAL
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthly = await compareStats(
        await calculateStats(thisMonthStart, thisMonthEnd, "Mes Actual", today),
        await calculateStats(lastMonthStart, lastMonthEnd, "Mes Anterior", lastMonthEnd)
    );

    // 4. AÑO ACUMULADO
    const yearly = await compareStats(
        await calculateStats(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31), "Año Actual", today),
        await calculateStats(new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31), "Año Anterior", new Date(today.getFullYear() - 1, 11, 31))
    );

    return { daily, weekly, monthly, yearly };
};

const calculateStats = async (start: Date, end: Date, label: string, limitDate: Date): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    const limitISO = limitDate.toISOString().split('T')[0];
    
    // Filtrar reportes que no superen la fecha límite (para comparativas pasadas)
    const filtered = reports.filter(r => {
        const rDate = new Date(r.date).toISOString().split('T')[0];
        return rDate <= limitISO;
    });
    
    let totalActual = 0;
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();

    for (const report of filtered) {
        const reportDate = new Date(report.date);
        const mondayStr = getMondayISOString(reportDate);
        
        // Obtener el plan de esa semana si no está en cache
        if (!planCache.has(mondayStr)) {
            const plan = await getCPWeeklyPlan(mondayStr);
            planCache.set(mondayStr, plan);
        }

        const plan = planCache.get(mondayStr) || null;
        const dailyPlanned = getPlannedHoursForDay(reportDate, plan);
        
        // Producción real: Fin - Inicio (Molinos)
        const actual = (report.millsEnd - report.millsStart);
        
        totalActual += actual;
        totalPlanned += dailyPlanned;

        console.log(`[STATS DEBUG] Date: ${report.date} | Actual: ${actual}h | Planned: ${dailyPlanned}h | PlanFound: ${!!plan}`);
    }

    return {
        period: label,
        dateLabel: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        totalActualHours: Number(totalActual.toFixed(2)),
        totalPlannedHours: Number(totalPlanned.toFixed(2)),
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
        diff: Number(diff.toFixed(1))
    };
};

// --- SERVICIOS DE MANTENIMIENTO Y FLUIDOS ---

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

export const analyzeFluidTrend = (allLogs: OperationLog[], type: 'MOTOR' | 'HYDRAULIC' | 'COOLANT'): any => {
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
        return { fluidType: type, baselineRate: 0, recentRate: 0, deviation: 0, logsCount: fluidLogs.length, series };
    }

    const recentLogs = fluidLogs.slice(-4);
    const recentRate = getRateFromLogs(recentLogs, type);
    const baselineLogs = fluidLogs.length > 5 ? fluidLogs.slice(0, -3) : fluidLogs;
    const baselineRate = getRateFromLogs(baselineLogs, type);
    const deviation = baselineRate > 0 ? ((recentRate - baselineRate) / baselineRate) * 100 : 0;

    return {
        fluidType: type,
        baselineRate: Number(baselineRate.toFixed(3)),
        recentRate: Number(recentRate.toFixed(3)),
        deviation: Number(deviation.toFixed(1)),
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
    if (logs.length < 2) return { period: periodLabel, totalLiters: 0, consumedLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };
    const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const workedHours = sorted[sorted.length-1].hoursAtExecution - sorted[0].hoursAtExecution;
    const consumedLiters = sorted.reduce((acc, l) => acc + (l.fuelLitres || 0), 0) - (sorted[sorted.length-1].fuelLitres || 0);
    return {
        period: periodLabel, totalLiters: consumedLiters,
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
