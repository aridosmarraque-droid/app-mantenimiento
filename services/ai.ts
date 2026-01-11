import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { CPDailyReport, PersonalReport, OperationLog, Machine } from '../types';
import { ProductionComparison, FuelConsumptionStat, FluidTrend, formatDecimal } from './stats';

// Helper para colores semafóricos en el PDF
const getDeviationColor = (dev: number): [number, number, number] => {
    if (dev > 25) return [220, 38, 38]; // Rojo (Avería/Alerta)
    if (dev > 10) return [245, 158, 11]; // Naranja (Incremento ligero)
    return [22, 163, 74]; // Verde (Normal)
};

export const generateCPReportPDF = (report: any, workerName: string, plannedHours: number, efficiency: number): string => {
    const doc = new jsPDF();
    doc.text("Parte Diario", 20, 20);
    return doc.output('datauristring').split(',')[1];
};

export const generatePersonalReportPDF = (report: any, workerName: string): string => {
    const doc = new jsPDF();
    doc.text("Parte Personal", 20, 20);
    return doc.output('datauristring').split(',')[1];
};

export const generateFuelReportPDF = (
    machinesData: { machine: Machine, stats: { monthly: FuelConsumptionStat, quarterly: FuelConsumptionStat, yearly: FuelConsumptionStat } }[],
    periodLabel: string
): string => {
    const doc: any = new jsPDF();
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ARIDOS MARRAQUE", 20, 20);
    doc.setFontSize(14);
    doc.text(`INFORME DE CONSUMOS DE GASOIL - ${periodLabel}`, 20, 32);

    const tableData = machinesData.map(({ machine, stats }) => [
        machine.companyCode ? `[${machine.companyCode}] ${machine.name}` : machine.name,
        `${formatDecimal(stats.monthly.totalLiters, 1)} L`,
        `${formatDecimal(stats.monthly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.quarterly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.yearly.consumptionPerHour, 2)} L/h`,
    ]);

    doc.autoTable({
        startY: 50,
        head: [['Unidad', 'L. Mes', 'Media Mes', 'Media Trim.', 'Media Año']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 55 } }
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Valores calculados sobre registros de suministro. Formato decimal: Coma (,).", 105, 285, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};

export const generateFluidReportPDF = (
    machinesData: { machine: Machine, stats: any, aiAnalysis: string }[],
    periodLabel: string
): string => {
    const doc: any = new jsPDF();
    
    // --- PORTADA Y CABECERA ---
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ARIDOS MARRAQUE", 20, 20);
    doc.setFontSize(12);
    doc.text(`MONITOR DE SALUD DE FLUIDOS - ${periodLabel}`, 20, 32);

    let currentY = 55;

    // --- SECCIÓN 1: CUADRO DE MANDO DE ALERTAS (RESUMEN INICIAL) ---
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("RESUMEN EJECUTIVO DE ALERTAS", 20, currentY);
    currentY += 8;

    const criticalAlerts = machinesData
        .flatMap(m => [
            { name: m.machine.name, fluid: 'Aceite Motor', dev: m.stats.motor.deviation, code: m.machine.companyCode },
            { name: m.machine.name, fluid: 'Aceite Hidráulico', dev: m.stats.hydraulic.deviation, code: m.machine.companyCode },
            { name: m.machine.name, fluid: 'Refrigerante', dev: m.stats.coolant.deviation, code: m.machine.companyCode }
        ])
        .filter(a => a.dev > 10)
        .sort((a, b) => b.dev - a.dev);

    if (criticalAlerts.length > 0) {
        doc.autoTable({
            startY: currentY,
            head: [['Unidad', 'Fluido', 'Desviación %', 'Estado Crítico']],
            body: criticalAlerts.map(a => [
                a.code ? `[${a.code}] ${a.name}` : a.name,
                a.fluid,
                `${a.dev > 0 ? '+' : ''}${formatDecimal(a.dev, 1)}%`,
                a.dev > 25 ? 'AVERÍA INMINENTE' : 'SEGUIMIENTO PREVENTIVO'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] },
            styles: { fontSize: 8, halign: 'center' },
            columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const valStr = data.cell.raw.replace('%', '').replace(',', '.');
                    const val = parseFloat(valStr);
                    data.cell.styles.textColor = getDeviationColor(val);
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        currentY = doc.lastAutoTable.finalY + 15;
    } else {
        doc.setTextColor(22, 163, 74);
        doc.setFontSize(10);
        doc.text("No se detectan desviaciones anómalas en la flota actualmente.", 20, currentY);
        currentY += 15;
    }

    // --- SECCIÓN 2: DETALLE TÉCNICO POR UNIDAD ---
    machinesData.forEach(({ machine, stats, aiAnalysis }) => {
        if (currentY > 230) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 10, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name.toUpperCase()}`, 20, currentY + 7);
        currentY += 15;

        doc.autoTable({
            startY: currentY,
            head: [['Parámetro de Fluido', 'Media Base', 'Media Reciente', 'Desviación %']],
            body: [
                ['Aceite Motor', formatDecimal(stats.motor.baselineRate), formatDecimal(stats.motor.recentRate), `${stats.motor.deviation > 0 ? '+' : ''}${formatDecimal(stats.motor.deviation, 1)}%`],
                ['Aceite Hidráulico', formatDecimal(stats.hydraulic.baselineRate), formatDecimal(stats.hydraulic.recentRate), `${stats.hydraulic.deviation > 0 ? '+' : ''}${formatDecimal(stats.hydraulic.deviation, 1)}%`],
                ['Refrigerante', formatDecimal(stats.coolant.baselineRate), formatDecimal(stats.coolant.recentRate), `${stats.coolant.deviation > 0 ? '+' : ''}${formatDecimal(stats.coolant.deviation, 1)}%`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 8, halign: 'center' },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const valStr = data.cell.raw.replace('%', '').replace(',', '.');
                    const val = parseFloat(valStr);
                    data.cell.styles.textColor = getDeviationColor(val);
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(9);
        doc.setTextColor(79, 70, 229);
        doc.setFont("helvetica", "bolditalic");
        doc.text("ANÁLISIS DE RUPTURA DE TENDENCIA (IA):", 20, currentY);
        currentY += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        const splitAi = doc.splitTextToSize(aiAnalysis, 175);
        doc.text(splitAi, 20, currentY);
        currentY += (splitAi.length * 4) + 12;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Valores normalizados en Litros / 100 horas. Diagnóstico generado por Aridos Marraque Engine.", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
    return doc.output('datauristring').split(',')[1];
};
