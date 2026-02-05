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
    updatePersonalReport,
    deletePersonalReport
} from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider, CPDailyReport, CRDailyReport } from '../../types';
import { 
    ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, 
    Fuel, CalendarClock, Loader2, AlertCircle, Mountain, Waves, 
    Factory, Edit2, Save, X, UserX, Clock, CheckCircle2, Trash2, TrendingUp
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

    // --- LÓGICA DE AGRUPACIÓN POR TRABAJADOR (RESTAURADA) ---
    const workerReports = useMemo(() => {
        const grouped = new Map<string, { worker: Worker, reports: PersonalReport[], totalHours: number }>();
        
        // 1. Inicializar con trabajadores que DEBERÍAN presentar parte
        workers
            .filter(w => w.activo && w.role !== 'admin' && w.requiresReport !== false)
            .forEach(w => {
                grouped.set(w.id, { worker: w, reports: [], totalHours: 0 });
            });

        // 2. Añadir los partes reales y contemplar trabajadores que no estaban en la lista inicial
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
        } catch (e) { alert("Error al guardar"); }
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
        } catch (e) { alert("Error al guardar"); }
        finally { setSavingEdit(false); }
    };

    const handleDeletePersonal = async (id: string) => {
        if (!confirm("¿Eliminar este registro?")) return;
        await deletePersonalReport(id);
        fetchAudit();
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
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Molinos</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.millsStart} → {report.millsEnd}</p>
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
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Trituración</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.triturationStart.toFixed(1)} → {report.triturationEnd.toFixed(1)}</p>
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

                    {/* BLOQUE 3: PARTES DE PERSONAL (RESTAURADO CON COMPARATIVA) */}
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

            {/* MODALES DE EDICIÓN */}
            {editingPersonal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-blue-600 text-white p-5 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Clock size={20}/> Corregir Horas</h4>
                            <button onClick={() => setEditingPersonal(null)}><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSavePersonalEdit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Trabajadas</label>
                                <input 
                                    type="number" step="0.5" 
                                    value={editingPersonal.hours}
                                    onChange={e => setEditingPersonal({...editingPersonal, hours: Number(e.target.value)})}
                                    className="w-full p-4 border rounded-2xl font-black text-2xl text-center bg-slate-50"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => handleDeletePersonal(editingPersonal.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-xs">Borrar</button>
                                <button type="submit" disabled={savingEdit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                                    {savingEdit ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
