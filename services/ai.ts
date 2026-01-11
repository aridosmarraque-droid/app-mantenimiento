import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analiza reporte producción: Eficiencia ${efficiency.toFixed(1)}%, Incidencias: "${comments}". Identifica causa raíz y da 3 recomendaciones técnicas.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("IA Error:", error);
        return "Error en IA: Verifique configuración de clave.";
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
            Actúa como Ingeniero de Diagnóstico de Maquinaria Pesada.
            Analiza la salud de la unidad "${machineName}" (${totalHours}h totales).

            RESUMEN DE DESVIACIONES (L/100h):
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            HISTORIAL DETALLADO (Para detección de origen de avería):
            MOTOR:
            ${formatSeries(motorTrend.series)}
            HIDRÁULICO:
            ${formatSeries(hydraulicTrend.series)}
            REFRIGERANTE:
            ${formatSeries(coolantTrend.series)}

            INSTRUCCIONES TÉCNICAS:
            1. Si la desviación supera el 25%, analiza el historial para determinar el "Punto de Ruptura": ¿Cuándo empezó a dispararse el consumo exactamente?
            2. Evalúa si el incremento es repentino (fuga/rotura) o progresivo (desgaste de retenes/segmentos).
            3. Si el consumo es alto pero la desviación es <10%, catalógalo como "Estado Estable por Desgaste Natural".
            4. Responde en Markdown conciso con:
               - **DIAGNÓSTICO**: (Estado general)
               - **ANOMALÍA DETECTADA**: (Detalla qué fluido y gravedad)
               - **ORIGEN ESTIMADO**: (Indica fecha/horas donde se detecta el cambio de tendencia)
               - **ACCIÓN TÉCNICA**: (Sugerencia inmediata)
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
