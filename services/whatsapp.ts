
import { Worker, Machine, MaintenanceDefinition } from '../types';

// NOTA: En producción, estos valores deben venir de variables de entorno
const INSTANCE_ID = 'instance103444'; // Ejemplo de instancia
const TOKEN = 'your_ultramsg_token'; 
const BASE_URL = `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`;

export const sendWhatsAppMessage = async (to: string, message: string): Promise<{ success: boolean; error?: string }> => {
    // Limpiar número de teléfono (debe tener código de país, ej: 34 para España)
    let cleanPhone = to.replace(/\s+/g, '').replace('+', '');
    if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
        cleanPhone = '34' + cleanPhone;
    }

    try {
        const params = new URLSearchParams();
        params.append('token', TOKEN);
        params.append('to', cleanPhone);
        params.append('body', message);

        const response = await fetch(BASE_URL, {
            method: 'POST',
            body: params
        });

        const data = await response.json();
        return { success: data.sent === "true" || data.success === true };
    } catch (e: any) {
        console.error("Error enviando WhatsApp:", e);
        return { success: false, error: e.message };
    }
};

export const formatMaintenanceAlert = (worker: Worker, machine: Machine, def: MaintenanceDefinition): string => {
    const status = (def.remainingHours || 0) <= 0 ? '🔴 VENCIDO' : '⚠️ PRÓXIMO A VENCER';
    const hoursInfo = def.maintenanceType === 'HOURS' 
        ? `Horas restantes: ${def.remainingHours}h` 
        : `Fecha prevista: ${def.nextDate?.toLocaleDateString()}`;

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
    const testMsg = `*GMAO ARIDOS MARRAQUE*\n\n✅ Prueba de conectividad del sistema de notificaciones vía UltraMsg realizada con éxito.`;
    return sendWhatsAppMessage(phone, testMsg);
};
