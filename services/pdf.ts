
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { CPDailyReport } from '../types';

export const generateCPReportPDF = (
    report: Omit<CPDailyReport, 'id'>, 
    workerName: string,
    plannedHours: number, // Nuevo parámetro
    efficiency: number    // Nuevo parámetro
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
  doc.setTextColor(180, 83, 9); // Amber-700 approx
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
    headStyles: { fillColor: [217, 119, 6] }, // Amber-600
    styles: { fontSize: 10 },
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
    }
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- MOLINOS TABLE ---
  doc.setFontSize(12);
  doc.setTextColor(29, 78, 216); // Blue-700 approx
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
    headStyles: { fillColor: [37, 99, 235] }, // Blue-600
    styles: { fontSize: 10 },
    columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' }
    }
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- EFICIENCIA / OBJETIVOS TABLE (NUEVO) ---
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74); // Green-600 approx
  doc.text("Análisis de Rendimiento (Molienda)", 20, finalY);
  finalY += 5;

  // Determinar color basado en eficiencia
  let efficiencyColor: [number, number, number] = [22, 163, 74]; // Green
  let statusText = "Excelente";
  if (efficiency < 75) {
      efficiencyColor = [220, 38, 38]; // Red
      statusText = "Bajo Rendimiento";
  } else if (efficiency < 90) {
      efficiencyColor = [202, 138, 4]; // Amber/Yellow
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

  // --- COMENTARIOS ---
  if (report.comments) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text("Comentarios / Incidencias", 20, finalY);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const splitText = doc.splitTextToSize(report.comments, 170);
      doc.text(splitText, 20, finalY + 7);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado automáticamente por GMAO Marraque App", 105, 290, { align: 'center' });

  // Return base64 string without the prefix
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};
