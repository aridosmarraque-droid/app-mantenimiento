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
    motorTrend: any,
    hydraulicTrend: any,
    coolantTrend: any,
    totalHours: number
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "API Key no configurada.";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
            Actúa como Ingeniero Jefe de Mantenimiento de Maquinaria Pesada.
            Analiza las tendencias de consumo de fluidos de la unidad "${machineName}" (Horas: ${totalHours}h).

            CONTEXTO TÉCNICO IMPORTANTE: 
            No juzgues el consumo absoluto como avería solo por ser alto. Una máquina puede tener un consumo histórico elevado (su "Baseline") pero estable. 
            Tu objetivo es detectar DESVIACIONES y RUPTURAS DE PATRÓN (Anomalías).

            DATOS DE CONSUMO (L/100h):
            1. Aceite Motor: Histórico=${motorTrend.baselineRate} vs Reciente=${motorTrend.recentRate} (Desviación: ${motorTrend.deviation}%)
            2. Aceite Hidráulico: Histórico=${hydraulicTrend.baselineRate} vs Reciente=${hydraulicTrend.recentRate} (Desviación: ${hydraulicTrend.deviation}%)
            3. Refrigerante: Histórico=${coolantTrend.baselineRate} vs Reciente=${coolantTrend.recentRate} (Desviación: ${coolantTrend.deviation}%)

            TU TAREA:
            - Identifica cuál de los tres fluidos presenta una anomalía real (desviación significativa >20%).
            - Si hay una desviación brusca en refrigerante, sospecha de fugas térmicas o culata.
            - Si hay desviación brusca en hidráulico, sospecha de rotura de latiguillo o retén de bomba.
            - Si el consumo es alto pero la desviación es baja (<10%), indica que es un comportamiento estable por desgaste natural.
            - Proporciona un diagnóstico Markdown conciso con "Estado General", "Anomalías Detectadas" y "Acción Técnica Inmediata".
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
