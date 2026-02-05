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
    Fuel, CalendarClock, Loader2, ClipboardList, Info, AlertCircle, 
    Mountain, Waves, Droplets, Factory, Edit2, Save, X, UserX, Clock,
    CheckCircle2, Trash2, TrendingUp
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

    // Edit Modal State
    const [editingOp, setEditingOp] = useState<OperationLog | null>(null);
    const [editingPersonal, setEditingPersonal] = useState<PersonalReport | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    // Carga inicial de datos maestros
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

    // Función de carga de datos de auditoría
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

    // --- LÓGICA DE AGRUPACIÓN POR TRABAJADOR ---
    const workerReports = useMemo(() => {
        const grouped = new Map<string, { worker: Worker, reports: PersonalReport[], totalHours: number }>();
        
        workers
            // Fix: changed w.active to w.activo
            .filter(w => w.activo && w.role !== 'admin' && w.requiresReport !== false)
            .forEach(w => {
                grouped.set(w.id, { worker: w, reports: [], totalHours: 0 });
            });

        auditData.personal.forEach(p => {
            if (grouped.has(p.workerId)) {
                const entry = grouped.get(p.workerId)!;
                entry.reports.push(p);
                entry.totalHours += p.hours;
            }
        });

        return Array.from(grouped.values()).sort((a, b) => b.totalHours - a.totalHours);
    }, [workers, auditData.personal]);

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
            const reportToSave = {
                ...editingPersonal,
                date: new Date(editingPersonal.date)
            };
            await updatePersonalReport(reportToSave.id, reportToSave);
            setEditingPersonal(null);
            fetchAudit();
        } catch (e) { alert("Error al guardar"); }
        finally { setSavingEdit(false); }
    };

    const handleDeletePersonal = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar este parte de trabajo personal de forma permanente?")) return;
        setSavingEdit(true);
        try {
            await deletePersonalReport(id);
            setEditingPersonal(null);
            fetchAudit();
        } catch (e) {
            alert("Error al eliminar el registro.");
        } finally {
            setSavingEdit(false);
        }
    };

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Desconocido";
    
    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : "General / Planta";
    };

    const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || "Propio";

    const typeConfig: any = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50' },
        'BREAKDOWN': { label: 'Avería', icon: Wrench, color: 'text-red-600 bg-red-50' },
        'MAINTENANCE': { label: 'Mantenimiento', icon: Hammer, color: 'text-amber-600 bg-amber-50' },
        'REFUELING': { label: 'Repostaje', icon: Fuel, color: 'text-green-600 bg-green-50' },
        'SCHEDULED': { label: 'Programado', icon: CalendarClock, color: 'text-purple-600 bg-purple-50' }
    };

    const renderLogDetails = (log: OperationLog) => {
        switch (log.type) {
            case 'LEVELS':
                return (
                    <div className="flex gap-4 text-xs font-bold text-blue-700">
                        {log.motorOil ? <span>Motor: {log.motorOil}L</span> : null}
                        {log.hydraulicOil ? <span>Hidr.: {log.hydraulicOil}L</span> : null}
                        {log.coolant ? <span>Refrig.: {log.coolant}L</span> : null}
                    </div>
                );
            case 'REFUELING':
                return <span className="text-sm font-black text-green-700">+{log.fuelLitres} L</span>;
            case 'BREAKDOWN':
                return (
                    <div className="space-y-1">
                        <p className="text-xs text-red-700 font-bold"><span className="uppercase text-[10px] opacity-60">Causa:</span> {log.breakdownCause}</p>
                        <p className="text-xs text-slate-600 italic"><span className="uppercase text-[10px] opacity-60">Solución:</span> {log.breakdownSolution}</p>
                    </div>
                );
            case 'SCHEDULED':
            case 'MAINTENANCE':
                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-green-500" />
                            <p className="text-xs text-slate-800 font-black">{log.description || 'Intervención Técnica'}</p>
                        </div>
                        {log.materials && <p className="text-[10px] text-slate-400 font-medium italic pl-4">Materiales: {log.materials}</p>}
                    </div>
                );
            default:
                return null;
        }
    };

    // Helper para determinar el estado semafórico de las horas del trabajador
    const getWorkerStatusConfig = (total: number, expected: number) => {
        if (total === 0 || total < expected) return { color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle, label: 'Incompleto' };
        if (total === expected) return { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, label: 'Correcto' };
        return { color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingUp, label: 'Superiores' };
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Auditoría Diaria Integral</h3>
            </div>

            {/* Selector de Fecha */}
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
                    
                    {/* BLOQUE 1: PRODUCCIÓN DE PLANTAS */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-amber-500 w-2 h-6 rounded-full"></span>
                            1. Producción y Plantas
                        </h4>
                        <div className="grid gap-3">
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
                                            <p className="text-amber-700 font-black text-xs mt-1">{report.crusherEnd - report.crusherStart}h</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Molinos / Planta</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.millsStart} → {report.millsEnd}</p>
                                            <p className="text-amber-700 font-black text-xs mt-1">{report.millsEnd - report.millsStart}h</p>
                                        </div>
                                    </div>
                                    {report.comments && (
                                        <div className="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-amber-900 italic">
                                            "{report.comments}"
                                        </div>
                                    )}
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
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.washingStart.toFixed(2)} → {report.washingEnd.toFixed(2)}</p>
                                            <p className="text-teal-700 font-black text-xs mt-1">{(report.washingEnd - report.washingStart).toFixed(2)}h</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Trituración</p>
                                            <p className="font-mono font-bold text-sm text-slate-700">{report.triturationStart.toFixed(2)} → {report.triturationEnd.toFixed(2)}</p>
                                            <p className="text-teal-700 font-black text-xs mt-1">{(report.triturationEnd - report.triturationStart).toFixed(2)}h</p>
                                        </div>
                                    </div>
                                    {report.comments && (
                                        <div className="mt-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100 text-xs text-teal-900 italic">
                                            "{report.comments}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOQUE 2: MANTENIMIENTO Y TÉCNICO */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-indigo-600 w-2 h-6 rounded-full"></span>
                            2. Mantenimiento y Registros Técnicos
                        </h4>
                        <div className="space-y-3">
                            {auditData.ops.map(log => {
                                const conf = typeConfig[log.type] || typeConfig['LEVELS'];
                                const Icon = conf.icon;
                                return (
                                    <div key={log.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm group hover:border-indigo-200 transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${conf.color}`}>
                                                    <Icon size={24} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${conf.color} bg-opacity-20`}>{conf.label}</span>
                                                        <span className="font-black text-slate-800 text-sm truncate">{getMachineName(log.machineId)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-3">
                                                        <User size={10}/> {getWorkerName(log.workerId)}
                                                        <Clock size={10} className="ml-1"/> {log.hoursAtExecution}h registro
                                                    </div>
                                                    
                                                    {/* Detalle específico mejorado */}
                                                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                        {renderLogDetails(log)}
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => setEditingOp(log)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                <Edit2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {auditData.ops.length === 0 && (
                                <div className="p-10 text-center text-slate-300 border-2 border-dashed rounded-2xl">
                                    <Wrench size={32} className="mx-auto mb-2 opacity-20"/>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin actividad técnica registrada</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BLOQUE 3: PARTES DE PERSONAL */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                                <span className="bg-green-600 w-2 h-6 rounded-full"></span>
                                3. Partes de Trabajo Personal
                            </h4>
                        </div>
                        
                        <div className="space-y-4">
                            {workerReports.map(entry => {
                                const status = getWorkerStatusConfig(entry.totalHours, entry.worker.expectedHours || 0);
                                const StatusIcon = status.icon;

                                return (
                                    <div key={entry.worker.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <div className={`p-4 flex justify-between items-center border-b transition-colors duration-300 ${status.bg}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${entry.totalHours > 0 ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
                                                    {entry.worker.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm uppercase leading-none">{entry.worker.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Jornada Plan: {entry.worker.expectedHours}h</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <StatusIcon size={20} className={status.color} />
                                                        <p className={`text-xl font-black ${status.color}`}>
                                                            {entry.totalHours}h
                                                        </p>
                                                    </div>
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{status.label}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {entry.reports.map(rep => (
                                                <div key={rep.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                            <span className="font-bold text-slate-700 text-xs truncate">{getMachineName(rep.machineId!)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                                                            <Factory size={10}/> {centers.find(c => c.id === rep.costCenterId)?.name || 'Sin Centro'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-black text-slate-800">{rep.hours}h</span>
                                                        <button onClick={() => setEditingPersonal(rep)} className="p-2 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                                                            <Edit2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {entry.reports.length === 0 && (
                                                <div className="p-6 text-center text-slate-300 bg-red-50/10">
                                                    <UserX size={24} className="mx-auto mb-2 opacity-20"/>
                                                    <p className="text-[9px] font-black uppercase tracking-widest italic text-red-400">Parte no presentado</p>
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

            {/* MODAL EDICIÓN TÉCNICA */}
            {editingOp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Wrench size={20}/> Corregir Registro</h4>
                            <button onClick={() => setEditingOp(null)} className="p-1 hover:bg-indigo-500 rounded-lg"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveOpEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Registro</label>
                                <input 
                                    type="number" step="0.01" 
                                    value={editingOp.hoursAtExecution}
                                    onChange={e => setEditingOp({...editingOp, hoursAtExecution: Number(e.target.value)})}
                                    className="w-full p-4 border rounded-2xl font-black text-lg bg-slate-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {(editingOp.type === 'SCHEDULED' || editingOp.type === 'MAINTENANCE') && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Título / Descripción</label>
                                        <textarea rows={2} value={editingOp.description || ''} onChange={e => setEditingOp({...editingOp, description: e.target.value})} className="w-full p-4 border rounded-2xl text-sm font-bold bg-slate-50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Materiales Utilizados</label>
                                        <textarea rows={2} value={editingOp.materials || ''} onChange={e => setEditingOp({...editingOp, materials: e.target.value})} className="w-full p-4 border rounded-2xl text-sm font-bold bg-slate-50" />
                                    </div>
                                </>
                            )}

                            {editingOp.type === 'BREAKDOWN' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Causa</label>
                                        <textarea rows={2} value={editingOp.breakdownCause || ''} onChange={e => setEditingOp({...editingOp, breakdownCause: e.target.value})} className="w-full p-4 border rounded-2xl text-sm font-bold bg-slate-50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Solución</label>
                                        <textarea rows={2} value={editingOp.breakdownSolution || ''} onChange={e => setEditingOp({...editingOp, breakdownSolution: e.target.value})} className="w-full p-4 border rounded-2xl text-sm font-bold bg-slate-50" />
                                    </div>
                                </>
                            )}

                            <button type="submit" disabled={savingEdit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all mt-4">
                                {savingEdit ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDICIÓN PERSONAL */}
            {editingPersonal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-blue-600 text-white p-5 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Clock size={20}/> Editar Horas Personal</h4>
                            <button onClick={() => setEditingPersonal(null)} className="p-1 hover:bg-blue-500 rounded-lg"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSavePersonalEdit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Trabajadas</label>
                                <input 
                                    type="number" step="0.5" 
                                    value={editingPersonal.hours}
                                    onChange={e => setEditingPersonal({...editingPersonal, hours: Number(e.target.value)})}
                                    className="w-full p-4 border rounded-2xl font-black text-2xl text-center bg-slate-50 focus:bg-white transition-all outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => handleDeletePersonal(editingPersonal.id)} disabled={savingEdit} className="flex-1 py-4 bg-red-50 text-red-600 border-2 border-red-100 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                                    <Trash2 size={16}/> Borrar
                                </button>
                                <button type="submit" disabled={savingEdit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
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
