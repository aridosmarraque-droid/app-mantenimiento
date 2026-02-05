import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    getDailyAuditLogs, 
    getWorkers, 
    getAllMachines, 
    getCostCenters, 
    getServiceProviders, 
    getCPReportsByRange, 
    getCRReportsByRange,
    updateOperationLog,
    deleteOperationLog,
    updatePersonalReport,
    deletePersonalReport
} from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider, CPDailyReport, CRDailyReport } from '../../types';
import { 
    ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, 
    Fuel, CalendarClock, Loader2, AlertCircle, Mountain, Waves, 
    Factory, Edit2, Save, X, UserX, Clock, CheckCircle2, Trash2, TrendingUp, Droplets
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DailyAuditViewer: React.FC<Props> = ({ onBack }) => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState<{ 
        ops: OperationLog[], 
        personal: PersonalReport[],
        cp: CPDailyReport[],
        cr: CRDailyReport[]
    }>({ ops: [], personal: [], cp: [], cr: [] });
    
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [providers, setProviders] = useState<ServiceProvider[]>([]);

    const [editingOp, setEditingOp] = useState<OperationLog | null>(null);
    const [editingPersonal, setEditingPersonal] = useState<PersonalReport | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        const loadMasters = async () => {
            try {
                const [w, m, c, p] = await Promise.all([
                    getWorkers(false),
                    getAllMachines(),
                    getCostCenters(),
                    getServiceProviders()
                ]);
                setWorkers(w);
                setMachines(m);
                setCenters(c);
                setProviders(p);
            } catch (err) {
                console.error("Error cargando maestros:", err);
            }
        };
        loadMasters();
    }, []);

    const fetchAudit = useCallback(async () => {
        setLoading(true);
        try {
            const selectedDate = new Date(date);
            if (isNaN(selectedDate.getTime())) return;

            const [data, cpData, crData] = await Promise.all([
                getDailyAuditLogs(selectedDate),
                getCPReportsByRange(selectedDate, selectedDate),
                getCRReportsByRange(selectedDate, selectedDate)
            ]);
            
            setAuditData({ 
                ops: data.ops || [], 
                personal: data.personal || [],
                cp: cpData || [],
                cr: crData || []
            });
        } catch (e) {
            console.error("Error en fetchAudit:", e);
        } finally {
            setLoading(false);
        }
    }, [date]); 

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    const workerReports = useMemo(() => {
        const grouped = new Map<string, { worker: Worker, reports: PersonalReport[], totalHours: number }>();
        
        workers
            .filter(w => w.activo && w.role !== 'admin' && w.requiresReport !== false)
            .forEach(w => {
                grouped.set(w.id, { worker: w, reports: [], totalHours: 0 });
            });

        auditData.personal.forEach(p => {
            if (!grouped.has(p.workerId)) {
                const w = workers.find(work => work.id === p.workerId);
                if (w) {
                    grouped.set(p.workerId, { worker: w, reports: [], totalHours: 0 });
                }
            }
            
            const entry = grouped.get(p.workerId);
            if (entry) {
                entry.reports.push(p);
                entry.totalHours += p.hours;
            }
        });

        return Array.from(grouped.values()).sort((a, b) => a.worker.name.localeCompare(b.worker.name));
    }, [workers, auditData.personal]);

    const getWorkerStatusConfig = (total: number, expected: number) => {
        if (total === 0) return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, label: 'No Presentado' };
        if (total < expected) return { color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertCircle, label: 'Incompleto' };
        if (total === expected) return { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, label: 'Jornada Completa' };
        return { color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp, label: 'Horas Extras' };
    };

    const handleSaveOpEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOp) return;
        setSavingEdit(true);
        try {
            await updateOperationLog(editingOp.id, editingOp);
            setEditingOp(null);
            fetchAudit();
        } catch (e) { alert("Error al guardar cambios técnicos."); }
        finally { setSavingEdit(false); }
    };

    const handleDeleteOp = async (id: string) => {
        if (!confirm("¿Desea eliminar permanentemente este registro de maquinaria?")) return;
        setSavingEdit(true);
        try {
            await deleteOperationLog(id);
            setEditingOp(null);
            fetchAudit();
        } catch (e) { alert("Error al eliminar registro técnico."); }
        finally { setSavingEdit(false); }
    };

    const handleSavePersonalEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPersonal) return;
        setSavingEdit(true);
        try {
            await updatePersonalReport(editingPersonal.id, {
                ...editingPersonal,
                date: new Date(editingPersonal.date)
            });
            setEditingPersonal(null);
            fetchAudit();
        } catch (e) { alert("Error al guardar cambios del operario."); }
        finally { setSavingEdit(false); }
    };

    const handleDeletePersonal = async (id: string) => {
        if (!confirm("¿Desea borrar permanentemente este parte de trabajo personal?")) return;
        setSavingEdit(true);
        try {
            await deletePersonalReport(id);
            setEditingPersonal(null);
            fetchAudit();
        } catch (e) { alert("Error al eliminar el parte."); }
        finally { setSavingEdit(false); }
    };

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Desconocido";
    
    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : "General / Sin Asignar";
    };

    const typeConfig: any = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50' },
        'BREAKDOWN': { label: 'Avería', icon: Wrench, color: 'text-red-600 bg-red-50' },
        'MAINTENANCE': { label: 'Mantenimiento', icon: Hammer, color: 'text-amber-600 bg-amber-50' },
        'REFUELING': { label: 'Repostaje', icon: Fuel, color: 'text-green-600 bg-green-50' },
        'SCHEDULED': { label: 'Programado', icon: CalendarClock, color: 'text-purple-600 bg-purple-50' }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Auditoría Diaria Integral</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 mx-1">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 tracking-widest">Fecha de Consulta</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 text-blue-500" size={18} />
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="w-full p-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={fetchAudit}
                        disabled={loading}
                        className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />} 
                        <span className="font-bold">Actualizar</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
                    <p className="font-bold animate-pulse text-sm uppercase tracking-widest">Sincronizando documentación...</p>
                </div>
            ) : (
                <div className="space-y-8 px-1">
                    
                    {/* BLOQUE 1: PLANTAS */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-amber-500 w-2 h-6 rounded-full"></span>
                            1. Producción y Plantas
                        </h4>
                        <div className="grid gap-3">
                            {auditData.cp.length === 0 && auditData.cr.length === 0 && (
                                <div className="p-8 text-center text-slate-300 border-2 border-dashed rounded-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin partes de planta para hoy</p>
                                </div>
                            )}
                            {auditData.cp.map(report => (
                                <div key={`cp-${report.id}`} className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Mountain size={20}/></div>
                                            <div>
                                                <div className="font-bold text-slate-800">Cantera Pura</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Machacadora</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.crusherStart} → {report.crusherEnd}</p>
                                            <p className="text-amber-700 font-black text-xs mt-1">Total: {report.crusherEnd - report.crusherStart}h</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Molinos</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.millsStart} → {report.millsEnd}</p>
                                            <p className="text-amber-700 font-black text-xs mt-1">Total: {report.millsEnd - report.millsStart}h</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {auditData.cr.map(report => (
                                <div key={`cr-${report.id}`} className="bg-white border border-teal-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Waves size={20}/></div>
                                            <div>
                                                <div className="font-bold text-slate-800">Canto Rodado</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Lavado</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.washingStart.toFixed(1)} → {report.washingEnd.toFixed(1)}</p>
                                            <p className="text-teal-700 font-black text-xs mt-1">Total: {(report.washingEnd - report.washingStart).toFixed(1)}h</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Trituración</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.trituracion_inicio.toFixed(1)} → {report.trituracion_fin.toFixed(1)}</p>
                                            <p className="text-teal-700 font-black text-xs mt-1">Total: {(report.trituracion_fin - report.trituracion_inicio).toFixed(1)}h</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOQUE 2: MANTENIMIENTO */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-indigo-600 w-2 h-6 rounded-full"></span>
                            2. Registros de Maquinaria
                        </h4>
                        <div className="space-y-3">
                            {auditData.ops.map(log => {
                                const conf = typeConfig[log.type] || typeConfig['LEVELS'];
                                const Icon = conf.icon;
                                return (
                                    <div key={log.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${conf.color}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-slate-800 text-xs">{getMachineName(log.machineId)}</span>
                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${conf.color} bg-opacity-20`}>{conf.label}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(log.workerId)} • {log.hoursAtExecution}h</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setEditingOp(log)} className="p-2 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                                                <Edit2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* BLOQUE 3: PARTES DE PERSONAL */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-green-600 w-2 h-6 rounded-full"></span>
                            3. Partes de Trabajo Personal
                        </h4>
                        
                        <div className="space-y-4">
                            {workerReports.map(entry => {
                                const status = getWorkerStatusConfig(entry.totalHours, entry.worker.expectedHours || 0);
                                const StatusIcon = status.icon;

                                return (
                                    <div key={entry.worker.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className={`p-4 flex justify-between items-center border-b transition-colors ${status.bg}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${entry.totalHours > 0 ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                                                    {entry.worker.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm uppercase leading-none">{entry.worker.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Plan: {entry.worker.expectedHours || 8}h</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`flex items-center gap-1.5 justify-end font-black ${status.color}`}>
                                                    <StatusIcon size={16} />
                                                    <span className="text-lg">{entry.totalHours.toFixed(1)}h</span>
                                                </div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${status.color} opacity-70`}>{status.label}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="divide-y divide-slate-50">
                                            {entry.reports.map(rep => (
                                                <div key={rep.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-700 text-xs">{getMachineName(rep.machineId!)}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                                            <Factory size={10}/> {centers.find(c => c.id === rep.costCenterId)?.name || 'Sin Centro'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-black text-slate-800">{rep.hours.toFixed(1)}h</span>
                                                        <button onClick={() => setEditingPersonal(rep)} className="p-2 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                                            <Edit2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {entry.reports.length === 0 && (
                                                <div className="p-6 text-center text-red-400 bg-red-50/10 italic text-[10px] font-bold uppercase tracking-widest">
                                                    <UserX size={20} className="mx-auto mb-1 opacity-20"/> Parte no presentado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EDICIÓN TÉCNICA */}
            {editingOp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 text-white p-5 flex justify-between items-center shrink-0">
                            <h4 className="font-bold flex items-center gap-2"><Wrench size={20}/> Corregir Registro Técnico</h4>
                            <button onClick={() => setEditingOp(null)} className="p-1 hover:bg-indigo-500 rounded-lg transition-colors"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveOpEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fecha</label>
                                    <input 
                                        type="date" 
                                        value={new Date(editingOp.date).toISOString().split('T')[0]}
                                        onChange={e => setEditingOp({...editingOp, date: new Date(e.target.value)})}
                                        className="w-full p-3 border rounded-xl font-bold bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Registro</label>
                                    <input 
                                        type="number" step="0.01" 
                                        value={editingOp.hoursAtExecution}
                                        onChange={e => setEditingOp({...editingOp, hoursAtExecution: Number(e.target.value)})}
                                        className="w-full p-3 border rounded-xl font-black text-indigo-600 bg-slate-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Unidad / Máquina</label>
                                <select 
                                    value={editingOp.machineId}
                                    onChange={e => setEditingOp({...editingOp, machineId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-slate-50"
                                >
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Operario Responsable</label>
                                <select 
                                    value={editingOp.workerId}
                                    onChange={e => setEditingOp({...editingOp, workerId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-slate-50"
                                >
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            {editingOp.type === 'REFUELING' && (
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <label className="block text-[10px] font-black text-green-600 uppercase mb-1">Litros Suministrados</label>
                                    <input 
                                        type="number" step="0.1" 
                                        value={editingOp.fuelLitres || 0}
                                        onChange={e => setEditingOp({...editingOp, fuelLitres: Number(e.target.value)})}
                                        className="w-full p-3 border rounded-lg bg-white font-black text-lg"
                                    />
                                </div>
                            )}

                            {editingOp.type === 'BREAKDOWN' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Causa</label>
                                        <textarea rows={2} value={editingOp.breakdownCause || ''} onChange={e => setEditingOp({...editingOp, breakdownCause: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Solución</label>
                                        <textarea rows={2} value={editingOp.breakdownSolution || ''} onChange={e => setEditingOp({...editingOp, breakdownSolution: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                </div>
                            )}

                            {(editingOp.type === 'MAINTENANCE' || editingOp.type === 'SCHEDULED') && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción / Materiales</label>
                                    <textarea rows={3} value={editingOp.materials || ''} onChange={e => setEditingOp({...editingOp, materials: e.target.value})} className="w-full p-3 border rounded-xl text-sm" placeholder="Filtros, aceites, etc..." />
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-4 shrink-0">
                                <button type="submit" disabled={savingEdit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
                                    {savingEdit ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Guardar Cambios
                                </button>
                                <button type="button" onClick={() => handleDeleteOp(editingOp.id)} disabled={savingEdit} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-red-100 transition-all">
                                    <Trash2 size={16}/> Borrar Registro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE EDICIÓN PERSONAL */}
            {editingPersonal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-green-600 text-white p-5 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Clock size={20}/> Corregir Parte de Trabajo</h4>
                            <button onClick={() => setEditingPersonal(null)} className="p-1 hover:bg-green-500 rounded-lg transition-colors"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSavePersonalEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Centro de Trabajo</label>
                                <select 
                                    value={editingPersonal.costCenterId || ''}
                                    onChange={e => setEditingPersonal({...editingPersonal, costCenterId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-slate-50"
                                >
                                    <option value="">-- Seleccionar Centro --</option>
                                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Máquina / Tajo</label>
                                <select 
                                    value={editingPersonal.machineId || ''}
                                    onChange={e => setEditingPersonal({...editingPersonal, machineId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-slate-50"
                                >
                                    <option value="">-- General / Sin asignar --</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Trabajadas</label>
                                <input 
                                    type="number" step="0.5" 
                                    value={editingPersonal.hours}
                                    onChange={e => setEditingPersonal({...editingPersonal, hours: Number(e.target.value)})}
                                    className="w-full p-4 border rounded-2xl font-black text-2xl text-center bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 transition-all outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => handleDeletePersonal(editingPersonal.id)} disabled={savingEdit} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-red-100 transition-all">
                                    <Trash2 size={16}/> Borrar
                                </button>
                                <button type="submit" disabled={savingEdit} className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-all">
                                    {savingEdit ? <Loader2 className="animate-spin" size={20}/> : <Save size={16}/>} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
