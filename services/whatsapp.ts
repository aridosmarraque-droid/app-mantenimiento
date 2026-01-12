
import { Worker, Machine, MaintenanceDefinition } from '../types';
import { supabase, isConfigured } from './client';

export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
    // Si no está configurado Supabase, simulamos éxito en modo demo
    if (!isConfigured) {
        console.warn("Modo Demo: WhatsApp no enviado (Supabase no configurado)");
        return { success: true };
    }

    // Limpiar número de teléfono (debe tener código de país, ej: 34 para España)
    let cleanPhone = to.replace(/\s+/g, '').replace('+', '');
    if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
        cleanPhone = '34' + cleanPhone;
    }

    try {
        // Llamamos a la Edge Function de Supabase para que ella haga la petición real a UltraMsg
        // Esto evita el error de CORS y oculta el TOKEN del navegador
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                to: cleanPhone,
                message: message
            }
        });

        if (error) throw error;
        
        return { success: data?.success || false, error: data?.error };
    } catch (e: any) {
        console.error("Error enviando WhatsApp vía Edge Function:", e);
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
    const testMsg = `*GMAO ARIDOS MARRAQUE*\n\n✅ Prueba de conectividad del sistema de notificaciones realizada con éxito a través de servidor seguro.`;
    return sendWhatsAppMessage(phone, testMsg);
};
