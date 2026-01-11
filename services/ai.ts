import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    // Diagnóstico de clave en consola
    const key = process.env.API_KEY;
    console.log(`[AI DIAGNOSTIC] Key status: ${key ? `Present (Starts with: ${key.substring(0, 4)}...)` : 'MISSING'}`);

    if (!key) {
        return "Error: La clave de IA no está configurada en el entorno de ejecución.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        const prompt = `Actúa como Gerente de Planta. Analiza el reporte del día ${date.toLocaleDateString()}. 
        Eficiencia: ${efficiency.toFixed(1)}%. 
        Incidencias: "${comments}". 
        Identifica causas de baja eficiencia y da 3 recomendaciones. Markdown breve.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error: any) {
        console.error("Gemini Critical Error:", error);
        return `Error de IA: ${error.message || 'Error en la conexión con Gemini'}`;
    }
};

export const analyzeFluidHealth = async (
    machineName: string,
    motorTrend: any,
    hydraulicTrend: any,
    coolantTrend: any,
    totalHours: number
): Promise<string> => {
    const key = process.env.API_KEY;
    if (!key) return "Error: API_KEY_MISSING";

    try {
        const ai = new GoogleGenAI({ apiKey: key });
        
        const formatSeries = (series: any[]) => 
            series.map((s: any) => `Fecha: ${s.date} | Horas: ${s.hours}h | Añadido: ${s.added}L`).join('\n');

        const prompt = `
            Actúa como Ingeniero Senior de Maquinaria Pesada.
            Analiza salud de fluidos de "${machineName}" (${totalHours}h).

            TENDENCIAS (L/100h):
            - Motor: Base ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Dev. ${motorTrend.deviation}%)
            - Hidráulico: Base ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Dev. ${hydraulicTrend.deviation}%)
            - Refrigerante: Base ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Dev. ${coolantTrend.deviation}%)

            HISTORIAL:
            MOTOR: ${formatSeries(motorTrend.series)}
            HIDRÁULICO: ${formatSeries(hydraulicTrend.series)}
            REFRIGERANTE: ${formatSeries(coolantTrend.series)}

            REQUISITOS:
            1. Si desviación >25%, identifica PUNTO DE RUPTURA exacto.
            2. Diagnóstico en Markdown: **SITUACIÓN**, **ANOMALÍA**, **ACCIÓN**.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });

        return response.text || "Sin diagnóstico disponible.";
    } catch (error) {
        console.error("Gemini Fluid Error:", error);
        return "Error en diagnóstico IA. Verifique configuración de clave.";
    }
};
