
import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { Machine, MaintenanceDefinition } from '../types';
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

export const generateFluidReportPDF = (
    machinesData: { machine: Machine, stats: any }[],
    periodLabel: string
): string => {
    const doc: any = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ARIDOS MARRAQUE", 20, 18);
    doc.setFontSize(11);
    doc.text(`AUDITORÍA MENSUAL DE FLUIDOS - ${periodLabel}`, 20, 30);

    // --- SECCIÓN 1: RESUMEN DE ALERTAS Y EXPLICACIÓN ---
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text("1. RESUMEN DE ALERTAS CRÍTICAS", 20, 50);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("CRITERIO: Desvío >10% vs Baseline Y consumo activo (>0L) en último registro. (0L = Reparado/Estable).", 20, 55);

    // Filtrar máquinas con alertas activas (desvío alto Y consumo reciente > 0)
    const alertedMachines = machinesData.filter(m => 
        (m.stats.motor.deviation > 10 && m.stats.motor.recentAmount > 0) || 
        (m.stats.hydraulic.deviation > 10 && m.stats.hydraulic.recentAmount > 0) || 
        (m.stats.coolant.deviation > 10 && m.stats.coolant.recentAmount > 0)
    );

    if (alertedMachines.length === 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("No se detectan averías activas por consumo de fluidos en este periodo.", 20, 65);
    } else {
        const alertRows = alertedMachines.map(m => {
            const issues = [];
            if (m.stats.motor.deviation > 10 && m.stats.motor.recentAmount > 0) issues.push(`ACEITE MOTOR: +${m.stats.motor.deviation.toFixed(1)}%`);
            if (m.stats.hydraulic.deviation > 10 && m.stats.hydraulic.recentAmount > 0) issues.push(`HIDRÁULICO: +${m.stats.hydraulic.deviation.toFixed(1)}%`);
            if (m.stats.coolant.deviation > 10 && m.stats.coolant.recentAmount > 0) issues.push(`REFRIGERANTE: +${m.stats.coolant.deviation.toFixed(1)}%`);
            
            return [
                m.machine.companyCode ? `[${m.machine.companyCode}] ${m.machine.name}` : m.machine.name,
                issues.join('\n')
            ];
        });

        doc.autoTable({
            startY: 60,
            head: [['Unidad en Avería', 'Desvíos Activos (%)']],
            body: alertRows,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] },
            styles: { fontSize: 8, cellPadding: 3 }
        });
    }

    // --- SECCIÓN 2: DETALLE POR MÁQUINA ---
    let currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 80;

    machinesData.forEach(({ machine, stats }) => {
        // Un fluido es "problemático" solo si tiene desvío Y no ha sido "reparado" (consumo 0)
        const problematicFluids = [];
        if (stats.motor.deviation > 10 && stats.motor.recentAmount > 0) problematicFluids.push('ACEITE MOTOR');
        if (stats.hydraulic.deviation > 10 && stats.hydraulic.recentAmount > 0) problematicFluids.push('HIDRÁULICO');
        if (stats.coolant.deviation > 10 && stats.coolant.recentAmount > 0) problematicFluids.push('REFRIGERANTE');

        if (problematicFluids.length === 0) return; 

        if (currentY > 230) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 10, 'F');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const machineTitle = machine.companyCode ? `[${machine.companyCode}] ${machine.name.toUpperCase()}` : machine.name.toUpperCase();
        doc.text(machineTitle, 20, currentY + 6.5);
        
        const titleWidth = doc.getTextWidth(machineTitle);
        
        doc.setFontSize(8);
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "normal");
        doc.text(` | Avería en componentes: ${problematicFluids.join(', ')}`, 20 + titleWidth + 5, currentY + 6.5);
        
        currentY += 14;

        problematicFluids.forEach(fluidName => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            
            const fieldPrefix = fluidName.includes('MOTOR') ? 'motor' : fluidName.includes('HIDR') ? 'hyd' : 'cool';
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "bold");
            doc.text(`Histórico de Rellenos: ${fluidName}`, 20, currentY);
            currentY += 4;

            // FILTRADO CRÍTICO: Solo mostrar filas donde se añadió líquido (> 0)
            const evolutionRows = stats.evolution
                .filter((p: any) => p[fieldPrefix + 'Amount'] > 0)
                .slice(0, 15)
                .map((p: any) => [
                    p.date,
                    `${p.hours}h`,
                    `${p[fieldPrefix + 'Amount'].toFixed(1)} L`,
                    `${p[fieldPrefix + 'Rate'].toFixed(3)} L/100h`
                ]);

            if (evolutionRows.length > 0) {
                doc.autoTable({
                    startY: currentY,
                    head: [['Fecha Relleno', 'Horas Máquina', 'Cantidad Añadida (L)', 'Tasa L/100h']],
                    body: evolutionRows,
                    theme: 'grid',
                    headStyles: { fillColor: [71, 85, 105] },
                    styles: { fontSize: 7, halign: 'center' },
                    columnStyles: { 2: { fontStyle: 'bold' }, 3: { fontStyle: 'bold' } }
                });
                currentY = doc.lastAutoTable.finalY + 10;
            } else {
                doc.setFontSize(7);
                doc.setFont("helvetica", "italic");
                doc.text("Sin registros de consumo activo para este componente.", 25, currentY + 5);
                currentY += 15;
            }
        });
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Informe de Auditoría Técnica. Aridos Marraque SL. Si el último consumo es 0.0L, la unidad sale automáticamente de avería.", 105, 290, { align: 'center' });

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
                    data.cell.styles.fillColor = [254, 226, 226]; 
                    data.cell.styles.textColor = [185, 28, 28]; 
                    data.cell.styles.fontStyle = 'bold';
                } else if (val >= 10) {
                    data.cell.styles.fillColor = [255, 247, 237]; 
                    data.cell.styles.textColor = [194, 65, 12]; 
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

export const generateMaintenanceReportPDF = (machines: Machine[], summary: any): string => {
    const doc: any = new jsPDF();
    const now = new Date();
    now.setHours(0,0,0,0);
    const todayStr = now.toLocaleDateString();

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ARIDOS MARRAQUE", 20, 18);
    doc.setFontSize(12);
    doc.text(`AUDITORÍA INTEGRAL DE MANTENIMIENTO PREVENTIVO`, 20, 30);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("ESTADO GENERAL DE LA FLOTA", 20, 50);
    
    doc.autoTable({
        startY: 55,
        head: [['Vencidos', 'En Preaviso', 'Total Tareas']],
        body: [[summary.overdue, summary.warning, summary.total]],
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28] },
        styles: { halign: 'center', fontSize: 12, fontStyle: 'bold' }
    });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text("1. MANTENIMIENTOS POR CONTADOR (HORAS)", 20, doc.lastAutoTable.finalY + 15);

    const hoursData: any[] = [];
    machines.forEach(m => {
        m.maintenanceDefs.filter(d => d.maintenanceType !== 'DATE').forEach(d => {
            const remaining = d.remainingHours ?? 0;
            const dueHours = (d.lastMaintenanceHours || 0) + (d.intervalHours || 0);
            const status = remaining <= 0 ? 'VENCIDO' : remaining <= (d.warningHours || 0) ? 'PREAVISO' : 'AL DÍA';
            hoursData.push([
                m.companyCode ? `[${m.companyCode}] ${m.name}` : m.name,
                d.name,
                `${m.currentHours}h`,
                `${dueHours}h`,
                `${remaining}h`,
                status
            ]);
        });
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Máquina', 'Tarea', 'H. Actual', 'H. Vencim.', 'Restantes', 'Estado']],
        body: hoursData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 5: { fontStyle: 'bold', halign: 'center' } },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
                const s = data.cell.raw;
                if (s === 'VENCIDO') data.cell.styles.textColor = [185, 28, 28];
                else if (s === 'PREAVISO') data.cell.styles.textColor = [194, 65, 12];
                else data.cell.styles.textColor = [22, 163, 74];
            }
        }
    });

    if (doc.lastAutoTable.finalY > 200) doc.addPage();
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text("2. MANTENIMIENTOS POR CALENDARIO (DÍAS)", 20, doc.lastAutoTable.finalY + 15);

    const datesData: any[] = [];
    machines.forEach(m => {
        m.maintenanceDefs.filter(d => d.maintenanceType === 'DATE').forEach(d => {
            const nextDate = d.nextDate ? new Date(d.nextDate) : null;
            let diffDays = 0;
            if (nextDate) {
                nextDate.setHours(0,0,0,0);
                diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            }
            const status = diffDays <= 0 ? 'VENCIDO' : diffDays <= 15 ? 'PREAVISO' : 'AL DÍA';
            
            datesData.push([
                m.companyCode ? `[${m.companyCode}] ${m.name}` : m.name,
                d.name,
                todayStr, 
                nextDate ? nextDate.toLocaleDateString() : 'N/A',
                diffDays <= 0 ? 'PLAZO CUMPLIDO' : `${diffDays} días`,
                status
            ]);
        });
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Máquina', 'Tarea', 'Fecha Hoy', 'Vencimiento', 'Días Rest.', 'Estado']],
        body: datesData,
        theme: 'grid',
        headStyles: { fillColor: [107, 70, 193] }, 
        styles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 5: { fontStyle: 'bold', halign: 'center' } },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
                const s = data.cell.raw;
                if (s === 'VENCIDO') data.cell.styles.textColor = [185, 28, 28];
                else if (s === 'PREAVISO') data.cell.styles.textColor = [194, 65, 12];
                else data.cell.styles.textColor = [22, 163, 74];
            }
        }
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Informe generado automáticamente el ${new Date().toLocaleString()} - Aridos Marraque SL.`, 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
