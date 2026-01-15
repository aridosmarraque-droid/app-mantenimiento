
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

    const summary = useMemo(() => {
        let total = 0;
        let overdue = 0;
        let warning = 0;

        machines.forEach(m => {
            m.maintenanceDefs.forEach(d => {
                total++;
                if (d.maintenanceType === 'DATE') {
                    const nextDate = d.nextDate ? new Date(d.nextDate) : null;
                    if (nextDate) {
                        nextDate.setHours(0, 0, 0, 0);
                        const diffTime = nextDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays <= 0) overdue++;
                        else if (diffDays <= 15) warning++;
                    }
                } else {
                    const remaining = d.remainingHours ?? 0;
                    if (remaining <= 0) overdue++;
                    else if (remaining <= (d.warningHours || 0)) warning++;
                }
            });
        });

        return { total, overdue, warning };
    }, [machines, today]);

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

            {/* SECCIÓN 1: MANTENIMIENTOS POR HORAS */}
            <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tight px-2">
                    <Clock size={18} className="text-blue-600" /> Preventivos por Horas
                </h4>
                <div className="space-y-4">
                    {machines.filter(m => m.maintenanceDefs.some(d => d.maintenanceType !== 'DATE')).map(machine => (
                        <div key={`hours-${machine.id}`} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-1">
                            <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Truck size={16} className="text-blue-500" />
                                    <span className="font-black text-slate-700 text-xs uppercase">{machine.companyCode ? `[${machine.companyCode}] ` : ''}{machine.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{machine.currentHours}h actuales</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {machine.maintenanceDefs.filter(d => d.maintenanceType !== 'DATE').map(def => {
                                    const remaining = def.remainingHours ?? 0;
                                    const isOverdue = remaining <= 0;
                                    const isWarning = remaining > 0 && remaining <= (def.warningHours || 0);
                                    return (
                                        <div key={def.id} className={`p-4 flex justify-between items-center ${isOverdue ? 'bg-red-50/20' : isWarning ? 'bg-amber-50/20' : ''}`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                                    <h5 className="font-bold text-slate-700 text-xs uppercase">{def.name}</h5>
                                                </div>
                                                <p className="text-[9px] text-slate-400 mt-0.5 ml-4 italic line-clamp-1">{def.tasks}</p>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="text-[7px] font-black text-slate-400 uppercase">Restantes</p>
                                                    <p className={`text-xs font-mono font-black ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                                                        {remaining}h
                                                    </p>
                                                </div>
                                                <div className={`p-1 rounded ${isOverdue ? 'bg-red-100 text-red-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                    {isOverdue ? <AlertTriangle size={14}/> : <CheckCircle2 size={14}/>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECCIÓN 2: MANTENIMIENTOS POR FECHAS */}
            <div className="space-y-4 pt-4">
                <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tight px-2">
                    <Calendar size={18} className="text-purple-600" /> Preventivos por Calendario
                </h4>
                <div className="space-y-4">
                    {machines.filter(m => m.maintenanceDefs.some(d => d.maintenanceType === 'DATE')).map(machine => (
                        <div key={`date-${machine.id}`} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mx-1">
                            <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Truck size={16} className="text-purple-500" />
                                    <span className="font-black text-slate-700 text-xs uppercase">{machine.companyCode ? `[${machine.companyCode}] ` : ''}{machine.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Referencia: {today.toLocaleDateString()}</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {machine.maintenanceDefs.filter(d => d.maintenanceType === 'DATE').map(def => {
                                    const nextDate = def.nextDate ? new Date(def.nextDate) : null;
                                    let diffDays = 0;
                                    if (nextDate) {
                                        nextDate.setHours(0,0,0,0);
                                        diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                    }
                                    
                                    const isOverdue = diffDays <= 0;
                                    const isWarning = diffDays > 0 && diffDays <= 15;
                                    
                                    return (
                                        <div key={def.id} className={`p-4 flex justify-between items-center ${isOverdue ? 'bg-red-50/20' : isWarning ? 'bg-amber-50/20' : ''}`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                                    <h5 className="font-bold text-slate-700 text-xs uppercase">{def.name}</h5>
                                                </div>
                                                <p className="text-[9px] text-slate-400 mt-0.5 ml-4">Fecha Vencimiento: <span className="font-bold text-slate-600">{nextDate ? nextDate.toLocaleDateString() : 'N/A'}</span></p>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="text-[7px] font-black text-slate-400 uppercase">Días Restantes</p>
                                                    <p className={`text-xs font-mono font-black ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                                                        {isOverdue ? 'PLAZO CUMPLIDO' : `${diffDays} Días`}
                                                    </p>
                                                </div>
                                                <div className={`p-1 rounded ${isOverdue ? 'bg-red-100 text-red-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                    {isOverdue ? <AlertTriangle size={14}/> : <Calendar size={14}/>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
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
