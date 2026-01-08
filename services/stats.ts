import { getCPReportsByRange, getCPWeeklyPlan } from './db';
import { CPDailyReport, CPWeeklyPlan } from '../types';

export interface ProductionStat {
    period: string; // "Hoy", "Semana Actual", "Mes Actual", etc.
    dateLabel: string; // "12/05/2024" or "Mayo 2024"
    totalActualHours: number;
    totalPlannedHours: number;
    efficiency: number; // Porcentaje
    reports: CPDailyReport[];
}

export interface ProductionComparison {
    current: ProductionStat;
    previous: ProductionStat;
    trend: 'up' | 'down' | 'equal';
    diff: number;
}

// Obtener fecha del lunes de la semana de la fecha dada
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return monday;
};

// Formato local YYYY-MM-DD para plan
const toLocalISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getHoursFromPlan = (plan: CPWeeklyPlan | null, date: Date): number => {
    if (!plan) return 8; // Default to 8 if no plan
    const day = date.getDay(); // 0 Sun, 1 Mon...
    switch (day) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; // Weekend usually 0
    }
};

const calculateStats = async (start: Date, end: Date, label: string, dateFormat: 'day' | 'month' | 'year' = 'day'): Promise<ProductionStat> => {
    // 1. Obtener partes. La DB ahora espera YYYY-MM-DD y filtra inclusivo.
    const reports = await getCPReportsByRange(start, end);
    
    // 2. Sumar horas reales
    const totalActual = reports.reduce((acc, r) => acc + (r.millsEnd - r.millsStart), 0);

    // 3. Calcular horas planificadas
    // Iteramos día a día localmente
    let totalPlanned = 0;
    
    // El "Hoy" absoluto real para no planificar futuro lejano
    const absoluteNow = new Date();
    absoluteNow.setHours(23, 59, 59, 999);

    const loopCurrent = new Date(start);
    loopCurrent.setHours(0,0,0,0);
    
    const loopEnd = new Date(end);
    loopEnd.setHours(23,59,59,999);

    const planCache: Record<string, CPWeeklyPlan | null> = {};

    while (loopCurrent <= loopEnd) {
        // No sumar planificación de días futuros respecto a HOY real
        if (loopCurrent > absoluteNow) {
            break;
        }

        // Lunes de esa semana específica
        const mondayStr = toLocalISO(getMonday(loopCurrent));
        
        if (planCache[mondayStr] === undefined) {
            planCache[mondayStr] = await getCPWeeklyPlan(mondayStr);
        }
        
        totalPlanned += getHoursFromPlan(planCache[mondayStr], loopCurrent);

        // +1 día
        loopCurrent.setDate(loopCurrent.getDate() + 1);
    }

    // Etiquetas
    let dateLabel = "";
    if (dateFormat === 'day') {
        dateLabel = start.toLocaleDateString('es-ES'); 
    } else if (dateFormat === 'month') {
        dateLabel = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
    } else if (dateFormat === 'year') {
        dateLabel = start.getFullYear().toString();
    }

    const efficiency = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    return {
        period: label,
        dateLabel,
        totalActualHours: totalActual,
        totalPlannedHours: totalPlanned,
        efficiency,
        reports
    };
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()): Promise<{
    daily: ProductionStat,
    weekly: ProductionComparison,
    monthly: ProductionComparison,
    yearly: ProductionComparison
}> => {
    // Normalizar baseDate a medianoche
    const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    
    // 1. Daily (Start = Today 00:00, End = Today 23:59)
    const startDay = new Date(today);
    const endDay = new Date(today);
    const daily = await calculateStats(startDay, endDay, "Día Seleccionado", 'day');

    // 2. Weekly (Relativo a baseDate)
    const startWeek = getMonday(today);
    const endWeek = new Date(startWeek);
    endWeek.setDate(endWeek.getDate() + 6); // Domingo
    
    const startLastWeek = new Date(startWeek);
    startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(endWeek);
    endLastWeek.setDate(endLastWeek.getDate() - 7);

    const weeklyCurr = await calculateStats(startWeek, endWeek, "Semana Seleccionada", 'day');
    weeklyCurr.dateLabel = `Semana ${startWeek.getDate()}/${startWeek.getMonth()+1}`;

    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior", 'day');
    weeklyPrev.dateLabel = `Semana ${startLastWeek.getDate()}/${startLastWeek.getMonth()+1}`;

    // 3. Monthly (Relativo a baseDate)
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthlyCurr = await calculateStats(startMonth, endMonth, "Mes Seleccionado", 'month');
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior", 'month');

    // 4. Yearly (Relativo a baseDate)
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const startLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const endLastYear = new Date(today.getFullYear() - 1, 11, 31);

    const yearlyCurr = await calculateStats(startYear, endYear, "Año Seleccionado", 'year');
    const yearlyPrev = await calculateStats(startLastYear, endLastYear, "Año Anterior", 'year');

    const compare = (curr: ProductionStat, prev: ProductionStat): ProductionComparison => ({
        current: curr,
        previous: prev,
        trend: curr.efficiency > prev.efficiency ? 'up' : curr.efficiency < prev.efficiency ? 'down' : 'equal',
        diff: parseFloat((curr.efficiency - prev.efficiency).toFixed(1))
    });

    return {
        daily,
        weekly: compare(weeklyCurr, weeklyPrev),
        monthly: compare(monthlyCurr, monthlyPrev),
        yearly: compare(yearlyCurr, yearlyPrev)
    };
};
