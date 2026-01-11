import { jsPDF } from "jspdf";
import 'jspdf-autotable';
import { CPDailyReport, PersonalReport, OperationLog, Machine } from '../types';
import { ProductionComparison, FuelConsumptionStat, FluidTrend, formatDecimal } from './stats';

export const generateCPReportPDF = (
    report: Omit<CPDailyReport, 'id'>, 
    workerName: string,
    plannedHours: number,
    efficiency: number,
    weeklyStats?: ProductionComparison,
    monthlyStats?: ProductionComparison
): string => {
  const doc: any = new jsPDF();
  const dateStr = report.date.toLocaleDateString('es-ES');

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ARIDOS MARRAQUE", 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Parte Diario de Producción - Cantera Pura", 20, 30);
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 20, 50);
  doc.text(`Plantista: ${workerName}`, 20, 56);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 140, 50);

  let finalY = 65;
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9); 
  doc.setFont("helvetica", "bold");
  doc.text("Producción Machacadora", 20, finalY);
  finalY += 5;

  doc.autoTable({
    startY: finalY,
    head: [['Concepto', 'Horas']],
    body: [
      ['Inicio Jornada', report.crusherStart],
      ['Fin Jornada', report.crusherEnd],
      ['TOTAL PRODUCCIÓN', `${report.crusherEnd - report.crusherStart} Horas`]
    ],
    theme: 'striped',
    headStyles: { fillColor: [217, 119, 6] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
  });

  finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(29, 78, 216); 
  doc.text("Producción Molinos", 20, finalY);
  finalY += 5;

  doc.autoTable({
    startY: finalY,
    head: [['Concepto', 'Horas']],
    body: [
      ['Inicio Jornada', report.millsStart],
      ['Fin Jornada', report.millsEnd],
      ['TOTAL PRODUCCIÓN', `${report.millsEnd - report.millsStart} Horas`]
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
  });

  finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text("Rendimiento Diario (Molienda)", 20, finalY);
  finalY += 5;

  let efficiencyColor: [number, number, number] = [22, 163, 74];
  let statusText = "Excelente";
  if (efficiency < 75) {
      efficiencyColor = [220, 38, 38];
      statusText = "Bajo Rendimiento";
  } else if (efficiency < 90) {
      efficiencyColor = [202, 138, 4];
      statusText = "Aceptable";
  }

  doc.autoTable({
    startY: finalY,
    head: [['Horas Reales', 'Horas Planificadas', 'Eficiencia %', 'Estado']],
    body: [[`${report.millsEnd - report.millsStart} h`, `${plannedHours} h`, `${efficiency.toFixed(1)}%`, statusText]],
    theme: 'grid',
    headStyles: { fillColor: efficiencyColor }, 
    styles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
  });

  finalY = doc.lastAutoTable.finalY + 15;

  if (weeklyStats && monthlyStats) {
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105);
      doc.text("Tendencias de Rendimiento", 20, finalY);
      finalY += 5;

      const formatTrend = (stat: ProductionComparison) => {
          const arrow = stat.trend === 'up' ? '▲' : stat.trend === 'down' ? '▼' : '=';
          return `${arrow} ${stat.diff > 0 ? '+' : ''}${stat.diff}% vs anterior`;
      };

      doc.autoTable({
        startY: finalY,
        head: [['Periodo', 'Eficiencia Actual', 'Tendencia', 'Comparativa']],
        body: [
          ['Semanal', `${weeklyStats.current.efficiency.toFixed(1)}%`, weeklyStats.trend === 'up' ? 'MEJORA' : weeklyStats.trend === 'down' ? 'BAJA' : 'IGUAL', formatTrend(weeklyStats)],
          ['Mensual', `${monthlyStats.current.efficiency.toFixed(1)}%`, monthlyStats.trend === 'up' ? 'MEJORA' : monthlyStats.trend === 'down' ? 'BAJA' : 'IGUAL', formatTrend(monthlyStats)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 10, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold' } },
        didParseCell: function(data: any) {
             if (data.section === 'body' && data.column.index === 2) {
                 const text = data.cell.raw;
                 if (text === 'MEJORA') data.cell.styles.textColor = [22, 163, 74];
                 if (text === 'BAJA') data.cell.styles.textColor = [220, 38, 38];
             }
        }
      });
      finalY = doc.lastAutoTable.finalY + 15;
  }

  if (report.comments) {
      if (finalY > 250) { doc.addPage(); finalY = 20; }
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Comentarios / Incidencias", 20, finalY);
      const splitText = doc.splitTextToSize(report.comments, 170);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(splitText, 20, finalY + 7);
      const dim = doc.getTextDimensions(splitText);
      finalY = finalY + 7 + dim.h + 10;
  }

  if (report.aiAnalysis) {
      if (finalY > 220) { doc.addPage(); finalY = 20; }
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.setFont("helvetica", "bold");
      doc.text("Análisis Técnico Inteligente (IA)", 20, finalY);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont("helvetica", "italic");
      const splitAnalysis = doc.splitTextToSize(report.aiAnalysis, 170);
      doc.text(splitAnalysis, 20, finalY + 7);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado automáticamente por GMAO Marraque App", 105, 290, { align: 'center' });

  return doc.output('datauristring').split(',')[1];
};

export const generatePersonalReportPDF = (report: Omit<PersonalReport, 'id'>, workerName: string): string => {
  const doc: any = new jsPDF();
  const dateStr = report.date.toLocaleDateString('es-ES');
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ARIDOS MARRAQUE", 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Parte de Trabajo Personal", 20, 30);
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 20, 50);
  doc.text(`Operario: ${workerName}`, 20, 56);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 140, 50);

  doc.autoTable({
    startY: 70,
    head: [['Concepto', 'Detalle']],
    body: [['Horas Trabajadas', `${report.hours} horas`], ['Ubicación / Tajo', report.location || 'No especificado']],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105] },
    styles: { fontSize: 12, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
  });

  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Descripción de Trabajos Realizados", 20, finalY);
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(report.description, 170), 20, finalY + 10);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado automáticamente por GMAO Marraque App", 105, 290, { align: 'center' });

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
    doc.setFont("helvetica", "normal");
    doc.text(`Informe de Consumos de Gasoil - ${periodLabel}`, 20, 30);

    const tableData = machinesData.map(({ machine, stats }) => [
        machine.companyCode ? `[${machine.companyCode}] ${machine.name}` : machine.name,
        `${stats.monthly.totalLiters} L`,
        `${formatDecimal(stats.monthly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.quarterly.consumptionPerHour, 2)} L/h`,
        `${formatDecimal(stats.yearly.consumptionPerHour, 2)} L/h`,
    ]);

    doc.autoTable({
        startY: 60,
        head: [['Máquina', 'Litros Mes', 'Consumo Mes', 'Consumo Trim.', 'Consumo Año']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 60 } }
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento de control interno - GMAO Marraque", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};

export const generateFluidReportPDF = (
    machinesData: { machine: Machine, stats: any, aiAnalysis: string }[],
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
    doc.setFont("helvetica", "normal");
    doc.text(`Monitor de Salud de Fluidos - ${periodLabel}`, 20, 30);

    let currentY = 50;

    machinesData.forEach(({ machine, stats, aiAnalysis }, index) => {
        if (currentY > 230) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(245, 247, 250);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name}`, 20, currentY + 6);
        currentY += 12;

        const tableBody = [
            ['Aceite Motor', formatDecimal(stats.motor.baselineRate), formatDecimal(stats.motor.recentRate), `${stats.motor.deviation > 0 ? '+' : ''}${formatDecimal(stats.motor.deviation, 1)}%`],
            ['Aceite Hidráulico', formatDecimal(stats.hydraulic.baselineRate), formatDecimal(stats.hydraulic.recentRate), `${stats.hydraulic.deviation > 0 ? '+' : ''}${formatDecimal(stats.hydraulic.deviation, 1)}%`],
            ['Refrigerante', formatDecimal(stats.coolant.baselineRate), formatDecimal(stats.coolant.recentRate), `${stats.coolant.deviation > 0 ? '+' : ''}${formatDecimal(stats.coolant.deviation, 1)}%`],
        ];

        doc.autoTable({
            startY: currentY,
            head: [['Fluido', 'Media Histórica', 'Tendencia Rec.', 'Desviación']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 8, halign: 'center' },
            margin: { left: 20, right: 20 }
        });

        currentY = doc.lastAutoTable.finalY + 5;
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.setFont("helvetica", "bolditalic");
        doc.text("Diagnóstico IA:", 20, currentY);
        currentY += 4;
        doc.setFont("helvetica", "italic");
        doc.setTextColor(60, 60, 60);
        const splitAi = doc.splitTextToSize(aiAnalysis.substring(0, 400), 170);
        doc.text(splitAi, 20, currentY);
        currentY += (splitAi.length * 4) + 10;
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Valores expresados en L/100h. Análisis por desviación de patrón.", 105, 290, { align: 'center' });

    return doc.output('datauristring').split(',')[1];
};
