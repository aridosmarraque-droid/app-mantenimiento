
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
    machinesData: { machine: Machine, stats: any }[],
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

    const tableData = machinesData.map(({ machine, stats }) => {
        const dev = stats.fuelDeviation || 0;
        return [
            machine.companyCode ? `[${machine.companyCode}] ${machine.name}` : machine.name,
            `${formatDecimal(stats.monthly.totalLiters, 1)} L`,
            `${formatDecimal(stats.monthly.consumptionPerHour, 2)} L/h`,
            `${formatDecimal(stats.yearly.consumptionPerHour, 2)} L/h`,
            `${dev > 0 ? '+' : ''}${dev.toFixed(1)}%`
        ];
    });

    doc.autoTable({
        startY: 50,
        head: [['Unidad', 'L. Mes', 'Prom. Mes', 'Prom. Año', 'Desvío %']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 60 } },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
                const val = parseFloat(data.cell.raw.replace('%', '').replace('+', ''));
                if (val >= 25) {
                    data.cell.styles.fillColor = [254, 226, 226]; // Rojo claro
                    data.cell.styles.textColor = [185, 28, 28]; // Rojo oscuro
                    data.cell.styles.fontStyle = 'bold';
                } else if (val >= 10) {
                    data.cell.styles.fillColor = [255, 247, 237]; // Naranja claro
                    data.cell.styles.textColor = [194, 65, 12]; // Naranja oscuro
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Auditoría: Comparación Consumo Mensual vs Media Anual. Naranja >10%, Rojo >25%.", 105, 285, { align: 'center' });

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
    doc.text("RESUMEN DE ALERTAS CRÍTICAS (Desviación > 25%)", 20, 50);

    if (alertedMachines.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("No se han detectado anomalías de consumo en la flota (6 meses atrás).", 20, 60);
    } else {
        const alertRows = alertedMachines.map(m => {
            const issues = [];
            if (m.stats.motor.deviation > 25) issues.push(`ACEITE MOTOR (+${m.stats.motor.deviation}%)`);
            if (m.stats.hydraulic.deviation > 25) issues.push(`HIDRÁULICO (+${m.stats.hydraulic.deviation}%)`);
            if (m.stats.coolant.deviation > 25) issues.push(`REFRIGERANTE (+${m.stats.coolant.deviation}%)`);
            return [
                m.machine.companyCode ? `[${m.machine.companyCode}] ${m.machine.name}` : m.machine.name,
                issues.join('\n')
            ];
        });

        doc.autoTable({
            startY: 55,
            head: [['Unidad', 'Componentes con Consumo Excesivo']],
            body: alertRows,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] },
            styles: { fontSize: 9, cellPadding: 3 }
        });
    }

    // --- SECCIÓN 2: DETALLE POR MÁQUINA (SOLO FLUIDOS IMPLICADOS) ---
    let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 70;

    machinesData.forEach(({ machine, stats }) => {
        const problematicFluids = [];
        if (stats.motor.deviation > 25) problematicFluids.push('MOTOR');
        if (stats.hydraulic.deviation > 25) problematicFluids.push('HYDRAULIC');
        if (stats.coolant.deviation > 25) problematicFluids.push('COOLANT');

        // Si no es problemática, saltamos el detalle extenso o lo reducimos
        if (problematicFluids.length === 0) return;

        if (currentY > 200) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setTextColor(185, 28, 28);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`ALERTA: ${machine.name.toUpperCase()} - Detalle de Componentes Afectados`, 20, currentY + 6);
        currentY += 12;

        // Construir tabla dinámica solo con los fluidos implicados
        const headers = ['Fecha', 'Horas'];
        if (problematicFluids.includes('MOTOR')) headers.push('Motor (L/100h)');
        if (problematicFluids.includes('HYDRAULIC')) headers.push('Hidr. (L/100h)');
        if (problematicFluids.includes('COOLANT')) headers.push('Refrig. (L/100h)');

        const evolutionRows = stats.evolution.slice(0, 15).map((p: any) => {
            const row = [p.date, `${p.hours}h`];
            if (problematicFluids.includes('MOTOR')) row.push(p.motorRate !== null ? p.motorRate.toFixed(3) : '-');
            if (problematicFluids.includes('HYDRAULIC')) row.push(p.hydRate !== null ? p.hydRate.toFixed(3) : '-');
            if (problematicFluids.includes('COOLANT')) row.push(p.coolRate !== null ? p.coolRate.toFixed(3) : '-');
            return row;
        });

        doc.autoTable({
            startY: currentY,
            head: [headers],
            body: evolutionRows,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 7, halign: 'center' },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index >= 2) {
                    const val = parseFloat(data.cell.raw);
                    if (!isNaN(val)) {
                        // El índice depende de qué fluidos se han incluido, mapeamos de nuevo
                        const fluidName = problematicFluids[data.column.index - 2];
                        const baseline = fluidName === 'MOTOR' ? stats.motor.baselineRate : 
                                        fluidName === 'HYDRAULIC' ? stats.hydraulic.baselineRate : 
                                        stats.coolant.baselineRate;
                        if (val > baseline * 1.25) {
                            data.cell.styles.textColor = [185, 28, 28];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            }
        });

        currentY = doc.lastAutoTable.finalY + 15;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Auditoría basada en los últimos 6 meses de registros. Aridos Marraque SL.", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
