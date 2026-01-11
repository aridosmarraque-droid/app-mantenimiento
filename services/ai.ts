import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analiza reporte producción: Eficiencia ${efficiency.toFixed(1)}%, Incidencias: "${comments}". Identifica causa raíz técnica y da 3 recomendaciones de mantenimiento preventivo.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("IA Production Error:", error);
        return "Error en IA: Verifique conectividad y API Key en el entorno.";
    }
};

export const analyzeFluidHealth = async (
    machineName: string,
    motorTrend: any,
    hydraulicTrend: any,
    coolantTrend: any,
    totalHours: number
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const formatSeries = (series: any[]) => 
            series.map((s: any) => `Fecha: ${s.date} | Horas: ${s.hours}h | Añadido: ${s.added}L`).join('\n');

        const prompt = `
            Actúa como Ingeniero Senior de Diagnóstico Predictivo de Maquinaria Pesada.
            Analiza la salud de fluidos de la unidad "${machineName}" (${totalHours}h totales).

            DATOS DE TENDENCIA (L/100h):
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            HISTORIAL CRONOLÓGICO (Serie Temporal):
            MOTOR:
            ${formatSeries(motorTrend.series)}
            HIDRÁULICO:
            ${formatSeries(hydraulicTrend.series)}
            REFRIGERANTE:
            ${formatSeries(coolantTrend.series)}

            REQUERIMIENTOS CRÍTICOS:
            1. Si existe una desviación >25%, rastrea hacia atrás en la serie temporal para identificar el MOMENTO EXACTO (Fecha y Horas) donde el consumo dejó de ser estable.
            2. Determina si es una "Falla de Componente" (salto brusco) o "Desgaste Acelerado" (incremento gradual).
            3. Si el consumo es alto pero la desviación es mínima (<10%), catalógalo como "Estado Operativo Nominal con Desgaste por Uso".
            4. Genera un diagnóstico profesional en Markdown:
               - **SITUACIÓN ACTUAL**: (Estado general)
               - **ANOMALÍA DETECTADA**: (Fluido y gravedad)
               - **PUNTO DE RUPTURA**: (Fecha/Hora de inicio del problema)
               - **ACCIÓN TÉCNICA RECOMENDADA**: (Inspección específica)
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });

        return response.text || "Sin diagnóstico disponible.";
    } catch (error) {
        console.error("Gemini Fluid Error:", error);
        return "Error en diagnóstico IA: Verifique configuración de clave o conexión.";
    }
};
