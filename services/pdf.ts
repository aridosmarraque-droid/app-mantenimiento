
import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { Machine } from '../types';
import { FuelConsumptionStat, formatDecimal } from './stats';

const getDeviationColor = (dev: number): [number, number, number] => {
    if (dev > 25) return [220, 38, 38]; 
    if (dev > 10) return [245, 158, 11]; 
    return [22, 163, 74]; 
};

export const generateCPReportPDF = (report: any, workerName: string, plannedHours: number, efficiency: number): string => {
    const doc: any = new jsPDF();
    doc.setFontSize(20);
    doc.text("ARIDOS MARRAQUE - Auditoría Producción", 20, 20);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(report.date).toLocaleDateString()}`, 20, 30);
    doc.text(`Operario: ${workerName}`, 20, 35);
    
    doc.autoTable({
        startY: 45,
        head: [['Instalación', 'Inicio', 'Fin', 'Total Horas']],
        body: [
            ['Machacadora', report.crusherStart, report.crusherEnd, report.crusherEnd - report.crusherStart],
            ['Molinos / Planta', report.millsStart, report.millsEnd, report.millsEnd - report.millsStart],
        ],
        theme: 'grid'
    });

    doc.text(`Eficiencia calculada: ${efficiency.toFixed(1)}% (Plan: ${plannedHours}h)`, 20, doc.lastAutoTable.finalY + 10);
    if (report.comments) {
        doc.text("Observaciones:", 20, doc.lastAutoTable.finalY + 20);
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(report.comments, 170), 20, doc.lastAutoTable.finalY + 25);
    }

    return doc.output('datauristring').split(',')[1];
};

export const generatePersonalReportPDF = (report: any, workerName: string): string => {
    const doc = new jsPDF();
    doc.text("Aridos Marraque - Parte Personal", 20, 20);
    doc.text(`Trabajador: ${workerName}`, 20, 30);
    doc.text(`Fecha: ${new Date(report.date).toLocaleDateString()}`, 20, 35);
    doc.text(`Horas: ${report.hours}`, 20, 40);
    doc.text(`Ubicación: ${report.location || 'N/A'}`, 20, 45);
    doc.text("Tareas:", 20, 55);
    doc.text(doc.splitTextToSize(report.description || '', 170), 20, 60);
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
    doc.text("Valores calculados sobre suministros. Generado por GMAO Marraque.", 105, 285, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};

export const generateFluidReportPDF = (
    machinesData: { machine: Machine, stats: any }[],
    periodLabel: string
): string => {
    const doc: any = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ARIDOS MARRAQUE", 20, 18);
    doc.setFontSize(12);
    doc.text(`INFORME TÉCNICO INTEGRAL DE FLUIDOS - ${periodLabel}`, 20, 30);

    // --- SECCIÓN 1: RESUMEN DE ALERTAS ---
    const alertedMachines = machinesData.filter(m => 
        m.stats.motor.deviation > 25 || 
        m.stats.hydraulic.deviation > 25 || 
        m.stats.coolant.deviation > 25
    );

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("RESUMEN DE ALERTAS CRÍTICAS (>25% Desviación)", 20, 50);

    if (alertedMachines.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("No se han detectado anomalías graves en la flota durante este periodo.", 20, 60);
    } else {
        const alertRows = alertedMachines.map(m => {
            const issues = [];
            if (m.stats.motor.deviation > 25) issues.push(`Motor (+${m.stats.motor.deviation}%)`);
            if (m.stats.hydraulic.deviation > 25) issues.push(`Hidr. (+${m.stats.hydraulic.deviation}%)`);
            if (m.stats.coolant.deviation > 25) issues.push(`Refrig. (+${m.stats.coolant.deviation}%)`);
            return [
                m.machine.companyCode ? `[${m.machine.companyCode}] ${m.machine.name}` : m.machine.name,
                issues.join(', ')
            ];
        });

        doc.autoTable({
            startY: 55,
            head: [['Unidad', 'Componentes Afectados']],
            body: alertRows,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] },
            styles: { fontSize: 9 }
        });
    }

    // --- SECCIÓN 2: DETALLE POR MÁQUINA ---
    let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 70;

    machinesData.forEach(({ machine, stats }) => {
        if (currentY > 230) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 10, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name.toUpperCase()}`, 20, currentY + 7);
        currentY += 15;

        // Tabla de medias
        doc.autoTable({
            startY: currentY,
            head: [['Fluido', 'Media Base (L/100h)', 'Media Reciente (L/100h)', 'Desviación %']],
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

        currentY = doc.lastAutoTable.finalY + 10;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento técnico de auditoría preventiva. Aridos Marraque SL.", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
