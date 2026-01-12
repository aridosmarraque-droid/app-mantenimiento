
import { Worker, Machine, MaintenanceDefinition } from '../types';
import { supabase, isConfigured } from './client';

export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
    if (!isConfigured) {
        console.warn("Modo Demo: WhatsApp no enviado (Supabase no configurado)");
        return { success: true };
    }

    let cleanPhone = to.replace(/\s+/g, '').replace('+', '');
    if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
        cleanPhone = '34' + cleanPhone;
    }

    try {
        console.log(`Intentando enviar WhatsApp a: ${cleanPhone}`);
        
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                to: cleanPhone,
                message: message
            }
        });

        // Log para depuración en consola del navegador
        console.log("Respuesta completa de la Edge Function:", data);

        if (error) {
            console.error("Error en invocación de función:", error);
            throw new Error(error.message || "Error al invocar el servidor de WhatsApp");
        }
        
        // Comprobar si la API de UltraMsg reportó error
        if (!data || data.success === false) {
            // Intentar extraer el mensaje de error real de UltraMsg
            const apiError = data?.raw?.error || data?.raw?.message || 'Error desconocido en UltraMsg';
            return { 
                success: false, 
                error: `API WhatsApp: ${apiError}` 
            };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Error crítico en servicio WhatsApp:", e);
        return { success: false, error: e.message || 'Error de conexión con el servidor' };
    }
};

export const formatMaintenanceAlert = (worker: Worker, machine: Machine, def: MaintenanceDefinition): string => {
    const status = (def.remainingHours || 0) <= 0 ? '🔴 VENCIDO' : '⚠️ PRÓXIMO A VENCER';
    const hoursInfo = def.maintenanceType === 'HOURS' 
        ? `Horas restantes: ${def.remainingHours}h` 
        : `Fecha prevista: ${def.nextDate ? new Date(def.nextDate).toLocaleDateString() : 'N/A'}`;

    return `*GMAO ARIDOS MARRAQUE*\n\n` +
           `*AVISO DE MANTENIMIENTO*\n` +
           `--------------------------\n` +
           `*Estado:* ${status}\n` +
           `*Máquina:* ${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name}\n` +
           `*Tarea:* ${def.name}\n` +
           `${hoursInfo}\n\n` +
           `_Por favor, registre la intervención en la APP una vez finalizada._`;
};

export const sendTestWhatsApp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    const testMsg = `*GMAO ARIDOS MARRAQUE*\n\n✅ Prueba de conectividad realizada con éxito.\nServidor: Supabase Edge Functions\nCanal: UltraMsg API`;
    return sendWhatsAppMessage(phone, testMsg);
};
