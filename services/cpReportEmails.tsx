import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
    CPDailyReport,
    CostCenter,
    Machine,
    OperationLog,
    Worker
} from '../types';
import {
    getAllMachines,
    getAllOperationLogsByRange,
    getCostCenters,
    getCPReportsByRange,
    getCRReportsByRange,
    getDailyAuditLogs,
    getWorkers,
    toLocalDateString
} from './db';
import { getPerformanceDashboardStats, PerformanceDashboardData } from './stats';
import { sendEmail } from './api';
import { renderReactToPdfBase64 } from './pdfCapture';
import { ProductionDashboardView } from '../components/admin/ProductionDashboard';
import {
    DailyAuditReportContent,
    WorkerAuditEntry,
    computeWorkerReports
} from '../components/admin/DailyAuditViewer';
import {
    FuelAccumulatedSummary,
    FuelAccumulatedView,
    computeFuelAccumulatedData
} from '../components/reports/FuelAccumulatedView';

const COMPANY_EMAIL = 'aridos@marraque.es';

const escapeHtml = (str: string): string =>
    String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const formatDisplayDate = (iso: string): string => {
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
};

const decimalToTime = (decimal: number): string => {
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

// --- FALLBACKS VECTORIALES (solo en caso excepcional de fallo de captura DOM) ---

const fallbackPerformancePDF = (stats: PerformanceDashboardData, displayDate: string): string => {
    const doc: any = new jsPDF();
    doc.setFontSize(18);
    doc.text('ARIDOS MARRAQUE - Rendimiento de Plantas', 15, 20);
    doc.setFontSize(10);
    doc.text(`Fecha de análisis: ${displayDate}`, 15, 28);
    doc.autoTable({
        startY: 36,
        head: [['Periodo', 'Eficiencia', 'Dif.', 'Real', 'Plan']],
        body: [
            ['Rendimiento Hoy', `${stats.daily.current.efficiency.toFixed(1)}%`, `${stats.daily.diff > 0 ? '+' : ''}${stats.daily.diff}%`, `${stats.daily.current.totalActualHours}h`, `${stats.daily.current.totalPlannedHours}h`],
            ['Rendimiento Semanal', `${stats.weekly.current.efficiency.toFixed(1)}%`, `${stats.weekly.diff > 0 ? '+' : ''}${stats.weekly.diff}%`, `${stats.weekly.current.totalActualHours}h`, `${stats.weekly.current.totalPlannedHours}h`],
            ['Rendimiento Mensual', `${stats.monthly.current.efficiency.toFixed(1)}%`, `${stats.monthly.diff > 0 ? '+' : ''}${stats.monthly.diff}%`, `${stats.monthly.current.totalActualHours}h`, `${stats.monthly.current.totalPlannedHours}h`],
            ['Rendimiento Anual', `${stats.yearly.current.efficiency.toFixed(1)}%`, `${stats.yearly.diff > 0 ? '+' : ''}${stats.yearly.diff}%`, `${stats.yearly.current.totalActualHours}h`, `${stats.yearly.current.totalPlannedHours}h`]
        ],
        theme: 'grid'
    });
    return doc.output('datauristring').split(',')[1];
};

const fallbackAuditPDF = (
    displayDate: string,
    workerReports: WorkerAuditEntry[],
    ops: OperationLog[],
    machines: Machine[],
    workers: Worker[]
): string => {
    const doc: any = new jsPDF();
    doc.setFontSize(16);
    doc.text(`ARIDOS MARRAQUE - Auditoría Diaria (${displayDate})`, 15, 20);
    doc.autoTable({
        startY: 30,
        head: [['Operario', 'Plan', 'Real', 'Estado']],
        body: workerReports.map(e => [
            e.worker.name,
            `${e.worker.expectedHours || 8}h`,
            `${e.totalHours.toFixed(1)}h`,
            e.totalHours === 0 ? 'No Presentado' : e.totalHours < (e.worker.expectedHours || 0) ? 'Incompleto' : 'Completo'
        ]),
        theme: 'grid'
    });
    if (ops.length > 0) {
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Máquina', 'Operario', 'Tipo', 'Horas']],
            body: ops.map(o => [
                machines.find(m => m.id === o.machineId)?.name || 'Desconocida',
                workers.find(w => w.id === o.workerId)?.name || 'Desconocido',
                o.type,
                `${o.hoursAtExecution}h`
            ]),
            theme: 'grid'
        });
    }
    return doc.output('datauristring').split(',')[1];
};

const fallbackFuelAccumulatedPDF = (summary: FuelAccumulatedSummary): string => {
    const doc: any = new jsPDF();
    doc.setFontSize(16);
    doc.text(`ARIDOS MARRAQUE - Gasoil Acumulado (${summary.monthLabel})`, 15, 20);
    doc.setFontSize(11);
    doc.text(`Periodo: ${summary.displayStartDate} al ${summary.displayEndDate} | Total: ${summary.grandTotal.toFixed(1)} L`, 15, 28);
    doc.autoTable({
        startY: 36,
        head: [['Código', 'Unidad', 'Centro', 'Rep.', 'Día (L)', 'Acumulado (L)']],
        body: summary.machineRows.map(r => [
            r.code,
            r.name,
            r.centerName,
            r.refuelingCount,
            r.dayLiters.toFixed(1),
            r.accumulatedLiters.toFixed(1)
        ]),
        theme: 'grid'
    });
    return doc.output('datauristring').split(',')[1];
};

// --- CONSTRUCTORES DE HTML PARA CUERPO DE EMAIL ---

const buildPerformanceEmailHtml = (
    report: Omit<CPDailyReport, 'id'>,
    workerName: string,
    displayDate: string,
    stats: PerformanceDashboardData
): string => {
    const kpiRows = [
        { title: 'Rendimiento Hoy', comp: stats.daily, dot: '#f59e0b' },
        { title: 'Rendimiento Semanal', comp: stats.weekly, dot: '#2563eb' },
        { title: 'Rendimiento Mensual', comp: stats.monthly, dot: '#4f46e5' },
        { title: 'Rendimiento Anual', comp: stats.yearly, dot: '#1e293b' }
    ];

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 16px; color: #0f172a;">
        <div style="background: #ffffff; padding: 16px 20px; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: 800; color: #0f172a;">Rendimiento de Plantas</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">
                ARIDOS MARRAQUE • Parte Cantera Pura (${displayDate}) • Operario: ${escapeHtml(workerName || 'N/A')}
            </div>
        </div>

        ${kpiRows.map(({ title, comp, dot }) => {
            const eff = comp.current.efficiency;
            const effColor = eff >= 85 ? '#16a34a' : eff >= 60 ? '#1e293b' : '#dc2626';
            const barColor = eff >= 85 ? '#22c55e' : eff >= 60 ? '#3b82f6' : '#ef4444';
            const barWidth = Math.min(eff, 100);
            return `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 12px; overflow: hidden;">
                <table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px;">
                    <tr>
                        <td style="vertical-align: middle;">
                            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:${dot}; margin-right:6px;"></span>${title}
                            </div>
                            <div style="margin-top: 4px;">
                                <span style="font-size: 28px; font-weight: 900; color: ${effColor};">${eff.toFixed(1)}%</span>
                                <span style="display:inline-block; margin-left: 8px; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #475569;">
                                    ${comp.diff > 0 ? '+' : ''}${comp.diff}%
                                </span>
                            </div>
                        </td>
                        <td style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 16px; width: 110px;">
                            <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Real</div>
                            <div style="font-family: monospace; font-weight: 700; font-size: 13px; color: #334155;">${comp.current.totalActualHours}h</div>
                            <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-top: 6px;">Plan</div>
                            <div style="font-family: monospace; font-weight: 700; font-size: 13px; color: #64748b;">${comp.current.totalPlannedHours}h</div>
                        </td>
                    </tr>
                </table>
                <div style="height: 5px; background: #f1f5f9; width: 100%;">
                    <div style="height: 5px; background: ${barColor}; width: ${barWidth}%;"></div>
                </div>
            </div>`;
        }).join('')}

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 12px; font-size: 11px; color: #92400e;">
            <b>Resumen del parte guardado:</b> Machacadora ${(report.crusherEnd - report.crusherStart).toFixed(2)}h • Molinos ${(report.millsEnd - report.millsStart).toFixed(2)}h
            ${report.comments ? `<br/><i>Obs.: ${escapeHtml(report.comments)}</i>` : ''}
        </div>
        <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 14px;">
            Se adjunta el PDF visual del Dashboard Rendimiento de Plantas.
        </p>
    </div>`;
};

const buildDailyAuditEmailHtml = (
    displayDate: string,
    auditData: { ops: OperationLog[]; cp: CPDailyReport[]; cr: any[] },
    workers: Worker[],
    machines: Machine[],
    centers: CostCenter[],
    workerReports: WorkerAuditEntry[]
): string => {
    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || 'Desconocido';
    const getMachineName = (id: string) => {
        const m = machines.find(mac => mac.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : 'General / Sin Asignar';
    };

    const opLabels: Record<string, { label: string; bg: string; color: string }> = {
        LEVELS: { label: 'Niveles', bg: '#eff6ff', color: '#2563eb' },
        BREAKDOWN: { label: 'Avería', bg: '#fef2f2', color: '#dc2626' },
        MAINTENANCE: { label: 'Mantenimiento', bg: '#fffbeb', color: '#d97706' },
        REFUELING: { label: 'Repostaje', bg: '#f0fdf4', color: '#16a34a' },
        SCHEDULED: { label: 'Programado', bg: '#faf5ff', color: '#9333ea' }
    };

    const plantHtml = (auditData.cp.length === 0 && auditData.cr.length === 0)
        ? `<div style="background:#ffffff; border:2px dashed #e2e8f0; border-radius:14px; padding:20px; text-align:center; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Sin partes de planta para hoy</div>`
        : [
            ...auditData.cp.map(r => `
                <div style="background:#ffffff; border:1px solid #fef3c7; border-radius:14px; padding:16px; margin-bottom:10px;">
                    <div style="font-weight:800; color:#1e293b; font-size:14px;">Cantera Pura</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">${escapeHtml(getWorkerName(r.workerId))}</div>
                    <table width="100%" cellpadding="0" cellspacing="6">
                        <tr>
                            <td style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px; width:50%;">
                                <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Machacadora</div>
                                <div style="font-family:monospace; font-weight:700; font-size:13px; color:#334155;">${decimalToTime(r.crusherStart)} → ${decimalToTime(r.crusherEnd)}</div>
                                <div style="font-size:11px; font-weight:800; color:#b45309; margin-top:4px;">Total: ${(r.crusherEnd - r.crusherStart).toFixed(2)}h</div>
                            </td>
                            <td style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px; width:50%;">
                                <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Molinos</div>
                                <div style="font-family:monospace; font-weight:700; font-size:13px; color:#334155;">${decimalToTime(r.millsStart)} → ${decimalToTime(r.millsEnd)}</div>
                                <div style="font-size:11px; font-weight:800; color:#b45309; margin-top:4px;">Total: ${(r.millsEnd - r.millsStart).toFixed(2)}h</div>
                            </td>
                        </tr>
                    </table>
                    ${r.comments ? `<div style="margin-top:8px; padding:8px 10px; background:#fffbeb; border-radius:8px; font-size:11px; color:#475569; font-style:italic;">${escapeHtml(r.comments)}</div>` : ''}
                </div>
            `),
            ...auditData.cr.map(r => `
                <div style="background:#ffffff; border:1px solid #ccfbf1; border-radius:14px; padding:16px; margin-bottom:10px;">
                    <div style="font-weight:800; color:#1e293b; font-size:14px;">Canto Rodado</div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:10px;">${escapeHtml(getWorkerName(r.workerId))}</div>
                    <table width="100%" cellpadding="0" cellspacing="6">
                        <tr>
                            <td style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px; width:50%;">
                                <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Lavado</div>
                                <div style="font-family:monospace; font-weight:700; font-size:13px; color:#334155;">${r.washingStart.toFixed(1)} → ${r.washingEnd.toFixed(1)}</div>
                                <div style="font-size:11px; font-weight:800; color:#0f766e; margin-top:4px;">Total: ${(r.washingEnd - r.washingStart).toFixed(1)}h</div>
                            </td>
                            <td style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:10px; width:50%;">
                                <div style="font-size:9px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Trituración</div>
                                <div style="font-family:monospace; font-weight:700; font-size:13px; color:#334155;">${r.trituracion_inicio.toFixed(1)} → ${r.trituracion_fin.toFixed(1)}</div>
                                <div style="font-size:11px; font-weight:800; color:#0f766e; margin-top:4px;">Total: ${(r.trituracion_fin - r.trituracion_inicio).toFixed(1)}h</div>
                            </td>
                        </tr>
                    </table>
                    ${r.comments ? `<div style="margin-top:8px; padding:8px 10px; background:#f0fdfa; border-radius:8px; font-size:11px; color:#475569; font-style:italic;">${escapeHtml(r.comments)}</div>` : ''}
                </div>
            `)
        ].join('');

    const opsHtml = auditData.ops.length === 0
        ? `<div style="background:#ffffff; border:2px dashed #e2e8f0; border-radius:14px; padding:18px; text-align:center; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase;">Sin registros de maquinaria para hoy</div>`
        : auditData.ops.map(log => {
            const c = opLabels[log.type] || opLabels.LEVELS;
            let detail = '';
            if (log.type === 'REFUELING' && log.fuelLitres) {
                detail = `<div style="display:inline-block; background:#f0fdf4; color:#15803d; font-weight:800; font-size:12px; padding:4px 8px; border-radius:8px;">${log.fuelLitres} Litros</div>`;
            } else if (log.type === 'BREAKDOWN') {
                detail = `<div style="background:#fef2f2; border:1px solid #fee2e2; padding:8px; border-radius:8px; font-size:11px;"><b>Avería:</b> ${escapeHtml(log.breakdownCause || '')}<br/><b>Solución:</b> ${escapeHtml(log.breakdownSolution || '')}</div>`;
            } else if (log.type === 'MAINTENANCE' || log.type === 'SCHEDULED') {
                detail = `<div style="background:#fffbeb; border:1px solid #fef3c7; padding:8px; border-radius:8px; font-size:11px;"><b>${escapeHtml(log.description || 'Sin descripción')}</b>${log.materials ? `<br/><i>${escapeHtml(log.materials)}</i>` : ''}</div>`;
            } else if (log.type === 'LEVELS') {
                detail = `<div style="font-size:11px; color:#2563eb; font-weight:700;">Motor: ${log.motorOil ?? 0}L • Hidr: ${log.hydraulicOil ?? 0}L • Refrig: ${log.coolant ?? 0}L</div>`;
            }
            return `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin-bottom:10px;">
                <div style="font-weight:800; font-size:12px; color:#1e293b;">
                    ${escapeHtml(getMachineName(log.machineId))}
                    <span style="background:${c.bg}; color:${c.color}; font-size:9px; font-weight:800; padding:2px 8px; border-radius:999px; text-transform:uppercase; margin-left:6px;">${c.label}</span>
                </div>
                <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin:3px 0 8px;">${escapeHtml(getWorkerName(log.workerId))} • ${log.hoursAtExecution}h</div>
                ${detail}
            </div>`;
        }).join('');

    const workersHtml = workerReports.map(entry => {
        const expected = entry.worker.expectedHours || 0;
        const status = entry.totalHours === 0
            ? { label: 'No Presentado', bg: '#fef2f2', color: '#dc2626' }
            : entry.totalHours < expected
                ? { label: 'Incompleto', bg: '#fff7ed', color: '#ea580c' }
                : entry.totalHours === expected
                    ? { label: 'Jornada Completa', bg: '#f0fdf4', color: '#16a34a' }
                    : { label: 'Horas Extras', bg: '#eff6ff', color: '#2563eb' };

        return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; margin-bottom:12px; overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${status.bg}; padding:12px 14px; border-bottom:1px solid #f1f5f9;">
                <tr>
                    <td>
                        <div style="font-weight:800; font-size:13px; color:#1e293b; text-transform:uppercase;">${escapeHtml(entry.worker.name)}</div>
                        <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Plan: ${entry.worker.expectedHours || 8}h</div>
                    </td>
                    <td style="text-align:right;">
                        <div style="font-size:16px; font-weight:900; color:${status.color};">${entry.totalHours.toFixed(1)}h</div>
                        <div style="font-size:9px; font-weight:800; color:${status.color}; text-transform:uppercase;">${status.label}</div>
                    </td>
                </tr>
            </table>
            ${entry.reports.length === 0
                ? `<div style="padding:14px; text-align:center; font-size:11px; font-weight:700; color:#f87171; text-transform:uppercase;">Parte no presentado</div>`
                : entry.reports.map(rep => `
                    <table width="100%" cellpadding="0" cellspacing="0" style="padding:10px 14px; border-bottom:1px solid #f8fafc;">
                        <tr>
                            <td>
                                <div style="font-weight:700; font-size:12px; color:#334155;">${escapeHtml(getMachineName(rep.machineId || ''))}</div>
                                <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">${escapeHtml(centers.find(c => c.id === rep.costCenterId)?.name || 'Sin Centro')}</div>
                            </td>
                            <td style="text-align:right; font-weight:900; font-size:13px; color:#1e293b;">${rep.hours.toFixed(1)}h</td>
                        </tr>
                    </table>
                `).join('')
            }
        </div>`;
    }).join('');

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 16px; color: #0f172a;">
        <div style="background:#ffffff; padding:16px 20px; border-radius:14px; border:1px solid #e2e8f0; margin-bottom:18px;">
            <div style="font-size:18px; font-weight:800; color:#0f172a;">Auditoría Diaria Integral</div>
            <div style="font-size:11px; font-weight:700; color:#2563eb; text-transform:uppercase;">ARIDOS MARRAQUE • Fecha: ${displayDate}</div>
        </div>

        <div style="font-size:13px; font-weight:900; color:#1e293b; text-transform:uppercase; border-left:4px solid #f59e0b; padding-left:8px; margin-bottom:10px;">1. Producción y Plantas</div>
        ${plantHtml}

        <div style="font-size:13px; font-weight:900; color:#1e293b; text-transform:uppercase; border-left:4px solid #4f46e5; padding-left:8px; margin:18px 0 10px;">2. Registros de Maquinaria</div>
        ${opsHtml}

        <div style="font-size:13px; font-weight:900; color:#1e293b; text-transform:uppercase; border-left:4px solid #16a34a; padding-left:8px; margin:18px 0 10px;">3. Partes de Trabajo Personal</div>
        ${workersHtml}

        <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 14px;">
            Se adjunta el PDF visual completo de la Auditoría Diaria Integral de Partes.
        </p>
    </div>`;
};

const buildFuelAccumulatedEmailHtml = (summary: FuelAccumulatedSummary): string => {
    const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 16px; color: #0f172a;">
        <div style="background: #0f172a; color: #ffffff; padding: 20px; border-radius: 14px; margin-bottom: 16px;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
                ARIDOS MARRAQUE • ${summary.monthLabel} (${summary.displayStartDate} - ${summary.displayEndDate})
            </div>
            <div style="font-size: 20px; font-weight: 900; margin-top: 4px;">Consumo Acumulado de Gasoil</div>
            <div style="margin-top: 12px;">
                <span style="font-size: 32px; font-weight: 900; color: #4ade80;">${fmt(summary.grandTotal)} L</span>
                <span style="font-size: 12px; color: #cbd5e1; margin-left: 12px;">Consumo del día (${summary.displayEndDate}): <b>${fmt(summary.dayTotal)} L</b></span>
            </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 16px;">
            <div style="padding: 12px 16px; background: #f1f5f9; font-weight: 800; font-size: 12px; text-transform: uppercase; color: #334155;">
                Acumulado por Unidad / Máquina
            </div>
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #1e293b; color: #ffffff; font-size: 10px; text-transform: uppercase;">
                        <th align="left">Unidad</th>
                        <th align="left">Centro</th>
                        <th align="center">Rep.</th>
                        <th align="right">Día</th>
                        <th align="right">Acum. Mes</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.machineRows.length === 0
                        ? `<tr><td colspan="5" align="center" style="padding: 20px; color: #94a3b8;">No hay consumos registrados en este periodo.</td></tr>`
                        : summary.machineRows.map((r, i) => `
                        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                            <td><b>${r.code !== '---' ? `[${escapeHtml(r.code)}] ` : ''}${escapeHtml(r.name)}</b></td>
                            <td style="color: #64748b; font-size: 11px;">${escapeHtml(r.centerName)}</td>
                            <td align="center">${r.refuelingCount}</td>
                            <td align="right" style="font-family: monospace;">${r.dayLiters > 0 ? `${fmt(r.dayLiters)} L` : '-'}</td>
                            <td align="right" style="font-family: monospace; font-weight: 800; color: #15803d;">${fmt(r.accumulatedLiters)} L</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #0f172a; color: #ffffff; font-weight: 900;">
                        <td colspan="3" align="right">TOTAL ACUMULADO</td>
                        <td align="right" style="font-family: monospace;">${fmt(summary.dayTotal)} L</td>
                        <td align="right" style="font-family: monospace; color: #4ade80;">${fmt(summary.grandTotal)} L</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <p style="font-size: 11px; color: #64748b; text-align: center;">
            Se adjunta el PDF con el detalle acumulado por unidad y la evolución diaria del mes hasta la fecha.
        </p>
    </div>`;
};

// --- ORQUESTADOR PRINCIPAL ---

export const sendCPTriggerEmails = async (
    reportData: Omit<CPDailyReport, 'id'>,
    workerName: string
): Promise<void> => {
    const reportDateStr = toLocalDateString(reportData.date);
    const [year, month, day] = reportDateStr.split('-').map(Number);
    const reportLocalDate = new Date(year, month - 1, day);
    const monthStart = new Date(year, month - 1, 1);
    const displayDate = formatDisplayDate(reportDateStr);

    // 1. Cargar en paralelo todos los datos de los 3 informes
    const [
        perfStats,
        auditLogs,
        cpReports,
        crReports,
        workers,
        machines,
        centers,
        refuelingLogs
    ] = await Promise.all([
        getPerformanceDashboardStats(reportLocalDate),
        getDailyAuditLogs(reportLocalDate),
        getCPReportsByRange(reportLocalDate, reportLocalDate),
        getCRReportsByRange(reportLocalDate, reportLocalDate),
        getWorkers(false),
        getAllMachines(false),
        getCostCenters(),
        getAllOperationLogsByRange(monthStart, reportLocalDate, ['REFUELING'])
    ]);

    const mergedAuditData = {
        ops: auditLogs.ops || [],
        personal: auditLogs.personal || [],
        cp: cpReports.length > 0 ? cpReports : (auditLogs.cp || []),
        cr: crReports.length > 0 ? crReports : (auditLogs.cr || [])
    };

    const workerReports = computeWorkerReports(workers, mergedAuditData.personal);
    const fuelSummary = computeFuelAccumulatedData(refuelingLogs, machines, centers, reportDateStr);

    // 2. Generar los 3 PDFs tal cual se ven en pantalla (secuencial para no competir por el DOM offscreen)
    let perfPdfBase64: string;
    try {
        perfPdfBase64 = await renderReactToPdfBase64(
            <ProductionDashboardView stats={perfStats} selectedDate={reportDateStr} isSnapshot={true} />,
            { widthPx: 540, mode: 'single-page', contentWidthMm: 180 }
        );
    } catch (err) {
        console.error('Error capturando PDF de Rendimiento de Plantas, usando fallback:', err);
        perfPdfBase64 = fallbackPerformancePDF(perfStats, displayDate);
    }

    let auditPdfBase64: string;
    try {
        auditPdfBase64 = await renderReactToPdfBase64(
            <DailyAuditReportContent
                date={reportDateStr}
                auditData={mergedAuditData}
                workers={workers}
                machines={machines}
                centers={centers}
                workerReports={workerReports}
                isSnapshot={true}
            />,
            { widthPx: 560, mode: 'blocks', contentWidthMm: 175 }
        );
    } catch (err) {
        console.error('Error capturando PDF de Auditoría Diaria, usando fallback:', err);
        auditPdfBase64 = fallbackAuditPDF(displayDate, workerReports, mergedAuditData.ops, machines, workers);
    }

    let fuelPdfBase64: string;
    try {
        fuelPdfBase64 = await renderReactToPdfBase64(
            <FuelAccumulatedView summary={fuelSummary} />,
            { widthPx: 580, mode: 'blocks', contentWidthMm: 180 }
        );
    } catch (err) {
        console.error('Error capturando PDF de Gasoil Acumulado, usando fallback:', err);
        fuelPdfBase64 = fallbackFuelAccumulatedPDF(fuelSummary);
    }

    // 3. Enviar los 3 correos electrónicos en paralelo
    const results = await Promise.allSettled([
        sendEmail(
            [COMPANY_EMAIL],
            `Parte Cantera Pura - Rendimiento de Plantas (${displayDate})`,
            buildPerformanceEmailHtml(reportData, workerName, displayDate, perfStats),
            perfPdfBase64,
            `Rendimiento_Plantas_${reportDateStr}.pdf`
        ),
        sendEmail(
            [COMPANY_EMAIL],
            `Auditoría Diaria Integral de Partes - ${displayDate}`,
            buildDailyAuditEmailHtml(displayDate, mergedAuditData, workers, machines, centers, workerReports),
            auditPdfBase64,
            `Auditoria_Diaria_Partes_${reportDateStr}.pdf`
        ),
        sendEmail(
            [COMPANY_EMAIL],
            `Consumo Acumulado de Gasoil (${fuelSummary.monthLabel}) - Hasta ${displayDate}`,
            buildFuelAccumulatedEmailHtml(fuelSummary),
            fuelPdfBase64,
            `Consumo_Gasoil_Acumulado_${reportDateStr}.pdf`
        )
    ]);

    results.forEach((res, idx) => {
        if (res.status === 'rejected') {
            console.error(`[CP TRIGGER EMAIL #${idx + 1}] Error:`, res.reason);
        } else if (!res.value.success) {
            console.error(`[CP TRIGGER EMAIL #${idx + 1}] Error de envío:`, res.value.error);
        }
    });
};
