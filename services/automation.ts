import { getFleetFluidStats, getFleetFuelStatsForMonth } from './stats';
import { generateFluidReportPDF, generateFuelReportPDF } from './pdf';
import { sendEmail, EmailAttachment } from './api';
import { supabase, isConfigured } from './client';

const COMPANY_EMAIL = 'aridos@marraque.es';
const LOCAL_STORAGE_KEY = 'gmao_last_monthly_fleet_reports';

let monthlyCheckInFlight: Promise<{ triggered: boolean; monthKey: string }> | null = null;

export interface MonthlyPeriodInfo {
    monthKey: string;      // YYYY-MM
    periodName: string;    // e.g. OCTUBRE DE 2026
}

export const getPreviousMonthInfo = (referenceDate: Date = new Date()): MonthlyPeriodInfo => {
    const prevDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    const monthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const periodName = prevDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    return { monthKey, periodName };
};

const getPeriodNameFromKey = (monthKey: string): string => {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        .toUpperCase();
};

const isMissingTableError = (error: any): boolean => {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '');
    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache')
    );
};

/**
 * Genera y envía por email los informes de toda la flota correspondientes al mes anterior:
 * 1. Monitor de Fluidos (Aceites y Refrigerante)
 * 2. Monitor de Gasoil (Auditoría semafórica L/h vs media anual)
 */
export const sendPreviousMonthFleetReports = async (
    targetMonthKey?: string
): Promise<{ success: boolean; monthKey: string; fluidCount: number; fuelCount: number; error?: string }> => {
    const prevInfo = getPreviousMonthInfo();
    const monthKey = targetMonthKey || prevInfo.monthKey;
    const periodName = getPeriodNameFromKey(monthKey);

    try {
        console.log(`[AUTOMATION] Generando informes mensuales de flota (Fluidos y Gasoil) para: ${periodName}`);

        const [fluidFleetData, fuelFleetData] = await Promise.all([
            getFleetFluidStats(monthKey),
            getFleetFuelStatsForMonth(monthKey)
        ]);

        const attachments: EmailAttachment[] = [];

        if (fluidFleetData.length > 0) {
            const fluidPdf = generateFluidReportPDF(fluidFleetData, periodName);
            attachments.push({
                filename: `Monitor_Fluidos_${monthKey}.pdf`,
                content: fluidPdf
            });
        }

        if (fuelFleetData.length > 0) {
            const fuelPdf = generateFuelReportPDF(fuelFleetData, periodName);
            attachments.push({
                filename: `Monitor_Gasoil_${monthKey}.pdf`,
                content: fuelPdf
            });
        }

        const criticalFuelAlerts = fuelFleetData.filter(d => (d.stats?.fuelDeviation || 0) >= 25).length;
        const warningFuelAlerts = fuelFleetData.filter(d => {
            const dev = d.stats?.fuelDeviation || 0;
            return dev >= 10 && dev < 25;
        }).length;

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 14px; color: #0f172a;">
                <div style="background: #0f172a; color: #ffffff; padding: 20px; border-radius: 12px; margin-bottom: 16px;">
                    <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
                        ARIDOS MARRAQUE • CIERRE MENSUAL AUTOMÁTICO DE FLOTA
                    </div>
                    <div style="font-size: 20px; font-weight: 900; margin-top: 4px;">
                        Monitor de Fluidos y Monitor de Gasoil
                    </div>
                    <div style="font-size: 12px; color: #38bdf8; font-weight: 700; margin-top: 4px;">
                        PERIODO ANALIZADO: ${periodName}
                    </div>
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">
                        1. Informe Monitor de Fluidos (Flota Completa)
                    </div>
                    <p style="font-size: 12px; color: #475569; margin: 0;">
                        ${fluidFleetData.length > 0
                            ? `Se adjunta el PDF <b>Monitor_Fluidos_${monthKey}.pdf</b> con el análisis de <b>${fluidFleetData.length} unidad(es)</b> con registros de aceite motor, hidráulico y refrigerante (L/100h).`
                            : 'No se registraron suministros de fluidos (niveles) durante este periodo.'}
                    </p>
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="font-size: 13px; font-weight: 800; color: #1e293b; margin-bottom: 6px;">
                        2. Informe Monitor de Gasoil (Auditoría Semafórica)
                    </div>
                    <p style="font-size: 12px; color: #475569; margin: 0;">
                        ${fuelFleetData.length > 0
                            ? `Se adjunta el PDF <b>Monitor_Gasoil_${monthKey}.pdf</b> con <b>${fuelFleetData.length} unidad(es)</b> evaluadas frente a su media histórica (Alertas rojas &ge;25%: <b>${criticalFuelAlerts}</b>, Naranja &ge;10%: <b>${warningFuelAlerts}</b>).`
                            : 'No se registraron repostajes durante este periodo.'}
                    </p>
                </div>

                <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 14px;">
                    Envío automático mensual correspondiente al mes anterior al abrir la aplicación por primera vez en el mes.
                </p>
            </div>
        `;

        const firstAttachment = attachments[0];
        const remainingAttachments = attachments.slice(1);

        const res = await sendEmail(
            [COMPANY_EMAIL],
            `Informes Flota (Monitor Fluidos y Gasoil) - ${periodName}`,
            emailHtml,
            firstAttachment?.content,
            firstAttachment?.filename,
            remainingAttachments
        );

        if (!res.success) {
            return {
                success: false,
                monthKey,
                fluidCount: fluidFleetData.length,
                fuelCount: fuelFleetData.length,
                error: res.error
            };
        }

        return {
            success: true,
            monthKey,
            fluidCount: fluidFleetData.length,
            fuelCount: fuelFleetData.length
        };
    } catch (e: any) {
        console.error('[AUTOMATION] Error en sendPreviousMonthFleetReports:', e);
        return {
            success: false,
            monthKey,
            fluidCount: 0,
            fuelCount: 0,
            error: e?.message || 'Error generando informes mensuales.'
        };
    }
};

/**
 * Comprueba al abrir la aplicación si ya se enviaron los informes del mes anterior.
 * Usa la tabla 'mant_envios_mensuales' como bloqueo global entre todos los usuarios/dispositivos
 * para que solo se envíe una única vez el primer día del mes que alguien abra la app.
 */
export const checkAndSendMonthlyFleetReports = async (
    userRole?: string
): Promise<{ triggered: boolean; monthKey: string }> => {
    const { monthKey } = getPreviousMonthInfo();

    if (!isConfigured || !navigator.onLine) {
        return { triggered: false, monthKey };
    }

    try {
        if (localStorage.getItem(LOCAL_STORAGE_KEY) === monthKey) {
            return { triggered: false, monthKey };
        }
    } catch {
        // Ignorar errores de almacenamiento local restringido
    }

    if (monthlyCheckInFlight) {
        return monthlyCheckInFlight;
    }

    monthlyCheckInFlight = (async () => {
        try {
            // 1. Comprobar registro global en Supabase (mant_envios_mensuales)
            const { data: existing, error: selectError } = await supabase
                .from('mant_envios_mensuales')
                .select('periodo, estado')
                .eq('periodo', monthKey)
                .maybeSingle();

            if (!selectError) {
                if (existing) {
                    try { localStorage.setItem(LOCAL_STORAGE_KEY, monthKey); } catch {}
                    return { triggered: false, monthKey };
                }

                // Adquirir bloqueo atómico mediante INSERT con PK única
                const { error: insertError } = await supabase
                    .from('mant_envios_mensuales')
                    .insert({
                        periodo: monthKey,
                        estado: 'SENDING',
                        fecha_envio: new Date().toISOString()
                    });

                if (insertError) {
                    // 23505 = otro dispositivo acaba de reclamar este periodo simultáneamente
                    if (String(insertError.code || '') === '23505') {
                        try { localStorage.setItem(LOCAL_STORAGE_KEY, monthKey); } catch {}
                    }
                    return { triggered: false, monthKey };
                }

                const result = await sendPreviousMonthFleetReports(monthKey);
                if (result.success) {
                    await supabase
                        .from('mant_envios_mensuales')
                        .update({
                            estado: 'SENT',
                            fecha_envio: new Date().toISOString(),
                            detalle: `Fluidos: ${result.fluidCount} uds | Gasoil: ${result.fuelCount} uds`
                        })
                        .eq('periodo', monthKey);
                    try { localStorage.setItem(LOCAL_STORAGE_KEY, monthKey); } catch {}
                    return { triggered: true, monthKey };
                } else {
                    // Liberar bloqueo si falló el envío para poder reintentar
                    await supabase.from('mant_envios_mensuales').delete().eq('periodo', monthKey);
                    return { triggered: false, monthKey };
                }
            }

            // 2. Fallback si aún no existe la tabla 'mant_envios_mensuales' en Supabase:
            // Solo ejecutar desde sesiones Admin / Ingeniero para evitar envíos duplicados desde múltiples operarios
            if (isMissingTableError(selectError)) {
                const role = (userRole || '').toLowerCase();
                if (role !== 'admin' && role !== 'ingeniero') {
                    return { triggered: false, monthKey };
                }

                const result = await sendPreviousMonthFleetReports(monthKey);
                if (result.success) {
                    try { localStorage.setItem(LOCAL_STORAGE_KEY, monthKey); } catch {}
                    return { triggered: true, monthKey };
                }
            }

            return { triggered: false, monthKey };
        } catch (err) {
            console.error('[AUTOMATION] Error comprobando cierre mensual automático:', err);
            return { triggered: false, monthKey };
        } finally {
            monthlyCheckInFlight = null;
        }
    })();

    return monthlyCheckInFlight;
};

// Mantenida por compatibilidad
export const triggerMonthlyFluidReport = async () => {
    return sendPreviousMonthFleetReports();
};
