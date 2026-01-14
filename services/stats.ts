
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

export interface FuelConsumptionStat {
    totalLiters: number;
    workedHours: number;
    consumptionPerHour: number;
    logsCount: number;
}

// Helper local para formatear fecha sin desfase UTC
const toSafeDateString = (date: Date): string => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDecimal = (num: number, decimals: number = 3): string => {
    if (num === null || num === undefined) return '0,000';
    return num.toFixed(decimals).replace('.', ',');
};

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

const getMondaySafeString = (dateInput: Date): string => {
    const d = new Date(dateInput);
    d.setHours(12, 0, 0, 0); // Normalizar a mediodía local
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return toSafeDateString(monday);
};

const getPlannedHoursForDay = (dateInput: Date, plan: CPWeeklyPlan | null): number => {
    if (!plan) return 9; // Fallback si no hay planificación cargada
    const dayOfWeek = dateInput.getDay(); 
    switch (dayOfWeek) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; 
    }
};

const getPastDateProportional = (original: Date, monthsOffset: number = 0, yearsOffset: number = 0): Date => {
    const d = new Date(original);
    if (monthsOffset !== 0) d.setMonth(d.getMonth() + monthsOffset);
    if (yearsOffset !== 0) d.setFullYear(d.getFullYear() + yearsOffset);
    if (d.getDate() !== original.getDate() && monthsOffset !== 0) {
        d.setDate(0); 
    }
    d.setHours(12, 0, 0, 0);
    return d;
};

export const getPerformanceDashboardStats = async (baseDate: Date = new Date()): Promise<PerformanceDashboardData> => {
    // Normalizamos la fecha base a mediodía local
    const today = new Date(baseDate);
    today.setHours(12, 0, 0, 0);

    // --- CÁLCULOS DE RANGOS PROPORCIONALES (TO-DATE) ---
    
    // 1. Diario
    const yesterday = new Date(today); 
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    // 2. Semanal (Lunes a Hoy vs Lunes anterior a Hace 7 días)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    startOfWeek.setHours(12, 0, 0, 0);

    const startOfPrevWeek = new Date(startOfWeek); 
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    
    const prevWeekSameDay = new Date(today); 
    prevWeekSameDay.setDate(today.getDate() - 7);

    // 3. Mensual (Día 1 a Hoy vs Día 1 anterior a mismo día relativo)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0);
    const prevMonthSameDay = getPastDateProportional(today, -1);

    // 4. Anual (Ene 1 a Hoy vs Ene 1 anterior a mismo día relativo)
    const startOfYear = new Date(today.getFullYear(), 0, 1, 12, 0, 0);
    const startOfPrevYear = new Date(today.getFullYear() - 1, 0, 1, 12, 0, 0);
    const prevYearSameDay = getPastDateProportional(today, 0, -1);

    // --- OBTENCIÓN DE DATOS ---
    const [
        dCurr, dPrev, 
        wCurr, wPrev, 
        mCurr, mPrev, 
        yCurr, yPrev
    ] = await Promise.all([
        calculatePeriodStats(today, today, "Hoy"),
        calculatePeriodStats(yesterday, yesterday, "Ayer"),
        calculatePeriodStats(startOfWeek, today, "Esta Sem."),
        calculatePeriodStats(startOfPrevWeek, prevWeekSameDay, "Sem. Ant."),
        calculatePeriodStats(startOfMonth, today, "Este Mes"),
        calculatePeriodStats(startOfPrevMonth, prevMonthSameDay, "Mes Ant."),
        calculatePeriodStats(startOfYear, today, "Este Año"),
        calculatePeriodStats(startOfPrevYear, prevYearSameDay, "Año Ant.")
    ]);

    return {
        daily: comparePeriods(dCurr, dPrev),
        weekly: comparePeriods(wCurr, wPrev),
        monthly: comparePeriods(mCurr, mPrev),
        yearly: comparePeriods(yCurr, yPrev)
    };
};

const calculatePeriodStats = async (start: Date, end: Date, label: string): Promise<ProductionStat> => {
    // IMPORTANTE: Los reportes se buscan por el rango exacto de fechas (YYYY-MM-DD)
    const reports = await getCPReportsByRange(start, end);
    let totalActual = 0;
    let totalPlanned = 0;
    const planCache = new Map<string, CPWeeklyPlan | null>();

    // Bucle día a día para sumar planificación proporcional
    const currentLoop = new Date(start);
    currentLoop.setHours(12, 0, 0, 0);
    
    const endLoop = new Date(end);
    endLoop.setHours(12, 0, 0, 0);

    while (currentLoop <= endLoop) {
        const mondayStr = getMondaySafeString(currentLoop);
        if (!planCache.has(mondayStr)) {
            const plan = await getCPWeeklyPlan(mondayStr);
            planCache.set(mondayStr, plan);
        }
        
        totalPlanned += getPlannedHoursForDay(currentLoop, planCache.get(mondayStr) || null);
        currentLoop.setDate(currentLoop.getDate() + 1);
    }

    // Sumamos producción real (Molinos) de los partes en el rango
    reports.forEach(r => {
        totalActual += (r.millsEnd - r.millsStart);
    });

    return {
        period: label,
        dateLabel: start.getTime() === end.getTime() 
            ? start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            : `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
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
