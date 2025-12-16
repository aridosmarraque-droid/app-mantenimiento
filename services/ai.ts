
import { GoogleGenAI } from "@google/genai";

export const analyzeProductionReport = async (
    comments: string, 
    efficiency: number,
    date: Date
): Promise<string> => {
    
    // La API Key debe venir de las variables de entorno por seguridad.
    // Si estás en local, asegúrate de tenerla configurada en tu entorno.
    const apiKey = process.env.API_KEY;

    // Si no hay key configurada, devolvemos una respuesta simulada para evitar errores en la Demo.
    if (!apiKey) {
        return "⚠️ Modo Demo: No se ha detectado una API Key válida (process.env.API_KEY). \n\n" +
               "**Simulación de respuesta del Gerente Virtual:** \n" +
               "Basado en los comentarios, parece haber un problema mecánico recurrente en la línea de molienda. " +
               "Se recomienda revisar los rodamientos del molino y verificar la tensión de las correas principales. " +
               `La eficiencia del ${efficiency.toFixed(1)}% indica una pérdida significativa de producción respecto a lo planificado.`;
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
        return "Error al conectar con el servicio de IA. Verifique su API Key y conexión.";
    }
};

