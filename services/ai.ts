
import { GoogleGenAI } from "@google/genai";

// Configurar API Key de forma segura o simular si no existe
// @ts-ignore
const apiKey = import.meta.env.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : undefined) || 'demo-key';

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    
    // Si no hay key real o es demo, devolver simulación para evitar errores
    if (apiKey === 'demo-key' || !apiKey) {
        return "⚠️ Modo Demo: No se ha configurado una API Key válida para Gemini. \n\n" +
               "Simulación de respuesta: \n" +
               "Basado en los comentarios, parece haber un problema mecánico recurrente. " +
               "Se recomienda revisar los rodamientos del molino y verificar la tensión de las correas. " +
               "La eficiencia del " + efficiency.toFixed(1) + "% indica una pérdida significativa de producción.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
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
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "No se pudo generar el análisis.";

    } catch (error) {
        console.error("Error llamando a Gemini:", error);
        return "Error al conectar con el servicio de IA. Verifique la conexión o la API Key.";
    }
};
