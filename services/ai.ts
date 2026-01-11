import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analiza reporte producción: Eficiencia ${efficiency.toFixed(1)}%, Comentarios: "${comments}". Causa raíz y 3 recomendaciones.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "Error.";
    } catch (error) {
        return "Error IA.";
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
        
        // Convertimos las series a un formato legible para la IA
        const motorSeries = motorTrend.series.map((s: any) => `${s.date}: ${s.hours}h -> +${s.added}L`).join('\n');
        const hydraulicSeries = hydraulicTrend.series.map((s: any) => `${s.date}: ${s.hours}h -> +${s.added}L`).join('\n');
        const coolantSeries = coolantTrend.series.map((s: any) => `${s.date}: ${s.hours}h -> +${s.added}L`).join('\n');

        const prompt = `
            Actúa como Ingeniero de Datos de Caterpillar/Komatsu especializado en patrones de desgaste.
            Analiza la salud de la unidad "${machineName}" (${totalHours}h totales).

            OBJETIVO: Detectar CUÁNDO y POR QUÉ se rompió la tendencia de consumo.
            
            DATOS CRUCIALES (Resumen L/100h):
            - Motor: Histórico ${motorTrend.baselineRate} vs Reciente ${motorTrend.recentRate} (Desviación ${motorTrend.deviation}%)
            - Hidráulico: Histórico ${hydraulicTrend.baselineRate} vs Reciente ${hydraulicTrend.recentRate} (Desviación ${hydraulicTrend.deviation}%)
            - Refrigerante: Histórico ${coolantTrend.baselineRate} vs Reciente ${coolantTrend.recentRate} (Desviación ${coolantTrend.deviation}%)

            SERIE CRONOLÓGICA (Últimos registros):
            MOTOR:
            ${motorSeries}
            HIDRÁULICO:
            ${hydraulicSeries}
            REFRIGERANTE:
            ${coolantSeries}

            TU TAREA:
            1. Si detectas una anomalía (>25% de desviación), identifica en qué fecha/horas aproximadas el consumo se disparó.
            2. Determina si es una fuga súbita (salto brusco) o desgaste progresivo (subida escalonada).
            3. Ignora consumos altos si han sido constantes en todo el historial (eso no es avería, es el estado base de la máquina).
            4. Proporciona un diagnóstico Markdown MUY CONCISO con:
               - [ANOMALÍA DETECTADA] (o "Estado Estable")
               - [ORIGEN TEMPORAL] (Cuándo empezó a fallar si hay fallo)
               - [ACCIÓN TÉCNICA SUGERIDA]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Usamos Pro para este análisis complejo de patrones
            contents: prompt,
        });

        return response.text || "No se pudo generar el diagnóstico.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Error en diagnóstico IA: Verifique conectividad y API Key.";
    }
};
