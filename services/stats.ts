
import { getCPReportsByRange, getCPWeeklyPlan, getMachineLogs } from './db';
import { CPDailyReport, CPWeeklyPlan, OperationLog } from '../types';

export interface ProductionStat {
    period: string;
    dateLabel: string;
    totalActualHours: number;
    totalPlannedHours: number;
    efficiency: number;
}

export interface FuelConsumptionStat {
    totalLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
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

// --- HELPERS DE FECHA ---

const startOfDay = (d: Date): Date => {
    const newDate = new Date(d);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const toISODate = (d: Date): string => {
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0');
};

const getMondayOfDate = (d: Date): Date => {
    const temp = new Date(d);
    temp.setHours(0, 0, 0, 0);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(temp.setDate(diff));
};

const getPlannedHoursFromPlan = (date: Date, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 8; // Fallback 8h
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

// --- MOTOR DE CÁLCULO ---

const calculatePeriodStats = async (start: Date, end: Date, label: string): Promise<ProductionStat> => {
    const s = startOfDay(start);
    const e = startOfDay(end);
    
    // 1. Obtener partes reales
    const reports = await getCPReportsByRange(s, e);
    const totalActual = reports.reduce((acc, r) => acc + (r.millsEnd - r.millsStart), 0);

    // 2. Calcular horas planificadas día a día
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();
    
    const iter = new Date(s);
    while (iter <= e) {
        const monday = getMondayOfDate(iter);
        const mondayKey = toISODate(monday);
        
        if (!planCache.has(mondayKey)) {
            const plan = await getCPWeeklyPlan(mondayKey);
            planCache.set(mondayKey, plan);
        }
        
        totalPlanned += getPlannedHoursFromPlan(iter, planCache.get(mondayKey) || null);
        iter.setDate(iter.getDate() + 1);
    }

    const efficiency = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    return {
        period: label,
        dateLabel: s.getTime() === e.getTime() 
            ? s.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            : `${s.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${e.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
        totalActualHours: Number(totalActual.toFixed(2)),
        totalPlannedHours: Number(totalPlanned.toFixed(2)),
        efficiency: Number(efficiency.toFixed(1))
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

export const getPerformanceDashboardStats = async (baseDate: Date = new Date()): Promise<PerformanceDashboardData> => {
    const today = startOfDay(baseDate);

    // --- DEFINICIÓN DE RANGOS ---

    // DIARIO: Hoy vs Ayer
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    // SEMANAL: Esta Sem. (Lun->Hoy) vs Sem. Ant. (Lun->Dom anterior)
    const currentMonday = getMondayOfDate(today);
    const prevMonday = new Date(currentMonday); prevMonday.setDate(currentMonday.getDate() - 7);
    const prevSunday = new Date(currentMonday); prevSunday.setDate(currentMonday.getDate() - 1);

    // MENSUAL: Mes actual (MTD) vs MES ANTERIOR COMPLETO
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // ANUAL: Año actual (YTD) vs AÑO ANTERIOR COMPLETO
    const currentYearStart = new Date(today.getFullYear(), 0, 1);
    const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(today.getFullYear() - 1, 11, 31);

    // --- EJECUCIÓN ---
    const [
        dCurr, dPrev, 
        wCurr, wPrev, 
        mCurr, mPrev, 
        yCurr, yPrev
    ] = await Promise.all([
        calculatePeriodStats(today, today, "Hoy"),
        calculatePeriodStats(yesterday, yesterday, "Ayer"),
        calculatePeriodStats(currentMonday, today, "Esta Sem."),
        calculatePeriodStats(prevMonday, prevSunday, "Sem. Ant."),
        calculatePeriodStats(currentMonthStart, today, "Este Mes"),
        calculatePeriodStats(prevMonthStart, prevMonthEnd, "Mes Ant."),
        calculatePeriodStats(currentYearStart, today, "Este Año"),
        calculatePeriodStats(prevYearStart, prevYearEnd, "Año Ant.")
    ]);

    return {
        daily: comparePeriods(dCurr, dPrev),
        weekly: comparePeriods(wCurr, wPrev),
        monthly: comparePeriods(mCurr, mPrev),
        yearly: comparePeriods(yCurr, yPrev)
    };
};

// --- CONSUMO DE GASOIL Y FLUIDOS ---

export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

export const calculateFuelConsumptionFromLogs = (logs: OperationLog[]): FuelConsumptionStat => {
    if (logs.length < 2) return { totalLiters: 0, workedHours: 0, consumptionPerHour: 0, logsCount: logs.length };
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const workedHours = sorted[sorted.length - 1].hoursAtExecution - sorted[0].hoursAtExecution;
    const totalLiters = sorted.slice(1).reduce((sum, log) => sum + (log.fuelLitres || 0), 0);
    return { totalLiters, workedHours, consumptionPerHour: workedHours > 0 ? totalLiters / workedHours : 0, logsCount: logs.length };
};

export const getMachineFuelStats = async (machineId: string) => {
    const allLogs = await getMachineLogs(machineId, undefined, undefined, ['REFUELING']);
    const now = new Date();
    const oneMonthAgo = new Date(); oneMonthAgo.setMonth(now.getMonth() - 1);
    const monthlyLogs = allLogs.filter(l => new Date(l.date) >= oneMonthAgo);
    const monthly = calculateFuelConsumptionFromLogs(monthlyLogs);
    const yearly = calculateFuelConsumptionFromLogs(allLogs);
    const deviation = yearly.consumptionPerHour > 0 ? ((monthly.consumptionPerHour - yearly.consumptionPerHour) / yearly.consumptionPerHour) * 100 : 0;
    return { fuelDeviation: deviation, monthly: { ...monthly, consumedLiters: monthly.totalLiters, workedHours: monthly.workedHours }, yearly, logs: allLogs };
};

export const getMachineFluidStats = async (machineId: string) => {
    const logs = await getMachineLogs(machineId, undefined, undefined, ['LEVELS']);
    const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const evolution: any[] = [];
    let mTotal = 0, hTotal = 0, cTotal = 0, tHours = 0;
    for (let i = 1; i < sorted.length; i++) {
        const diff = sorted[i].hoursAtExecution - sorted[i - 1].hoursAtExecution;
        if (diff > 0) {
            const motorAmt = sorted[i].motorOil || 0;
            const hydAmt = sorted[i].hydraulicOil || 0;
            const coolAmt = sorted[i].coolant || 0;

            const mR = motorAmt / diff * 100;
            const hR = hydAmt / diff * 100;
            const cR = coolAmt / diff * 100;
            
            mTotal += motorAmt; hTotal += hydAmt; cTotal += coolAmt; tHours += diff;
            
            evolution.unshift({ 
                date: new Date(sorted[i].date).toLocaleDateString(), 
                hours: sorted[i].hoursAtExecution, 
                motorRate: mR, 
                hydRate: hR, 
                coolRate: cR,
                motorAmount: motorAmt,
                hydAmount: hydAmt,
                coolAmount: coolAmt
            });
        }
    }
    const bM = tHours > 0 ? (mTotal / tHours * 100) : 0;
    const bH = tHours > 0 ? (hTotal / tHours * 100) : 0;
    const bC = tHours > 0 ? (cTotal / tHours * 100) : 0;
    const recent = evolution[0] || { motorRate: 0, hydRate: 0, coolRate: 0, motorAmount: 0, hydAmount: 0, coolAmount: 0 };
    return {
        motor: { recentRate: recent.motorRate, baselineRate: bM, deviation: bM > 0 ? ((recent.motorRate - bM) / bM * 100) : 0, logsCount: logs.length },
        hydraulic: { recentRate: recent.hydRate, baselineRate: bH, deviation: bH > 0 ? ((recent.hydRate - bH) / bH * 100) : 0, logsCount: logs.length },
        coolant: { recentRate: recent.coolRate, baselineRate: bC, deviation: bC > 0 ? ((recent.coolRate - bC) / bC * 100) : 0, logsCount: logs.length },
        evolution
    };
};
