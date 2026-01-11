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
        console.error("IA Error:", error);
        return "Error en IA: Verifique configuración.";
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

            CONTEXTO TÉCNICO:
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            SERIES TEMPORALES DETALLADAS (Para detección de inicio de fallo):
            MOTOR:
            ${formatSeries(motorTrend.series)}
            HIDRÁULICO:
            ${formatSeries(hydraulicTrend.series)}
            REFRIGERANTE:
            ${formatSeries(coolantTrend.series)}

            REQUERIMIENTOS DEL ANÁLISIS:
            1. Si detectas una desviación >25%, profundiza en la serie temporal para identificar el MOMENTO EXACTO (Fecha/Horas) donde la tendencia se rompió.
            2. Evalúa si el patrón es una "Ruptura Súbita" (fuga externa o rotura) o un "Desgaste Acelerado" (segmentos, retenes, bomba).
            3. Si el consumo es alto pero estable (desviación <10%), no lo clasifiques como avería, sino como "Estado Base" por vida útil.
            4. Responde con un diagnóstico Markdown muy profesional y ejecutivo:
               - **ESTADO GENERAL**: (Resumen de la unidad)
               - **DETECCIÓN DE ANOMALÍAS**: (Fluido afectado y severidad)
               - **PUNTO DE INICIO DE AVERÍA**: (Indica cuándo empezó a fallar basándote en los saltos de horas)
               - **ESTRATEGIA TÉCNICA RECOMENDADA**: (Acción inmediata)
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
