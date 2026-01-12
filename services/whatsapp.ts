
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
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                to: cleanPhone,
                message: message
            }
        });

        // Error de red o de la propia plataforma Supabase
        if (error) {
            console.error("Functions Error:", error);
            throw new Error(error.message || "Error al invocar la función del servidor");
        }
        
        // Si data es nulo o no tiene éxito según nuestra estructura de respuesta
        if (!data || data.success === false) {
            return { success: false, error: data?.error || 'La API de WhatsApp devolvió un error' };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Error crítico enviando WhatsApp:", e);
        return { success: false, error: e.message || 'Error de conexión' };
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
