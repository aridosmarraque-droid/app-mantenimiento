
import { getCPReportsByRange, getCPWeeklyPlan, getMachineLogs } from './db';
import { CPDailyReport, CPWeeklyPlan, OperationLog } from '../types';

export interface ProductionStat {
    period: string;
    dateLabel: string;
    totalActualHours: number;
    totalPlannedHours: number;
    efficiency: number;
}

export interface ProductionComparison {
    current: ProductionStat;
    previous: ProductionStat;
    trend: 'up' | 'down' | 'equal';
    diff: number;
}

export interface PerformanceDashboardData {
    daily: ProductionComparison;
    weekly: ProductionComparison;
    monthly: ProductionComparison;
    yearly: ProductionComparison;
}

// Added missing interface FuelConsumptionStat for PDF and Reports
export interface FuelConsumptionStat {
    totalLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
}

export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

// Added missing function calculateFuelConsumptionFromLogs
export const calculateFuelConsumptionFromLogs = (logs: OperationLog[]): FuelConsumptionStat => {
    if (logs.length < 2) return { totalLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };

    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const workedHours = last.hoursAtExecution - first.hoursAtExecution;
    const totalLiters = sorted.slice(1).reduce((sum, log) => sum + (log.fuelLitres || 0), 0);
    
    return {
        totalLiters,
        workedHours,
        consumptionPerHour: workedHours > 0 ? totalLiters / workedHours : 0,
        logsCount: logs.length
    };
};

// Added missing function getMachineFuelStats
export const getMachineFuelStats = async (machineId: string) => {
    const allLogs = await getMachineLogs(machineId, undefined, undefined, ['REFUELING']);
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    
    const monthlyLogs = allLogs.filter(l => new Date(l.date) >= oneMonthAgo);
    const monthly = calculateFuelConsumptionFromLogs(monthlyLogs);
    const yearly = calculateFuelConsumptionFromLogs(allLogs);
    
    const deviation = yearly.consumptionPerHour > 0 
        ? ((monthly.consumptionPerHour - yearly.consumptionPerHour) / yearly.consumptionPerHour) * 100 
        : 0;

    return {
        fuelDeviation: deviation,
        monthly: {
            ...monthly,
            consumedLiters: monthly.totalLiters,
            workedHours: monthly.workedHours,
            consumptionPerHour: monthly.consumptionPerHour,
            logsCount: monthly.logsCount
        },
        yearly,
        logs: allLogs
    };
};

// Added missing function getMachineFluidStats
export const getMachineFluidStats = async (machineId: string) => {
    const logs = await getMachineLogs(machineId, undefined, undefined, ['LEVELS']);
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const evolution: any[] = [];
    let motorTotal = 0, hydTotal = 0, coolTotal = 0, totalHours = 0;

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const hDiff = curr.hoursAtExecution - prev.hoursAtExecution;

        if (hDiff > 0) {
            const motorRate = (curr.motorOil || 0) / hDiff * 100;
            const hydRate = (curr.hydraulicOil || 0) / hDiff * 100;
            const coolRate = (curr.coolant || 0) / hDiff * 100;

            motorTotal += (curr.motorOil || 0);
            hydTotal += (curr.hydraulicOil || 0);
            coolTotal += (curr.coolant || 0);
            totalHours += hDiff;

            evolution.unshift({
                date: new Date(curr.date).toLocaleDateString(),
                hours: curr.hoursAtExecution,
                motorRate, hydRate, coolRate
            });
        }
    }

    const baselineMotor = totalHours > 0 ? (motorTotal / totalHours * 100) : 0;
    const baselineHyd = totalHours > 0 ? (hydTotal / totalHours * 100) : 0;
    const baselineCool = totalHours > 0 ? (coolTotal / totalHours * 100) : 0;

    const recent = evolution[0] || { motorRate: 0, hydRate: 0, coolRate: 0 };

    return {
        motor: { 
            recentRate: recent.motorRate || 0, 
            baselineRate: baselineMotor, 
            deviation: baselineMotor > 0 ? ((recent.motorRate - baselineMotor) / baselineMotor * 100) : 0, 
            logsCount: logs.length 
        },
        hydraulic: { 
            recentRate: recent.hydRate || 0, 
            baselineRate: baselineHyd, 
            deviation: baselineHyd > 0 ? ((recent.hydRate - baselineHyd) / baselineHyd * 100) : 0, 
            logsCount: logs.length 
        },
        coolant: { 
            recentRate: recent.coolRate || 0, 
            baselineRate: baselineCool, 
            deviation: baselineCool > 0 ? ((recent.coolRate - baselineCool) / baselineCool * 100) : 0, 
            logsCount: logs.length 
        },
        evolution
    };
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
    if (!plan) return 9; // Fallback por defecto si no hay plan
    const d = new Date(dateInput);
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

// Función maestra para obtener todos los datos del dashboard
export const getPerformanceDashboardStats = async (baseDate: Date = new Date()): Promise<PerformanceDashboardData> => {
    const today = new Date(baseDate);
    today.setHours(12, 0, 0, 0);

    // --- CÁLCULOS DE RANGOS ---
    
    // Diario
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    // Semanal (Lunes a Domingo)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startOfPrevWeek = new Date(startOfWeek); startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const endOfPrevWeek = new Date(startOfPrevWeek); endOfPrevWeek.setDate(startOfPrevWeek.getDate() + 6);

    // Mensual
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Anual
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    
    const startOfPrevYear = new Date(today.getFullYear() - 1, 0, 1);
    const endOfPrevYear = new Date(today.getFullYear() - 1, 11, 31);

    // --- OBTENCIÓN DE DATOS EN PARALELO ---
    const [
        dCurr, dPrev, 
        wCurr, wPrev, 
        mCurr, mPrev, 
        yCurr, yPrev
    ] = await Promise.all([
        calculatePeriodStats(today, today, "Hoy"),
        calculatePeriodStats(yesterday, yesterday, "Ayer"),
        calculatePeriodStats(startOfWeek, endOfWeek, "Esta Semana"),
        calculatePeriodStats(startOfPrevWeek, endOfPrevWeek, "Sem. Anterior"),
        calculatePeriodStats(startOfMonth, endOfMonth, "Este Mes"),
        calculatePeriodStats(startOfPrevMonth, endOfPrevMonth, "Mes Anterior"),
        calculatePeriodStats(startOfYear, endOfYear, "Este Año"),
        calculatePeriodStats(startOfPrevYear, endOfPrevYear, "Año Anterior")
    ]);

    return {
        daily: comparePeriods(dCurr, dPrev),
        weekly: comparePeriods(wCurr, wPrev),
        monthly: comparePeriods(mCurr, mPrev),
        yearly: comparePeriods(yCurr, yPrev)
    };
};

const calculatePeriodStats = async (start: Date, end: Date, label: string): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    let totalActual = 0;
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();

    // Iteramos día por día en el rango para calcular la planificación exacta
    const current = new Date(start);
    while (current <= end) {
        const mondayStr = getMondayISOString(current);
        if (!planCache.has(mondayStr)) {
            const plan = await getCPWeeklyPlan(mondayStr);
            planCache.set(mondayStr, plan);
        }
        totalPlanned += getPlannedHoursForDay(current, planCache.get(mondayStr) || null);
        current.setDate(current.getDate() + 1);
    }

    // Sumamos producción real de los partes encontrados en ese rango
    reports.forEach(r => {
        totalActual += (r.millsEnd - r.millsStart);
    });

    return {
        period: label,
        dateLabel: `${start.toLocaleDateString('es-ES', {day:'numeric', month:'short'})} - ${end.toLocaleDateString('es-ES', {day:'numeric', month:'short'})}`,
        totalActualHours: Number(totalActual.toFixed(2)),
        totalPlannedHours: Number(totalPlanned.toFixed(2)),
        efficiency: totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0
    };
};

const comparePeriods = (curr: ProductionStat, prev: ProductionStat): ProductionComparison => {
    const diff = curr.efficiency - prev.efficiency;
    return {
        current: curr,
        previous: prev,
        trend: diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'equal',
        diff: Number(diff.toFixed(1))
    };
};
