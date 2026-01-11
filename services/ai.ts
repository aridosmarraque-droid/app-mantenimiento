import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    try {
        // Inicialización interna para asegurar captura de API_KEY en runtime
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Actúa como Gerente de Planta. Analiza el reporte de producción del día ${date.toLocaleDateString()}. 
        Eficiencia calculada: ${efficiency.toFixed(1)}%. 
        Comentarios del operario: "${comments}". 
        Identifica posibles causas técnicas de baja eficiencia si aplica y propón 3 puntos de mejora inmediata. 
        Responde en formato Markdown ejecutivo.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("IA Production Error:", error);
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
            3. Genera un diagnóstico profesional en Markdown:
               - **SITUACIÓN ACTUAL**: (Estado general)
               - **ANOMALÍA DETECTADA**: (Fluido y gravedad)
               - **PUNTO DE RUPTURA**: (Identifica cuándo empezó a fallar basándote en los datos)
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
