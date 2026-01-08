import { getCPReportsByRange, getCPWeeklyPlansByRange } from './db';
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

const getHoursFromPlan = (plan: CPWeeklyPlan | null | undefined, date: Date): number => {
    if (!plan) return 8; // Default to 8 if no plan
    const day = date.getDay(); // 0 Sun, 1 Mon...
    const h = (() => {
        switch (day) {
            case 1: return plan.hoursMon;
            case 2: return plan.hoursTue;
            case 3: return plan.hoursWed;
            case 4: return plan.hoursThu;
            case 5: return plan.hoursFri;
            default: return 0; // Weekend usually 0
        }
    })();
    return Number(h || 0); // Asegurar que sea número y no null/undefined
};

/**
 * Calcula estadísticas en un rango de forma masiva para evitar sobrecarga de peticiones
 */
const calculateStats = async (
    start: Date, 
    end: Date, 
    label: string, 
    limitDate: Date, 
    allPlansInRange: CPWeeklyPlan[],
    dateFormat: 'day' | 'month' | 'year' = 'day'
): Promise<ProductionStat> => {
    // 1. Obtener reportes
    const allReportsInRange = await getCPReportsByRange(start, end);
    
    // 2. Normalizar el punto de corte (final del día seleccionado)
    const cutoff = new Date(limitDate);
    cutoff.setHours(23, 59, 59, 999);

    // 3. Filtrar reportes
    const filteredReports = allReportsInRange.filter(r => {
        const reportDate = new Date(r.date);
        return reportDate <= cutoff;
    });
    
    const totalActual = filteredReports.reduce((acc, r) => acc + (Number(r.millsEnd || 0) - Number(r.millsStart || 0)), 0);

    // 4. Calcular horas planificadas localmente (sin más peticiones a DB)
    let totalPlanned = 0;
    const loopCurrent = new Date(start);
    loopCurrent.setHours(12,0,0,0); // Usar mediodía para evitar problemas de DST
    
    const stopAt = new Date(end < cutoff ? end : cutoff);
    stopAt.setHours(23, 59, 59, 999);

    while (loopCurrent <= stopAt) {
        const mondayStr = toLocalISO(getMonday(loopCurrent));
        const plan = allPlansInRange.find(p => p.mondayDate === mondayStr);
        totalPlanned += getHoursFromPlan(plan, loopCurrent);
        loopCurrent.setDate(loopCurrent.getDate() + 1);
    }

    // Etiquetas de visualización
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
        totalActualHours: parseFloat(totalActual.toFixed(2)),
        totalPlannedHours: parseFloat(totalPlanned.toFixed(2)),
        efficiency,
        reports: filteredReports
    };
};

export const getProductionEfficiencyStats = async (baseDate: Date = new Date()): Promise<{
    daily: ProductionStat,
    weekly: ProductionComparison,
    monthly: ProductionComparison,
    yearly: ProductionComparison
}> => {
    const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    
    // RANGOS PARA PRE-CARGA MASIVA DE PLANES
    // El rango máximo que necesitamos es desde el inicio del año pasado hasta el fin del año actual
    const fullRangeStart = new Date(today.getFullYear() - 1, 0, 1);
    const fullRangeEnd = new Date(today.getFullYear(), 11, 31);
    
    // Pre-cargar todos los planes necesarios en una sola consulta
    const allPlans = await getCPWeeklyPlansByRange(toLocalISO(fullRangeStart), toLocalISO(fullRangeEnd));

    // 1. Daily
    const daily = await calculateStats(today, today, "Día Seleccionado", today, allPlans, 'day');

    // 2. Weekly
    const startWeek = getMonday(today);
    const endWeek = new Date(startWeek);
    endWeek.setDate(endWeek.getDate() + 6); 
    
    const startLastWeek = new Date(startWeek);
    startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(endWeek);
    endLastWeek.setDate(endLastWeek.getDate() - 7);
    
    const lastWeekLimit = new Date(today);
    lastWeekLimit.setDate(lastWeekLimit.getDate() - 7);

    const weeklyCurr = await calculateStats(startWeek, endWeek, "Semana Seleccionada", today, allPlans, 'day');
    weeklyCurr.dateLabel = `Semana ${startWeek.getDate()}/${startWeek.getMonth()+1}`;

    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior", lastWeekLimit, allPlans, 'day');
    weeklyPrev.dateLabel = `Semana ${startLastWeek.getDate()}/${startLastWeek.getMonth()+1}`;

    // 3. Monthly
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const lastMonthLimit = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), endLastMonth.getDate()));

    const monthlyCurr = await calculateStats(startMonth, endMonth, "Mes Seleccionado", today, allPlans, 'month');
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior", lastMonthLimit, allPlans, 'month');

    // 4. Yearly
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const startLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const endLastYear = new Date(today.getFullYear() - 1, 11, 31);
    
    const lastYearLimit = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    const yearlyCurr = await calculateStats(startYear, endYear, "Año Seleccionado", today, allPlans, 'year');
    const yearlyPrev = await calculateStats(startLastYear, endLastYear, "Año Anterior", lastYearLimit, allPlans, 'year');

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
