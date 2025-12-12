
import { getCPReportsByRange, getCPWeeklyPlan } from './db';
import { CPDailyReport, CPWeeklyPlan } from '../types';

export interface ProductionStat {
    period: string; // "Hoy", "Semana Actual", "Mes Actual", etc.
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

const calculateStats = async (start: Date, end: Date, label: string): Promise<ProductionStat> => {
    const reports = await getCPReportsByRange(start, end);
    
    let totalActual = 0;
    let totalPlanned = 0;

    // Cache plans to avoid refetching for same week
    const planCache: Record<string, CPWeeklyPlan | null> = {};

    for (const report of reports) {
        // 1. Sum Actual Hours (Mills only as requested)
        const dailyActual = report.millsEnd - report.millsStart;
        totalActual += dailyActual;

        // 2. Sum Planned Hours
        const monday = getMonday(report.date).toISOString().split('T')[0];
        if (planCache[monday] === undefined) {
            planCache[monday] = await getCPWeeklyPlan(monday);
        }
        totalPlanned += getHoursFromPlan(planCache[monday], report.date);
    }

    // Adjust Planned Total logic: 
    // If we have reports, we sum planned hours for THOSE days.
    // However, if we are looking at a "Week" view, maybe we want Total Planned for the Week vs Total Actual so far?
    // For simplicity in this efficiency metric, we compare Actuals vs Planned *for the days worked*.
    
    // If no reports found but we are in a range, efficiency is 0.
    const efficiency = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

    return {
        period: label,
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
    const daily = await calculateStats(today, endToday, "Hoy");

    // 2. Weekly (Current vs Last)
    const startWeek = getMonday(today);
    const endWeek = new Date(startWeek); endWeek.setDate(endWeek.getDate() + 6);
    
    const startLastWeek = new Date(startWeek); startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(endWeek); endLastWeek.setDate(endLastWeek.getDate() - 7);

    const weeklyCurr = await calculateStats(startWeek, endWeek, "Semana Actual");
    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior");

    // 3. Monthly
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const monthlyCurr = await calculateStats(startMonth, endMonth, "Mes Actual");
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior");

    // 4. Yearly (Current Year vs Last Year - simplificado)
    const startYear = new Date(today.getFullYear(), 0, 1);
    const endYear = new Date(today.getFullYear(), 11, 31);
    
    const startLastYear = new Date(today.getFullYear() - 1, 0, 1);
    const endLastYear = new Date(today.getFullYear() - 1, 11, 31);

    const yearlyCurr = await calculateStats(startYear, endYear, "Año Actual");
    const yearlyPrev = await calculateStats(startLastYear, endLastYear, "Año Anterior");

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
