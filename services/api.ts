
import { supabase, isConfigured } from './client';

export interface EmailAttachment {
    filename: string;
    content: string;
}

export const sendEmail = async (
    to: string[], 
    subject: string, 
    html: string, 
    attachmentBase64?: string,
    attachmentName?: string,
    extraAttachments?: EmailAttachment[]
): Promise<{ success: boolean; error?: string }> => {
    
    if (!isConfigured) {
        console.warn("Modo Demo: El email no se envía realmente.");
        return { success: true };
    }

    try {
        const attachments: EmailAttachment[] = [];
        if (attachmentBase64) {
            attachments.push({
                filename: attachmentName || 'documento.pdf',
                content: attachmentBase64
            });
        }
        if (extraAttachments && extraAttachments.length > 0) {
            attachments.push(...extraAttachments);
        }

        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to,
                subject,
                html,
                attachments
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error("Error sending email:", error);
        return { success: false, error: error.message || 'Error desconocido al enviar email' };
    }
};
