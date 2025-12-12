
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

// Helper para obtener el lunes de una fecha dada
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
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
    // 1. Obtener los partes reales existentes en el rango
    const reports = await getCPReportsByRange(start, end);
    
    // 2. Sumar horas reales (solo de los partes que existen)
    const totalActual = reports.reduce((acc, r) => acc + (r.millsEnd - r.millsStart), 0);

    // 3. Calcular horas planificadas
    // IMPORTANTE: Recorremos día a día desde el inicio hasta el fin del rango (o hasta HOY si el rango es futuro)
    // para sumar lo que SE DEBERÍA haber hecho hasta el momento del cálculo.
    let totalPlanned = 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);

    // Normalizar fechas para el bucle
    const loopCurrent = new Date(start);
    loopCurrent.setHours(0,0,0,0);
    
    const loopEnd = new Date(end);
    loopEnd.setHours(0,0,0,0);

    const planCache: Record<string, CPWeeklyPlan | null> = {};

    while (loopCurrent <= loopEnd) {
        // Regla: No sumar planificación de días futuros.
        // Si estamos viendo la semana completa un viernes, sumamos planificación de Lunes a Viernes (incluido).
        // No sumamos sábado ni domingo ni días futuros.
        if (loopCurrent > today) {
            break;
        }

        const mondayStr = getMonday(loopCurrent).toISOString().split('T')[0];
        
        if (planCache[mondayStr] === undefined) {
            planCache[mondayStr] = await getCPWeeklyPlan(mondayStr);
        }
        
        // Sumar horas de este día específico según el plan semanal
        totalPlanned += getHoursFromPlan(planCache[mondayStr], loopCurrent);

        // Avanzar al siguiente día
        loopCurrent.setDate(loopCurrent.getDate() + 1);
    }

    // Determine specific date label based on the start date
    let dateLabel = "";
    if (dateFormat === 'day') {
        dateLabel = start.toLocaleDateString('es-ES'); // "12/05/2024"
    } else if (dateFormat === 'month') {
        dateLabel = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); // "mayo 2024"
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

export const getProductionEfficiencyStats = async (): Promise<{
    daily: ProductionStat,
    weekly: ProductionComparison,
    monthly: ProductionComparison,
    yearly: ProductionComparison
}> => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const endToday = new Date(today);
    endToday.setHours(23,59,59,999);

    // 1. Daily
    const daily = await calculateStats(today, endToday, "Hoy", 'day');

    // 2. Weekly (Current vs Last)
    const startWeek = getMonday(today);
    const endWeek = new Date(startWeek); endWeek.setDate(endWeek.getDate() + 6);
    
    const startLastWeek = new Date(startWeek); startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(endWeek); endLastWeek.setDate(endLastWeek.getDate() - 7);

    // Note: We use 'day' format for weekly to show the monday, or could use a custom range string
    const weeklyCurr = await calculateStats(startWeek, endWeek, "Semana Actual", 'day');
    // Override label to show range
    weeklyCurr.dateLabel = `Semana ${startWeek.getDate()}/${startWeek.getMonth()+1}`;

    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior", 'day');
    weeklyPrev.dateLabel = `Semana ${startLastWeek.getDate()}/${startLastWeek.getMonth()+1}`;


    // 3. Monthly
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthlyCurr = await calculateStats(startMonth, endMonth, "Mes Actual", 'month');
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior", 'month');

    // 4. Yearly
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const startLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const endLastYear = new Date(today.getFullYear() - 1, 11, 31);

    const yearlyCurr = await calculateStats(startYear, endYear, "Año Actual", 'year');
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
