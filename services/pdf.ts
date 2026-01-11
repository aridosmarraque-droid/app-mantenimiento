import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { CPDailyReport, PersonalReport, OperationLog, Machine } from '../types';
import { ProductionComparison, FuelConsumptionStat, FluidTrend, formatDecimal } from './stats';

// Helper para colores semafóricos
const getDeviationColor = (dev: number): [number, number, number] => {
    if (dev > 25) return [220, 38, 38]; // Rojo
    if (dev > 10) return [217, 119, 6]; // Naranja
    return [22, 163, 74]; // Verde
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

export const generateFuelReportPDF = (machinesData: any[], periodLabel: string): string => {
    const doc: any = new jsPDF();
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("ARIDOS MARRAQUE", 15, 18);
    doc.setFontSize(12);
    doc.text(`INFORME MENSUAL DE GASOIL - ${periodLabel}`, 15, 28);

    const tableData = machinesData.map(({ machine, stats }) => [
        machine.companyCode ? `[${machine.companyCode}] ${machine.name}` : machine.name,
        `${stats.monthly.totalLiters} L`,
        `${formatDecimal(stats.monthly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.quarterly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.yearly.consumptionPerHour, 2)} L/h`,
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Unidad', 'L. Mes', 'Consumo (L/h)', 'Trimestre', 'Anual']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });

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
    doc.setFontSize(14);
    doc.text(`MONITOR DE SALUD DE FLUIDOS - ${periodLabel}`, 20, 32);

    let currentY = 50;

    // --- SECCIÓN 1: RESUMEN DE ALERTAS (TOP DESVIACIONES) ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text("RESUMEN DE ALERTAS TÉCNICAS", 20, currentY);
    currentY += 8;

    const alerts = machinesData
        .flatMap(m => [
            { machine: m.machine.name, fluid: 'Motor', dev: m.stats.motor.deviation },
            { machine: m.machine.name, fluid: 'Hidr.', dev: m.stats.hydraulic.deviation },
            { machine: m.machine.name, fluid: 'Refrig.', dev: m.stats.coolant.deviation }
        ])
        .filter(a => a.dev > 10)
        .sort((a, b) => b.dev - a.dev)
        .slice(0, 5);

    if (alerts.length > 0) {
        doc.autoTable({
            startY: currentY,
            head: [['Unidad', 'Fluido', 'Desviación %', 'Gravedad']],
            body: alerts.map(a => [
                a.machine, 
                a.fluid, 
                `${a.dev > 0 ? '+' : ''}${formatDecimal(a.dev, 1)}%`,
                a.dev > 25 ? 'ANOMALÍA CRÍTICA' : 'INCREMENTO PREVENTIVO'
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 38, 38] },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const val = parseFloat(data.cell.raw.replace('%', '').replace(',', '.'));
                    data.cell.styles.textColor = getDeviationColor(val);
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        currentY = doc.lastAutoTable.finalY + 15;
    } else {
        doc.setTextColor(22, 163, 74);
        doc.setFontSize(10);
        doc.text("No se detectan desviaciones significativas en la flota.", 20, currentY);
        currentY += 15;
    }

    // --- SECCIÓN 2: DETALLE POR MÁQUINA ---
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
            head: [['Tipo Fluido', 'Media Histórica', 'Tendencia Rec.', 'Desviación']],
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
                    const val = parseFloat(data.cell.raw.replace('%', '').replace(',', '.'));
                    data.cell.styles.textColor = getDeviationColor(val);
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        currentY = doc.lastAutoTable.finalY + 5;
        doc.setFontSize(9);
        doc.setTextColor(79, 70, 229);
        doc.setFont("helvetica", "bolditalic");
        doc.text("Análisis Predictivo IA (Series Temporales):", 20, currentY);
        currentY += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(8);
        const splitAi = doc.splitTextToSize(aiAnalysis, 170);
        doc.text(splitAi, 20, currentY);
        currentY += (splitAi.length * 4) + 15;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Valores en L/100h. Informe generado por Aridos Marraque IA Engine.", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
