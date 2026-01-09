
import { sendEmail } from './api';
import { Machine, MaintenanceDefinition, Worker } from '../types';

/**
 * Servicio de Notificaciones Integrado
 * Gestiona alertas de mantenimiento vencido y preavisos
 */

// Cache para evitar spam de notificaciones en la misma carga de app
const sentNotifications = new Set<string>();

export const notifyMaintenanceAlert = async (
    machine: Machine, 
    def: MaintenanceDefinition, 
    responsible?: Worker,
    type: 'WARNING' | 'OVERDUE' = 'WARNING'
) => {
    const notificationKey = `${def.id}-${type}-${new Date().toDateString()}`;
    if (sentNotifications.has(notificationKey)) return;

    const machineName = `[${machine.companyCode || 'S/C'}] ${machine.name}`;
    const responsibleName = responsible ? responsible.name : 'Responsable no asignado';
    const responsiblePhone = responsible?.phone || '';
    
    const subject = type === 'WARNING' 
        ? `⚠️ PREAVISO: Mantenimiento próximo en ${machineName}`
        : `🚨 VENCIDO: Mantenimiento pendiente en ${machineName}`;

    const remaining = def.remainingHours ?? 0;
    const hoursText = type === 'WARNING' 
        ? `faltan ${remaining} horas` 
        : `se ha pasado por ${Math.abs(remaining)} horas`;

    const html = `
        <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: ${type === 'WARNING' ? '#d97706' : '#dc2626'};">${subject}</h2>
            <p>Se ha detectado una alerta de mantenimiento programado:</p>
            <ul>
                <li><strong>Máquina:</strong> ${machineName}</li>
                <li><strong>Mantenimiento:</strong> ${def.name}</li>
                <li><strong>Estado:</strong> ${type === 'WARNING' ? 'PREAVISO' : 'VENCIDO'}</li>
                <li><strong>Contador Actual:</strong> ${machine.currentHours} h</li>
                <li><strong>Detalle:</strong> El mantenimiento ${hoursText}.</li>
                <li><strong>Responsable:</strong> ${responsibleName}</li>
            </ul>
            <hr/>
            <p style="font-size: 12px; color: #666;">Por favor, proceda a realizar las tareas: <i>${def.tasks}</i></p>
        </div>
    `;

    // 1. Enviar Email a Central
    try {
        await sendEmail(['aridos@marraque.es'], subject, html);
    } catch (e) {
        console.error("Error enviando email de alerta", e);
    }

    // 2. Simular/Enviar WhatsApp al responsable
    if (responsiblePhone) {
        const message = `${subject}\n\nMantenimiento: ${def.name}\nEstado: ${type}\nDetalle: ${hoursText}.\n\nPor favor, organice la parada de la unidad.`;
        console.log(`[WhatsApp API] Enviando a ${responsiblePhone}: ${message}`);
        // Aquí se integraría con un servicio como Twilio o una API de WhatsApp Business
    }

    sentNotifications.add(notificationKey);
};
