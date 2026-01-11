import { GoogleGenAI } from "@google/genai";

/**
 * Obtiene la clave de API de forma segura.
 * Intenta primero process.env.API_KEY y registra el estado en consola.
 */
const getApiKey = (): string | undefined => {
    const key = process.env.API_KEY;
    if (!key || key === 'undefined' || key === '') {
        console.warn("[AI SERVICE] process.env.API_KEY is missing. User may need to select key via UI.");
        return undefined;
    }
    console.log(`[AI SERVICE] API_KEY found (Starts with: ${key.substring(0, 4)}...)`);
    return key;
};

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        return "ERROR: No se detecta clave de API. Por favor, pulsa el botón 'Configurar Clave IA' en el panel.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Actúa como Gerente de Planta. Analiza el reporte del día ${date.toLocaleDateString()}. 
        Eficiencia calculada: ${efficiency.toFixed(1)}%. 
        Incidencias reportadas: "${comments}". 
        Instrucciones: Si la eficiencia es <90%, identifica causas técnicas probables basándote en los comentarios. 
        Da 3 recomendaciones tácticas en Markdown profesional y breve.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error: any) {
        console.error("[GEMINI ERROR]", error);
        return `Error de conexión con Gemini: ${error.message}`;
    }
};

export const analyzeFluidHealth = async (
    machineName: string,
    motorTrend: any,
    hydraulicTrend: any,
    coolantTrend: any,
    totalHours: number
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "Error: API_KEY_MISSING. Seleccione una clave en el panel superior.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const formatSeries = (series: any[]) => 
            series.map((s: any) => `Fecha: ${s.date} | Horas: ${s.hours}h | Añadido: ${s.added}L`).join('\n');

        const prompt = `
            Actúa como Ingeniero Senior de Maquinaria Pesada.
            Analiza salud de fluidos de "${machineName}" (${totalHours}h totales).

            DATOS DE TENDENCIA (L/100h):
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            REQUERIMIENTOS:
            1. Evalúa si la desviación indica un fallo inminente o desgaste normal.
            2. Estructura: **DIAGNÓSTICO**, **RIESGO**, **ACCIÓN**.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });

        return response.text || "Sin diagnóstico disponible.";
    } catch (error: any) {
        console.error("[GEMINI FLUID ERROR]", error);
        return `Error en diagnóstico IA: ${error.message}`;
    }
};
