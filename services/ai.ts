import { GoogleGenAI } from "@google/genai";

// Función interna para validar la presencia de la clave
const getAiInstance = () => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
        console.error("CRITICAL AI ERROR: process.env.API_KEY is missing or invalid in the current execution context.");
        console.log("Current API_KEY value type:", typeof apiKey);
        throw new Error("API_KEY_MISSING");
    }
    
    return new GoogleGenAI({ apiKey });
};

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    try {
        console.log(`[AI-DIAGNOSTIC] Analyzing production for date: ${date.toLocaleDateString()} with efficiency: ${efficiency}%`);
        const ai = getAiInstance();
        
        const prompt = `Actúa como Gerente de Planta de Aridos. Analiza el reporte del día ${date.toLocaleDateString()}. 
        Eficiencia: ${efficiency.toFixed(1)}%. 
        Incidencias reportadas: "${comments}". 
        Identifica causa técnica de baja eficiencia (si es <85%) y da 3 recomendaciones tácticas. 
        Responde en Markdown profesional.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error: any) {
        console.error("Gemini Production Error Details:", error);
        if (error.message === "API_KEY_MISSING") {
            return "ERROR CRÍTICO: La clave de API de Gemini no está configurada en el servidor/entorno. Contacte con soporte técnico.";
        }
        return "Error en diagnóstico IA: Verifique configuración de clave o conexión.";
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
        console.log(`[AI-DIAGNOSTIC] Analyzing fluids for unit: ${machineName}`);
        const ai = getAiInstance();
        
        const formatSeries = (series: any[]) => 
            series.map((s: any) => `Fecha: ${s.date} | Horas: ${s.hours}h | Añadido: ${s.added}L`).join('\n');

        const prompt = `
            Actúa como Ingeniero Senior de Diagnóstico Predictivo de Maquinaria Pesada.
            Analiza la salud de fluidos de la unidad "${machineName}" (${totalHours}h totales).

            DATOS DE TENDENCIA (L/100h):
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            HISTORIAL CRONOLÓGICO:
            MOTOR: ${formatSeries(motorTrend.series)}
            HIDRÁULICO: ${formatSeries(hydraulicTrend.series)}
            REFRIGERANTE: ${formatSeries(coolantTrend.series)}

            REQUERIMIENTOS:
            1. Si existe desviación >25%, indica el MOMENTO EXACTO (Fecha/Horas) de inicio de la anomalía.
            2. Define si es "Falla de Componente" o "Desgaste Acelerado".
            3. Estructura: **SITUACIÓN ACTUAL**, **ANOMALÍA**, **PUNTO DE RUPTURA**, **ACCIÓN RECOMENDADA**.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
        });

        return response.text || "Sin diagnóstico disponible.";
    } catch (error: any) {
        console.error("Gemini Fluid Error Details:", error);
        if (error.message === "API_KEY_MISSING") {
            return "ERROR: API_KEY no detectada en el navegador.";
        }
        return "Error en diagnóstico IA: Verifique configuración de clave o conexión.";
    }
};
