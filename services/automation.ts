import { getFleetFluidStats } from './stats';
import { generateFluidReportPDF } from './pdf';
import { sendEmail } from './api';

/**
 * IMPORTANTE: Esta función está diseñada para ser ejecutada por Supabase Edge Functions.
 * Configuración CRON recomendada en Supabase:
 * select cron.schedule('envio-fluidos-mensual', '0 23 L * *', 'select net.http_post(url:="URL_DE_TU_FUNCION")');
 * (Esto ejecuta la función a las 23:00 del último día de cada mes).
 */
export const triggerMonthlyFluidReport = async () => {
    try {
        const now = new Date();
        const currentMonthStr = now.toISOString().substring(0, 7); // YYYY-MM
        const periodName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        // 1. Obtenemos las estadísticas ya procesadas por el motor de stats
        const fleetData = await getFleetFluidStats(currentMonthStr);

        if (fleetData.length === 0) {
            console.log("No hay registros de fluidos para procesar este mes.");
            return { success: false, error: "Sin datos." };
        }

        // 2. Generamos el PDF con los promedios incluidos
        const pdfBase64 = generateFluidReportPDF(fleetData, periodName);
        
        // 3. Envío de correo
        const res = await sendEmail(
            ['aridos@marraque.es'],
            `[CIERRE MES] Informe Consolidado Fluidos - ${periodName}`,
            `<p>Hola. Se adjunta el informe de auditoría de fluidos de toda la flota correspondiente al mes de ${periodName}.</p>
             <p>Este informe incluye las tasas de consumo L/100h y la media aritmética de la serie analizada.</p>`,
            pdfBase64,
            `Informe_Fluidos_Cierre_${periodName.replace(/\s+/g, '_')}.pdf`
        );

        console.log("Tarea de automatización finalizada con éxito.");
        return res;
    } catch (e) {
        console.error("Error crítico en triggerMonthlyFluidReport:", e);
        return { success: false, error: "Error en el proceso de automatización." };
    }
};
