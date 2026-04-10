
import { Worker, Machine, MaintenanceDefinition, PRLAssignment, CompanyPRLDocument } from '../types';
import { supabase, isConfigured } from './client';

export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string; raw?: any }> => {
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

        if (error) {
            console.error("Error en invocación de función:", error);
            throw new Error(error.message || "Error al invocar el servidor de WhatsApp");
        }
        
        // Comprobar si la API de UltraMsg reportó error
        if (!data || data.success === false) {
            const apiError = data?.raw?.error || data?.raw?.message || data?.error || 'Error desconocido';
            
            // Detección específica del error de parámetro GET
            if (apiError.includes('GET parameter') || apiError.includes('Wrong token')) {
                return {
                    success: false,
                    error: "Configuración Incorrecta: El Token debe enviarse en la URL de la Edge Function de Supabase.",
                    raw: data?.raw
                };
            }

            return { 
                success: false, 
                error: `API WhatsApp: ${apiError}`,
                raw: data?.raw
            };
        }

        return { success: true, raw: data?.raw };
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

export const formatPRLAlert = (engineer: Worker, item: PRLAssignment | CompanyPRLDocument, type: 'WORKER' | 'COMPANY'): string => {
    const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
    const status = isExpired ? '🔴 VENCIDO' : '⚠️ PRÓXIMO A VENCER';
    const itemName = 'documentTypeName' in item ? item.documentTypeName : item.name;
    const subjectName = 'workerName' in item ? item.workerName : 'Empresa Principal/Subcontrata';

    return `*PRL ARIDOS MARRAQUE*\n\n` +
           `*AVISO DE PREVENCIÓN*\n` +
           `--------------------------\n` +
           `*Estado:* ${status}\n` +
           `*Documento:* ${itemName}\n` +
           `*Asignado a:* ${subjectName}\n` +
           `*Vencimiento:* ${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}\n\n` +
           `_Por favor, revise la documentación en el panel de ingeniería._`;
};

export const sendTestWhatsApp = async (phone: string): Promise<{ success: boolean; error?: string; raw?: any }> => {
    const testMsg = `*GMAO ARIDOS MARRAQUE*\n\n✅ Prueba de conectividad realizada con éxito.\nServidor: Supabase Edge Functions\nCanal: UltraMsg API`;
    return sendWhatsAppMessage(phone, testMsg);
};
