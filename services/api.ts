
import { supabase, isConfigured } from './client';

export const sendEmail = async (
    to: string[], 
    subject: string, 
    html: string, 
    attachmentBase64?: string,
    attachmentName?: string
): Promise<{ success: boolean; error?: string }> => {
    
    if (!isConfigured) {
        console.warn("Modo Demo: El email no se envía realmente.");
        return { success: true };
    }

    try {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to,
                subject,
                html,
                attachments: attachmentBase64 ? [{
                    filename: attachmentName || 'documento.pdf',
                    content: attachmentBase64
                }] : []
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error("Error sending email:", error);
        return { success: false, error: error.message || 'Error desconocido al enviar email' };
    }
};
