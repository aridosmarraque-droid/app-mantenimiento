import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
    try {
        return process.env.API_KEY || "";
    } catch (e) {
        return "";
    }
};

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "API Key no configurada.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            Analiza el reporte de producción:
            - Eficiencia: ${efficiency.toFixed(1)}%
            - Incidencias: "${comments}"
            Dime causa raíz probable y 3 recomendaciones técnicas.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("IA Error:", error);
        return "Error en IA.";
    }
};

export const analyzeFluidHealth = async (
    machineName: string,
    motorRate: number,
    hydraulicRate: number,
    coolantRate: number,
    totalHours: number
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "API Key no configurada.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            Actúa como Ingeniero de Mantenimiento experto en maquinaria pesada.
            Analiza los siguientes consumos de fluidos para la máquina "${machineName}" (Horas actuales: ${totalHours}):
            - Aceite Motor: ${motorRate.toFixed(3)} L/100h
            - Aceite Hidráulico: ${hydraulicRate.toFixed(3)} L/100h
            - Refrigerante: ${coolantRate.toFixed(3)} L/100h

            Tu tarea:
            1. Evalúa si estos valores son normales o indican una avería.
            2. Si hay consumos elevados, indica qué componente está fallando probablemente (ej. Culata, Segmentos, Bombas, Intercambiador, Mangueras).
            3. Sugiere pruebas diagnósticas (ej. análisis de aceite, prueba de presión de refrigerante).
            Responde en Markdown directo y profesional.
        `;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el diagnóstico.";
    } catch (error) {
        console.error("IA Fluid Error:", error);
        return "Error en diagnóstico IA.";
    }
};
