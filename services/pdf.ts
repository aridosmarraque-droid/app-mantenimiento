
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { CPDailyReport, PersonalReport } from '../types';
import { ProductionComparison } from './stats'; // Importar tipo de estadísticas

export const generateCPReportPDF = (
    report: Omit<CPDailyReport, 'id'>, 
    workerName: string,
    plannedHours: number,
    efficiency: number,
    weeklyStats?: ProductionComparison, // Nuevo parámetro opcional
    monthlyStats?: ProductionComparison // Nuevo parámetro opcional
): string => {
  // Use any to bypass type issues with jsPDF definitions in this environment
  const doc: any = new jsPDF();
  const dateStr = report.date.toLocaleDateString('es-ES');

  // --- HEADER ---
  doc.setFillColor(220, 38, 38); // Red color header
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ARIDOS MARRAQUE", 20, 20);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Parte Diario de Producción - Cantera Pura", 20, 30);

  // --- INFO BLOCK ---
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 20, 50);
  doc.text(`Plantista: ${workerName}`, 20, 56);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 140, 50);

  let finalY = 65;

  // --- MACHACADORA TABLE ---
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9); 
  doc.setFont("helvetica", "bold");
  doc.text("Producción Machacadora", 20, finalY);
  finalY += 5;

  autoTable(doc, {
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
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
    }
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- MOLINOS TABLE ---
  doc.setFontSize(12);
  doc.setTextColor(29, 78, 216); 
  doc.text("Producción Molinos", 20, finalY);
  finalY += 5;

  autoTable(doc, {
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
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
    }
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- EFICIENCIA DIARIA ---
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

  const actualHours = report.millsEnd - report.millsStart;
  
  autoTable(doc, {
    startY: finalY,
    head: [['Horas Reales', 'Horas Planificadas', 'Eficiencia %', 'Estado']],
    body: [
      [
          `${actualHours} h`, 
          `${plannedHours} h`, 
          `${efficiency.toFixed(1)}%`, 
          statusText
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: efficiencyColor }, 
    styles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- TENDENCIAS (NUEVO BLOQUE) ---
  if (weeklyStats && monthlyStats) {
      doc.setFontSize(12);
      doc.setTextColor(71, 85, 105); // Slate
      doc.text("Tendencias de Rendimiento", 20, finalY);
      finalY += 5;

      const formatTrend = (stat: ProductionComparison) => {
          const arrow = stat.trend === 'up' ? '▲' : stat.trend === 'down' ? '▼' : '=';
          return `${arrow} ${stat.diff > 0 ? '+' : ''}${stat.diff}% vs anterior`;
      };

      autoTable(doc, {
        startY: finalY,
        head: [['Periodo', 'Eficiencia Actual', 'Tendencia', 'Comparativa']],
        body: [
          [
              'Semanal', 
              `${weeklyStats.current.efficiency.toFixed(1)}%`, 
              weeklyStats.trend === 'up' ? 'MEJORA' : weeklyStats.trend === 'down' ? 'BAJA' : 'IGUAL',
              formatTrend(weeklyStats)
          ],
          [
              'Mensual', 
              `${monthlyStats.current.efficiency.toFixed(1)}%`, 
              monthlyStats.trend === 'up' ? 'MEJORA' : monthlyStats.trend === 'down' ? 'BAJA' : 'IGUAL',
              formatTrend(monthlyStats)
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 10, halign: 'center' },
        columnStyles: {
            0: { fontStyle: 'bold' }
        },
        didParseCell: function(data: any) {
             // Colorear celda de tendencia
             if (data.section === 'body' && data.column.index === 2) {
                 const text = data.cell.raw;
                 if (text === 'MEJORA') data.cell.styles.textColor = [22, 163, 74];
                 if (text === 'BAJA') data.cell.styles.textColor = [220, 38, 38];
             }
        }
      });
      
      finalY = doc.lastAutoTable.finalY + 15;
  }

  // --- COMENTARIOS ---
  if (report.comments) {
      // Check page break
      if (finalY > 250) {
          doc.addPage();
          finalY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Comentarios / Incidencias", 20, finalY);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const splitText = doc.splitTextToSize(report.comments, 170);
      doc.text(splitText, 20, finalY + 7);
      
      // Update Y based on text lines
      const dim = doc.getTextDimensions(splitText);
      finalY = finalY + 7 + dim.h + 10;
  }

  // --- ANÁLISIS IA (NUEVO BLOQUE) ---
  if (report.aiAnalysis) {
      // Check page break
      if (finalY > 220) {
          doc.addPage();
          finalY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229); // Indigo color for AI
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

  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};

export const generatePersonalReportPDF = (
    report: Omit<PersonalReport, 'id'>, 
    workerName: string
): string => {
  const doc: any = new jsPDF();
  const dateStr = report.date.toLocaleDateString('es-ES');

  // --- HEADER ---
  doc.setFillColor(30, 41, 59); // Slate-800 header
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ARIDOS MARRAQUE", 20, 20);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Parte de Trabajo Personal", 20, 30);

  // --- INFO ---
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Fecha: ${dateStr}`, 20, 50);
  doc.text(`Operario: ${workerName}`, 20, 56);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 140, 50);

  let finalY = 70;

  // --- DETAILS TABLE ---
  autoTable(doc, {
    startY: finalY,
    head: [['Concepto', 'Detalle']],
    body: [
      ['Horas Trabajadas', `${report.hours} horas`],
      ['Ubicación / Tajo', report.location || 'No especificado'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105] }, // Slate-600
    styles: { fontSize: 12, cellPadding: 4 },
    columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
    }
  });

  finalY = doc.lastAutoTable.finalY + 20;

  // --- DESCRIPTION ---
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("Descripción de Trabajos Realizados", 20, finalY);
  
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  
  const splitText = doc.splitTextToSize(report.description, 170);
  doc.text(splitText, 20, finalY + 10);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado automáticamente por GMAO Marraque App", 105, 290, { align: 'center' });

  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};

