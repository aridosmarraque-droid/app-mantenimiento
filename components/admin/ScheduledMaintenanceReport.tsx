
import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines } from '../../services/db';
import { generateMaintenanceReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, MaintenanceDefinition } from '../../types';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Clock, BellRing, Mail, Truck, LayoutGrid, CalendarClock, Info, Send, Calendar } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const ScheduledMaintenanceReport: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAllMachines(true); // Solo activas
            const sorted = data.sort((a, b) => (a.companyCode || a.name).localeCompare(b.companyCode || b.name));
            setMachines(sorted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const flattenedMaintenance = useMemo(() => {
        const list: { machine: Machine, def: MaintenanceDefinition, isOverdue: boolean, isWarning: boolean, proximity: number }[] = [];
        machines.forEach(machine => {
            machine.maintenanceDefs.forEach(def => {
                let isOverdue = false;
                let isWarning = false;
                let proximity = 0;

                if (def.maintenanceType === 'DATE') {
                    const nextDate = def.nextDate ? new Date(def.nextDate) : null;
                    if (nextDate) {
                        const d = new Date(nextDate);
                        d.setHours(0, 0, 0, 0);
                        const diffTime = d.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        isOverdue = diffDays <= 0;
                        isWarning = diffDays > 0 && diffDays <= 15;
                        proximity = diffDays;
                    } else {
                        proximity = 999999;
                    }
                } else {
                    const remaining = def.remainingHours ?? 0;
                    isOverdue = remaining <= 0;
                    isWarning = remaining > 0 && remaining <= (def.warningHours || 0);
                    proximity = remaining;
                }

                list.push({ machine, def, isOverdue, isWarning, proximity });
            });
        });

        return list.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            if (a.isWarning && !b.isWarning) return -1;
            if (!a.isWarning && b.isWarning) return 1;
            return a.proximity - b.proximity;
        });
    }, [machines, today]);

    const summary = useMemo(() => {
        const total = flattenedMaintenance.length;
        const overdue = flattenedMaintenance.filter(i => i.isOverdue).length;
        const warning = flattenedMaintenance.filter(i => i.isWarning).length;
        return { total, overdue, warning };
    }, [flattenedMaintenance]);

    const handleSendReport = async () => {
        if (sending) return;
        if (!confirm("¿Desea enviar la auditoría integral de preventivos a aridos@marraque.es?")) return;

        setSending(true); // BLOQUEO INMEDIATO
        try {
            const pdfBase64 = generateMaintenanceReportPDF(machines, summary);
            const res = await sendEmail(
                ['aridos@marraque.es'],
                `Auditoría Preventivos - ${new Date().toLocaleDateString()}`,
                `<p>Se adjunta el informe detallado de mantenimientos programados (Horas y Fechas) de la flota.</p><p><b>Resumen actual:</b> ${summary.overdue} vencidos, ${summary.warning} en preaviso.</p>`,
                pdfBase64,
                `Auditoria_Preventivos_${new Date().toISOString().split('T')[0]}.pdf`
            );

            if (res.success) {
                alert("Informe enviado con éxito a aridos@marraque.es");
            } else {
                alert("Error al enviar el email: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error crítico al generar o enviar el informe.");
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
            <p className="font-black uppercase text-xs tracking-widest">Generando auditoría técnica...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Control Preventivo</h3>
                        <p className="text-[10px] font-bold text-red-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <CalendarClock size={10}/> Auditoría de Mantenimientos
                        </p>
                    </div>
                </div>
                <button 
                    onClick={handleSendReport}
                    disabled={sending}
                    className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-black transition-all disabled:opacity-50"
                >
                    {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                </button>
            </div>

            {/* Panel de Resumen Semafórico */}
            <div className="grid grid-cols-3 gap-3 px-1">
                <div className="bg-red-50 border-2 border-red-100 p-3 rounded-2xl text-center shadow-sm">
                    <div className="text-red-600 font-black text-2xl">{summary.overdue}</div>
                    <div className="text-[8px] font-black text-red-400 uppercase">Vencidos</div>
                </div>
                <div className="bg-amber-50 border-2 border-amber-100 p-3 rounded-2xl text-center shadow-sm">
                    <div className="text-amber-600 font-black text-2xl">{summary.warning}</div>
                    <div className="text-[8px] font-black text-amber-400 uppercase">Preaviso</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-2xl text-center shadow-sm">
                    <div className="text-white font-black text-2xl">{summary.total}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase">Total</div>
                </div>
            </div>

            {/* LISTADO UNIFICADO DE MANTENIMIENTOS */}
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tight px-2">
                    <LayoutGrid size={18} className="text-blue-600" /> Listado de Intervenciones
                </h4>
                <div className="space-y-3 px-1">
                    {flattenedMaintenance.map(({ machine, def, isOverdue, isWarning, proximity }) => {
                        const isDate = def.maintenanceType === 'DATE';
                        
                        return (
                            <div key={def.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${isOverdue ? 'border-l-4 border-l-red-500' : isWarning ? 'border-l-4 border-l-amber-500' : ''}`}>
                                <div className="p-4 flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-blue-600">
                                                {machine.companyCode ? `[${machine.companyCode}] ` : ''}{machine.name}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                • {isDate ? 'Calendario' : 'Horas'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                            <h5 className="font-black text-slate-700 text-xs uppercase">{def.name}</h5>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mt-1 ml-4 italic line-clamp-1">{def.tasks}</p>
                                        {isDate && def.nextDate && (
                                            <p className="text-[9px] text-slate-400 mt-0.5 ml-4">Vence: <span className="font-bold text-slate-600">{new Date(def.nextDate).toLocaleDateString()}</span></p>
                                        )}
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-400 uppercase">{isDate ? 'Días Restantes' : 'Horas Restantes'}</p>
                                            <p className={`text-xs font-mono font-black ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                                                {isDate ? (isOverdue ? 'VENCIDO' : `${proximity} Días`) : `${proximity}h`}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-xl ${isOverdue ? 'bg-red-100 text-red-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                            {isOverdue ? <AlertTriangle size={18}/> : isWarning ? <BellRing size={18}/> : <CheckCircle2 size={18}/>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {machines.every(m => m.maintenanceDefs.length === 0) && (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                    <Info size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Sin planes preventivos configurados</p>
                </div>
            )}
        </div>
    );
};
