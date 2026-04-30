
import { Machine, MaintenanceDefinition, Worker, PRLAssignment, CompanyPRLDocument } from '../types';
import { sendWhatsAppMessage, formatMaintenanceAlert, formatPRLAlert } from './whatsapp';
import { sendEmail } from './api';
import { supabase } from './client';
import { getWorkers } from './db';

const COMPANY_EMAIL = 'aridos@marraque.es';

export const checkMaintenanceThresholds = async (machine: Machine, newHours: number) => {
    const workers = await getWorkers(false);
    const responsible = workers.find(w => w.id === machine.responsibleWorkerId);

    for (const def of machine.maintenanceDefs) {
        if (!def.id) continue;

        if (def.maintenanceType === 'HOURS') {
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
        } else if (def.maintenanceType === 'DATE' && def.nextDate) {
            const next = new Date(def.nextDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Si la fecha ha vencido y no se ha notificado
            if (next <= today && !def.notifiedOverdue) {
                console.log(`[Notif] Disparando ALERTA VENCIDA (FECHA) para ${machine.name} - ${def.name}`);
                await triggerNotification(machine, def, responsible, 'OVERDUE');
                await markAsNotified(def.id, 'overdue');
            }
        }
    }
};

const triggerNotification = async (machine: Machine, def: MaintenanceDefinition, responsible: Worker | undefined, type: 'WARNING' | 'OVERDUE') => {
    const isOverdue = type === 'OVERDUE';
    const title = isOverdue ? '🔴 MANTENIMIENTO VENCIDO' : '⚠️ PREAVISO DE MANTENIMIENTO';
    
    // Preparar Mensaje WhatsApp
    if (responsible?.phone) {
        const wsMsg = formatMaintenanceAlert(responsible, machine, def);
        await sendWhatsAppMessage(responsible.phone, wsMsg);
    }

    // Preparar Email
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

export const checkPRLThresholds = async () => {
    const workers = await getWorkers(false);
    const engineer = workers.find(w => w.role?.toLowerCase() === 'ingeniero');
    
    if (!engineer || !engineer.phone) return;

    const { data: assignments, error: aError } = await supabase
        .from('prl_asignaciones')
        .select(`
            *,
            tipo:prl_tipos_documento(nombre, dias_preaviso),
            trabajador:mant_trabajadores(nombre),
            trabajador_sub:prl_trabajadores_subcontrata(nombre)
        `)
        .eq('notificado', false)
        .not('fecha_vencimiento', 'is', null);

    if (assignments) {
        for (const a of assignments) {
            const exp = new Date(a.fecha_vencimiento);
            const preaviso = a.tipo?.dias_preaviso || 30;
            const today = new Date();
            const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= preaviso) {
                const item: PRLAssignment = {
                    id: a.id,
                    documentTypeId: a.tipo_documento_id,
                    documentTypeName: a.tipo?.nombre,
                    workerName: a.trabajador?.nombre || a.trabajador_sub?.nombre,
                    issueDate: new Date(a.fecha_emision),
                    expiryDate: new Date(a.fecha_vencimiento),
                    notified: true
                };

                const msg = formatPRLAlert(engineer, item, 'WORKER');
                const { success } = await sendWhatsAppMessage(engineer.phone, msg);
                if (success) {
                    await supabase.from('prl_asignaciones').update({ notificado: true }).eq('id', a.id);
                }
            }
        }
    }

    const { data: companyDocs, error: cError } = await supabase
        .from('prl_documentos_empresa')
        .select('*')
        .eq('notificado', false)
        .not('fecha_vencimiento', 'is', null);

    if (companyDocs) {
        for (const d of companyDocs) {
            const exp = new Date(d.fecha_vencimiento);
            const preaviso = d.dias_preaviso || 30;
            const today = new Date();
            const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= preaviso) {
                const item: CompanyPRLDocument = {
                    id: d.id,
                    name: d.nombre,
                    issueDate: new Date(d.fecha_emision),
                    expiryDate: new Date(d.fecha_vencimiento),
                    warningDays: d.dias_preaviso,
                    notified: true
                };

                const msg = formatPRLAlert(engineer, item, 'COMPANY');
                const { success } = await sendWhatsAppMessage(engineer.phone, msg);
                if (success) {
                    await supabase.from('prl_documentos_empresa').update({ notificado: true }).eq('id', d.id);
                }
            }
        }
    }
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
