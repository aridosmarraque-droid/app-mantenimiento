
import { getCPReportsByRange, getCPWeeklyPlan, getLastCPReport } from './db';
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

// Helper seguro para obtener el string YYYY-MM-DD local
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper para obtener el lunes de una fecha dada
const getMondayDate = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getHoursFromPlan = (plan: CPWeeklyPlan | null, date: Date): number => {
    // Si no hay plan en BD, asumimos 9h por defecto para generar estadística
    if (!plan) return 9; 
    
    const day = date.getDay(); // 0 Sun, 1 Mon...
    switch (day) {
        case 1: return plan.hoursMon;
        case 2: return plan.hoursTue;
        case 3: return plan.hoursWed;
        case 4: return plan.hoursThu;
        case 5: return plan.hoursFri;
        default: return 0; // Fines de semana 0
    }
};

const calculateStats = async (start: Date, end: Date, label: string, dateFormat: 'day' | 'month' | 'year' = 'day'): Promise<ProductionStat> => {
    // 1. Obtener los partes reales en el rango
    // IMPORTANTE: 'end' es la fecha del último reporte disponible (para el periodo actual),
    // por lo que garantizamos comparar "Peras con Peras".
    const reports = await getCPReportsByRange(start, end);
    
    // 2. Sumar horas reales (EXCLUSIVAMENTE MOLINOS)
    // Se añade validación para evitar negativos si hubo error al meter el dato
    const totalActual = reports.reduce((acc, r) => {
        const molinosHoras = r.millsEnd - r.millsStart;
        return acc + Math.max(0, molinosHoras);
    }, 0);

    // 3. Calcular horas planificadas
    let totalPlanned = 0;
    
    const loopCurrent = new Date(start);
    loopCurrent.setHours(0,0,0,0);
    
    const loopEnd = new Date(end);
    loopEnd.setHours(0,0,0,0);

    const planCache: Record<string, CPWeeklyPlan | null> = {};

    while (loopCurrent <= loopEnd) {
        // Obtenemos la fecha del lunes correspondiente a 'loopCurrent' para buscar el plan semanal
        const mondayDate = getMondayDate(loopCurrent);
        const mondayStr = getLocalDateString(mondayDate);
        
        if (planCache[mondayStr] === undefined) {
            planCache[mondayStr] = await getCPWeeklyPlan(mondayStr);
        }
        
        // Sumar horas planificadas para este día
        totalPlanned += getHoursFromPlan(planCache[mondayStr], loopCurrent);

        // Avanzar al siguiente día
        loopCurrent.setDate(loopCurrent.getDate() + 1);
    }

    // Etiquetas de fecha
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

export const getProductionEfficiencyStats = async (): Promise<{
    daily: ProductionStat,
    weekly: ProductionComparison,
    monthly: ProductionComparison,
    yearly: ProductionComparison
}> => {
    // 1. DETERMINAR FECHA ANCLA (Último reporte registrado)
    const lastReport = await getLastCPReport();
    
    // Si hay reportes, usamos la fecha del último. Si no, usamos hoy.
    const anchorDate = lastReport ? new Date(lastReport.date) : new Date();
    // Ajustar anchorDate al final del día para incluirlo completamente en rangos
    anchorDate.setHours(23, 59, 59, 999);
    
    const anchorDateStart = new Date(anchorDate);
    anchorDateStart.setHours(0,0,0,0);

    // 1. Daily (Basado exclusivamente en el día del último reporte)
    const daily = await calculateStats(anchorDateStart, anchorDate, "Último Día", 'day');

    // 2. Weekly
    // Current: Desde el Lunes de la semana del Anchor hasta el Anchor (inclusive)
    const startWeek = getMondayDate(anchorDate);
    const weeklyCurr = await calculateStats(startWeek, anchorDate, "Semana Actual", 'day');
    weeklyCurr.dateLabel = `Semana ${startWeek.getDate()}/${startWeek.getMonth()+1}`;

    // Previous: Semana completa anterior a la del Anchor
    const startLastWeek = new Date(startWeek); 
    startLastWeek.setDate(startLastWeek.getDate() - 7);
    const endLastWeek = new Date(startLastWeek); 
    endLastWeek.setDate(endLastWeek.getDate() + 6);
    endLastWeek.setHours(23,59,59,999);
    
    const weeklyPrev = await calculateStats(startLastWeek, endLastWeek, "Semana Anterior", 'day');
    weeklyPrev.dateLabel = `Semana ${startLastWeek.getDate()}/${startLastWeek.getMonth()+1}`;


    // 3. Monthly
    // Current: Desde el 1 del mes del Anchor hasta el Anchor
    const startMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const monthlyCurr = await calculateStats(startMonth, anchorDate, "Mes Actual", 'month');

    // Previous: Mes completo anterior
    const startLastMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1);
    const endLastMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 0);
    endLastMonth.setHours(23,59,59,999);
    
    const monthlyPrev = await calculateStats(startLastMonth, endLastMonth, "Mes Anterior", 'month');

    // 4. Yearly
    // Current: Desde el 1 de Enero hasta el Anchor
    const startYear = new Date(anchorDate.getFullYear(), 0, 1);
    const yearlyCurr = await calculateStats(startYear, anchorDate, "Año Actual", 'year');
    
    // Previous: Año completo anterior
    const startLastYear = new Date(anchorDate.getFullYear() - 1, 0, 1);
    const endLastYear = new Date(anchorDate.getFullYear() - 1, 11, 31);
    endLastYear.setHours(23,59,59,999);

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
