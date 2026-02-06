import { Machine, MaintenanceDefinition, Worker } from '../types';
import { sendWhatsAppMessage, formatMaintenanceAlert } from './whatsapp';
import { sendEmail } from './api';
import { supabase } from './client';

const COMPANY_EMAIL = 'aridos@marraque.es';

export const checkMaintenanceThresholds = async (machine: Machine, newHours: number) => {
    // Evitamos importar de ./db para prevenir dependencias circulares que rompen el build
    const { data: workersData } = await supabase.from('mant_trabajadores').select('*');
    const responsibleRaw = workersData?.find(w => w.id === machine.responsibleWorkerId);
    
    // Mapeo mínimo para que funcione el servicio de alertas
    const responsible: Worker | undefined = responsibleRaw ? {
        id: responsibleRaw.id,
        name: responsibleRaw.nombre,
        dni: responsibleRaw.dni,
        phone: responsibleRaw.telefono,
        role: responsibleRaw.rol,
        positionIds: []
    } : undefined;

    for (const def of machine.maintenanceDefs) {
        if (def.maintenanceType !== 'HOURS' || !def.id) continue;

        const interval = def.intervalHours || 0;
        const warning = def.warningHours || 0;
        const lastHours = def.lastMaintenanceHours || 0;
        
        const limitOverdue = lastHours + interval;
        const limitWarning = limitOverdue - warning;

        if (newHours >= limitOverdue && !def.notifiedOverdue) {
            console.log(`[Notif] Disparando ALERTA VENCIDA para ${machine.name} - ${def.name}`);
            await triggerNotification(machine, def, responsible, 'OVERDUE');
            await markAsNotified(def.id, 'overdue');
        } 
        else if (newHours >= limitWarning && newHours < limitOverdue && !def.notifiedWarning) {
            console.log(`[Notif] Disparando PREAVISO para ${machine.name} - ${def.name}`);
            await triggerNotification(machine, def, responsible, 'WARNING');
            await markAsNotified(def.id, 'warning');
        }
    }
};

const triggerNotification = async (machine: Machine, def: MaintenanceDefinition, responsible: Worker | undefined, type: 'WARNING' | 'OVERDUE') => {
    const isOverdue = type === 'OVERDUE';
    const title = isOverdue ? '🔴 MANTENIMIENTO VENCIDO' : '⚠️ PREAVISO DE MANTENIMIENTO';
    
    if (responsible?.phone) {
        const wsMsg = formatMaintenanceAlert(responsible, machine, def);
        await sendWhatsAppMessage(responsible.phone, wsMsg);
    }

    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: ${isOverdue ? '#dc2626' : '#d97706'}; border-bottom: 2px solid #eee; padding-bottom: 10px;">${title}</h2>
            <p style="font-size: 16px;"><strong>Máquina:</strong> ${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name}</p>
            <p style="font-size: 16px;"><strong>Tarea:</strong> ${def.name}</p>
            <p style="font-size: 16px;"><strong>Horas Actuales:</strong> <span style="font-family: monospace; font-weight: bold;">${machine.currentHours}h</span></p>
            <p style="font-size: 14px; color: #666; background: #f9f9f9; padding: 10px; border-radius: 5px;">${def.tasks}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Este es un aviso automático del sistema GMAO Aridos Marraque.</p>
        </div>
    `;

    await sendEmail(
        [COMPANY_EMAIL],
        `${isOverdue ? '[VENCIDO]' : '[AVISO]'} Mantenimiento: ${machine.name}`,
        emailHtml
    );
};

const markAsNotified = async (defId: string, type: 'warning' | 'overdue') => {
    const column = type === 'warning' ? 'notificado_preaviso' : 'notificado_vencido';
    const { error } = await supabase
        .from('mant_mantenimientos_def')
        .update({ [column]: true })
        .eq('id', defId);
    
    if (error) console.error("Error al marcar notificación enviada:", error);
};

export const resetNotificationFlags = async (defId: string) => {
    const { error } = await supabase
        .from('mant_mantenimientos_def')
        .update({ 
            notificado_preaviso: false, 
            notificado_vencido: false 
        })
        .eq('id', defId);
    
    if (error) console.error("Error al resetear flags de notificación:", error);
};
