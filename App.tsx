
import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines } from '../../services/db';
import { Machine, MaintenanceDefinition } from '../../types';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Clock, BellRing, Mail, Truck, LayoutGrid, CalendarClock, Info } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const ScheduledMaintenanceReport: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAllMachines(true); // Solo activas
            // Ordenar máquinas por código de empresa o nombre
            const sorted = data.sort((a, b) => (a.companyCode || a.name).localeCompare(b.companyCode || b.name));
            setMachines(sorted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Resumen para el panel superior
    const summary = useMemo(() => {
        let total = 0;
        let overdue = 0;
        let warning = 0;

        machines.forEach(m => {
            m.maintenanceDefs.forEach(d => {
                total++;
                const remaining = d.remainingHours ?? 0;
                if (remaining <= 0) overdue++;
                else if (remaining <= (d.warningHours || 0)) warning++;
            });
        });

        return { total, overdue, warning };
    }, [machines]);

    if (loading) return <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
        <p className="font-black uppercase text-xs tracking-widest">Auditando preventivos...</p>
    </div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Control Preventivo</h3>
                    <p className="text-[10px] font-bold text-red-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                        <CalendarClock size={10}/> Mantenimientos Programados
                    </p>
                </div>
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
                    <div className="text-[8px] font-black text-slate-400 uppercase">Total Tareas</div>
                </div>
            </div>

            <div className="space-y-6">
                {machines.filter(m => m.maintenanceDefs.length > 0).map(machine => (
                    <div key={machine.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mx-1">
                        {/* Cabecera de Máquina */}
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                    <Truck size={20}/>
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm leading-tight">
                                        {machine.companyCode ? `[${machine.companyCode}] ` : ''}{machine.name}
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-tighter">
                                        <Clock size={10}/> Horas Actuales: <span className="text-blue-600 font-black">{machine.currentHours}h</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Listado de Tareas */}
                        <div className="divide-y divide-slate-100">
                            {machine.maintenanceDefs.map(def => {
                                const remaining = def.remainingHours ?? 0;
                                const isOverdue = remaining <= 0;
                                const isWarning = remaining > 0 && remaining <= (def.warningHours || 0);
                                const dueHours = (def.lastMaintenanceHours || 0) + (def.intervalHours || 0);

                                return (
                                    <div key={def.id} className={`p-4 transition-colors ${isOverdue ? 'bg-red-50/30' : isWarning ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                                    <h5 className="font-black text-slate-700 text-xs uppercase tracking-tight">{def.name}</h5>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 ml-4 italic truncate max-w-[200px]">{def.tasks}</p>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {def.notifiedWarning && (
                                                    <div className="bg-amber-100 text-amber-600 p-1 rounded-md" title="Preaviso Notificado">
                                                        <BellRing size={12}/>
                                                    </div>
                                                )}
                                                {def.notifiedOverdue && (
                                                    <div className="bg-red-100 text-red-600 p-1 rounded-md" title="Vencimiento Notificado">
                                                        <Mail size={12}/>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-white border border-slate-100 p-2 rounded-xl text-center">
                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Vencimiento</p>
                                                <p className="text-[10px] font-mono font-bold text-slate-700">{dueHours}h</p>
                                            </div>
                                            <div className="bg-white border border-slate-100 p-2 rounded-xl text-center">
                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Restantes</p>
                                                <p className={`text-[10px] font-mono font-black ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {isOverdue ? '-' : ''}{Math.abs(remaining)}h
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm border ${
                                                    isOverdue ? 'bg-red-600 text-white border-red-700' : 
                                                    isWarning ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                                    'bg-green-100 text-green-700 border-green-200'
                                                }`}>
                                                    {isOverdue ? 'VENCIDO' : isWarning ? 'PREAVISO' : 'AL DÍA'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Barra de progreso visual */}
                                        {!isOverdue && (
                                            <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${isWarning ? 'bg-amber-500' : 'bg-green-500'}`}
                                                    style={{ width: `${Math.max(0, Math.min(100, (remaining / (def.intervalHours || 1)) * 100))}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {machines.every(m => m.maintenanceDefs.length === 0) && (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                        <Info size={64} className="text-slate-300"/>
                        <p className="font-black uppercase tracking-widest text-[10px]">No se han configurado planes preventivos aún</p>
                    </div>
                )}
            </div>
        </div>
    );
};
