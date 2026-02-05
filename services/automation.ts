
import { getAllMachines } from './db';
import { getMachineFluidStats } from './stats';
import { generateFluidReportPDF } from './pdf';
import { sendEmail } from './api';

/**
 * Genera y envía el informe consolidado de fluidos de toda la flota.
 * Esta función está diseñada para ser llamada por un Cron externo el día 1 a las 07:00.
 */
export const triggerMonthlyFluidReport = async () => {
    try {
        const machines = await getAllMachines(false);
        const consolidatedData = [];
        const now = new Date();
        const periodName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        for (const m of machines) {
            const mStats = await getMachineFluidStats(m.id);
            // Solo incluimos máquinas con datos históricos para no ensuciar el informe
            if (mStats.motor.logsCount > 1 || mStats.hydraulic.logsCount > 1) {
                consolidatedData.push({ machine: m, stats: mStats });
            }
        }

        if (consolidatedData.length === 0) return { success: false, error: "Sin datos para el informe." };

        const pdfBase64 = generateFluidReportPDF(consolidatedData, periodName);
        
        const res = await sendEmail(
            ['aridos@marraque.es'],
            `[AUTOMÁTICO] Informe de Fluidos - ${periodName}`,
            `<p>Buen día. Adjuntamos la auditoría técnica de fluidos consolidada correspondiente al inicio de mes.</p>
             <p>Este informe se genera automáticamente el día 1 de cada mes a las 07:00h.</p>`,
            pdfBase64,
            `Informe_Mensual_Fluidos_${periodName.replace(/\s+/g, '_')}.pdf`
        );

        return res;
    } catch (e) {
        console.error("Error en automatización de fluidos:", e);
        return { success: false, error: "Error crítico en proceso automático." };
    }
};
