import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    
    if (!process.env.API_KEY) {
        console.warn("⚠️ API Key no encontrada.");
        return "⚠️ CONFIGURACIÓN REQUERIDA: \n\n" +
               "No se ha detectado la API Key de Google Gemini en el entorno.\n\n" +
               "**Simulación (Modo Demo):** \n" +
               "Basado en los comentarios, parece haber un problema mecánico recurrente. " +
               `La eficiencia del ${efficiency.toFixed(1)}% es baja. Revise los molinos.`;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
            Actúa como un Gerente de Mantenimiento y Producción Industrial senior con 20 años de experiencia en plantas de áridos y canteras.
            
            Analiza el siguiente reporte de producción diario:
            - Fecha: ${date.toLocaleDateString()}
            - Eficiencia de Producción (Horas Reales vs Planificadas): ${efficiency.toFixed(1)}%
            - Comentarios del Operario / Incidencias: "${comments}"

            Tu tarea:
            1. Identifica la causa raíz probable de la baja eficiencia o las averías mencionadas.
            2. Evalúa la gravedad de la incidencia.
            3. Proporciona 3 recomendaciones técnicas concretas y accionables para el equipo de mantenimiento o producción para evitar que esto se repita.
            4. Utiliza un tono profesional, técnico y directo.
            5. Formato de respuesta en Markdown limpio (sin bloques de código JSON).
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || "No se pudo generar el análisis.";

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Error al conectar con el servicio de IA. Verifique su API Key.";
    }
};
