import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    getDailyAuditLogs, 
    getWorkers, 
    getAllMachines, 
    getCostCenters, 
    getServiceProviders, 
    getCPReportsByRange, 
    getCRReportsByRange,
    updateOperationLog,
    updatePersonalReport
} from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider, CPDailyReport, CRDailyReport } from '../../types';
import { 
    ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, 
    Fuel, CalendarClock, Loader2, ClipboardList, Info, AlertCircle, 
    Mountain, Waves, Droplets, Factory, Edit2, Save, X, UserX, Clock,
    CheckCircle2
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

    useEffect(() => {
        Promise.all([
            getWorkers(false),
            getAllMachines(),
            getCostCenters(),
            getServiceProviders()
        ]).then(([w, m, c, p]) => {
            setWorkers(w);
            setMachines(m);
            setCenters(c);
            setProviders(p);
        });
    }, []);

    const fetchAudit = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        
        try {
            const selectedDate = new Date(date);
            const [data, cpData, crData] = await Promise.all([
                getDailyAuditLogs(selectedDate),
                getCPReportsByRange(selectedDate, selectedDate),
                getCRReportsByRange(selectedDate, selectedDate)
            ]);
            
            // --- LÓGICA DE DE-DUPLICACIÓN ---
            const uniqueOpsMap = new Map();
            data.ops.forEach(op => {
                const fp = `${op.machineId}-${op.workerId}-${op.hoursAtExecution}-${op.type}-${new Date(op.date).getTime()}`;
                if (!uniqueOpsMap.has(fp)) uniqueOpsMap.set(fp, op);
            });

            const uniquePersonalMap = new Map();
            data.personal.forEach(p => {
                const fp = `${p.workerId}-${p.machineId || 'none'}-${p.hours}-${new Date(p.date).getTime()}`;
                if (!uniquePersonalMap.has(fp)) uniquePersonalMap.set(fp, p);
            });

            setAuditData({ 
                ops: Array.from(uniqueOpsMap.values()), 
                personal: Array.from(uniquePersonalMap.values()),
                cp: cpData,
                cr: crData
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    // --- LÓGICA DE AGRUPACIÓN POR TRABAJADOR ---
    const workerReports = useMemo(() => {
        // Agrupar los reportes personales por trabajador
        const grouped = new Map<string, { worker: Worker, reports: PersonalReport[], totalHours: number }>();
        
        // Solo auditar trabajadores que:
        // 1. Están activos
        // 2. No son admins
        // 3. TIENEN MARCADO "REQUIERE PARTE"
        workers
            .filter(w => w.active && w.role !== 'admin' && w.requiresReport !== false)
            .forEach(w => {
                grouped.set(w.id, { worker: w, reports: [], totalHours: 0 });
            });

        // Llenar con los reportes encontrados para estos trabajadores
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

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Desconocido";
    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : "General / Planta";
    };

    const typeConfig: any = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50' },
        'BREAKDOWN': { label: 'Avería', icon: Wrench, color: 'text-red-600 bg-red-50' },
        'MAINTENANCE': { label: 'Mant.', icon: Hammer, color: 'text-amber-600 bg-amber-50' },
        'REFUELING': { label: 'Repost.', icon: Fuel, color: 'text-green-600 bg-green-50' },
        'SCHEDULED': { label: 'Prog.', icon: CalendarClock, color: 'text-purple-600 bg-purple-50' }
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
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
                    <p className="font-bold animate-pulse">Sincronizando documentación...</p>
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
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Mountain size={20}/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Cantera Pura</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px]">Machacadora</p>
                                                <p className="font-mono font-bold text-xs">{report.crusherStart} → {report.crusherEnd}</p>
                                            </div>
                                            <div className="bg-amber-100 text-amber-900 px-3 py-1 rounded-lg font-black text-xs shadow-sm border border-amber-200">
                                                {report.crusherEnd - report.crusherStart}h
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px]">Molinos</p>
                                                <p className="font-mono font-bold text-xs">{report.millsStart} → {report.millsEnd}</p>
                                            </div>
                                            <div className="bg-amber-100 text-amber-900 px-3 py-1 rounded-lg font-black text-xs shadow-sm border border-amber-200">
                                                {report.millsEnd - report.millsStart}h
                                            </div>
                                        </div>
                                    </div>
                                    {report.comments && (
                                        <p className="mt-3 text-xs text-slate-600 italic border-l-2 border-amber-200 pl-3">"{report.comments}"</p>
                                    )}
                                </div>
                            ))}

                            {auditData.cr.map(report => (
                                <div key={`cr-${report.id}`} className="bg-white border border-teal-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Waves size={20}/></div>
                                        <div>
                                            <div className="font-bold text-slate-800">Canto Rodado</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px]">Lavado</p>
                                                <p className="font-mono font-bold text-xs">{(report.washingStart || 0).toFixed(2)} → {(report.washingEnd || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="bg-amber-800 text-white px-3 py-1 rounded-lg font-black text-xs shadow-sm border border-amber-900">
                                                {(report.washingEnd - report.washingStart).toFixed(2)}h
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-slate-400 font-bold uppercase text-[9px]">Trituración</p>
                                                <p className="font-mono font-bold text-xs">{(report.triturationStart || 0).toFixed(2)} → {(report.triturationEnd || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="bg-amber-800 text-white px-3 py-1 rounded-lg font-black text-xs shadow-sm border border-amber-900">
                                                {(report.triturationEnd - report.triturationStart).toFixed(2)}h
                                            </div>
                                        </div>
                                    </div>
                                    {report.comments && (
                                        <p className="mt-3 text-xs text-slate-600 italic border-l-2 border-teal-200 pl-3">"{report.comments}"</p>
                                    )}
                                </div>
                            ))}

                            {auditData.cp.length === 0 && auditData.cr.length === 0 && (
                                <div className="text-center py-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs italic">
                                    No hay reportes de producción registrados hoy.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BLOQUE 2: MANTENIMIENTO MAQUINARIA */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-blue-500 w-2 h-6 rounded-full"></span>
                            2. Mantenimiento y Maquinaria
                        </h4>
                        <div className="grid gap-3">
                            {auditData.ops.map(op => {
                                const cfg = typeConfig[op.type] || { label: 'Otro', icon: Info, color: 'text-slate-600 bg-slate-50' };
                                const Icon = cfg.icon;
                                return (
                                    <div key={`op-${op.id}`} className="bg-white border border-blue-50 rounded-2xl p-5 shadow-sm hover:border-blue-200 transition-all group relative">
                                        <button 
                                            onClick={() => setEditingOp(op)}
                                            className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl ${cfg.color} border shadow-sm`}>
                                                    <Icon size={22} />
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-slate-900 leading-tight">{getMachineName(op.machineId)}</div>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-bold uppercase mt-1">
                                                        <User size={10} className="text-blue-500"/> {getWorkerName(op.workerId)} 
                                                        <span className="mx-1">•</span> 
                                                        <span className="text-blue-600">{op.hoursAtExecution}H</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-700 border border-slate-100 leading-relaxed">
                                            {op.type === 'LEVELS' && (
                                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                    {(op.motorOil ?? 0) > 0 && <span>Motor: <strong>{op.motorOil}L</strong></span>}
                                                    {(op.hydraulicOil ?? 0) > 0 && <span>Hidráulico: <strong>{op.hydraulicOil}L</strong></span>}
                                                    {(op.coolant ?? 0) > 0 && <span>Refrigerante: <strong>{op.coolant}L</strong></span>}
                                                    {(!op.motorOil && !op.hydraulicOil && !op.coolant) && "Revisión niveles correcta (sin consumos)."}
                                                </div>
                                            )}
                                            {op.type === 'BREAKDOWN' && (
                                                <>
                                                    <div className="font-black text-red-600 uppercase text-[9px] mb-1 flex items-center gap-1"><AlertCircle size={10}/> Avería Detectada</div>
                                                    <div className="font-bold text-slate-800">{op.breakdownCause}</div>
                                                    <div className="mt-1 opacity-80">Solución: {op.breakdownSolution || 'Pendiente de registrar solución.'}</div>
                                                </>
                                            )}
                                            {op.type === 'MAINTENANCE' && (
                                                <>
                                                    <div className="font-black uppercase text-[9px] text-amber-700 mb-1">{op.maintenanceType}</div>
                                                    <div>{op.description} {op.materials && <span className="text-slate-400">• Materiales: {op.materials}</span>}</div>
                                                </>
                                            )}
                                            {op.type === 'REFUELING' && <div className="font-bold text-green-700">Suministro Combustible: {op.fuelLitres} Litros</div>}
                                            {op.type === 'SCHEDULED' && <div className="font-bold text-purple-700">Mantenimiento Programado: {op.description}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                            {auditData.ops.length === 0 && <div className="text-center py-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs italic">Sin registros de maquinaria hoy.</div>}
                        </div>
                    </div>

                    {/* BLOQUE 3: PARTES DE PERSONAL AGRUPADOS */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-green-500 w-2 h-6 rounded-full"></span>
                            3. Personal y Trabajo (Jornadas)
                        </h4>

                        <div className="grid gap-4">
                            {workerReports.map(({ worker, reports, totalHours }) => {
                                const expected = worker.expectedHours || 0;
                                const diff = totalHours - expected;
                                const matches = totalHours === expected && expected > 0;
                                const hasReports = reports.length > 0;

                                return (
                                    <div key={`worker-${worker.id}`} className={`bg-white rounded-2xl shadow-md border overflow-hidden relative transition-all ${!hasReports ? 'border-red-100 opacity-70 bg-red-50/20' : 'border-slate-100'}`}>
                                        
                                        {/* Marca Verde Superior si coincide jornada */}
                                        {hasReports && matches && (
                                            <div className="absolute top-0 right-0 w-12 h-12 flex items-center justify-center bg-green-500 text-white rounded-bl-3xl shadow-sm z-10">
                                                <CheckCircle2 size={24} />
                                            </div>
                                        )}

                                        {/* Cabecera del trabajador */}
                                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${worker.role === 'cp' ? 'bg-amber-100 text-amber-600' : worker.role === 'cr' ? 'bg-teal-100 text-teal-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    <User size={20}/>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 leading-none">{worker.name}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{worker.role === 'cp' ? 'Cantera' : worker.role === 'cr' ? 'Rodado' : 'Operario'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-black text-slate-500 uppercase tracking-tighter">Total Hoy</div>
                                                <div className={`text-xl font-black ${hasReports && diff < 0 ? 'text-red-600' : hasReports && diff > 0 ? 'text-indigo-600' : hasReports ? 'text-green-600' : 'text-red-400'}`}>
                                                    {totalHours}h
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desglose de reportes */}
                                        <div className="p-4 space-y-3">
                                            {!hasReports ? (
                                                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase animate-pulse">
                                                    <UserX size={14}/> Pendiente de Registro Diario
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {reports.map(p => (
                                                        <div key={p.id} className="flex justify-between items-center group">
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-black text-slate-800 flex items-center gap-1">
                                                                    <Factory size={10} className="text-blue-500"/> {p.costCenterName}
                                                                    <span className="text-slate-300 mx-1">/</span>
                                                                    <Truck size={10} className="text-green-500"/> {p.machineName || 'General'}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border">{p.hours}h</span>
                                                                <button 
                                                                    onClick={() => setEditingPersonal(p)}
                                                                    className="p-1 text-slate-300 hover:text-blue-600 transition-colors"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Comparativa con jornada esperada */}
                                        <div className="px-4 py-2 bg-slate-50 border-t flex justify-between items-center">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Jornada Esperada: {expected}h</div>
                                            {hasReports && expected > 0 && totalHours !== expected && (
                                                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${diff < 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                    Diferencia: {diff > 0 ? '+' : ''}{diff}h
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {workerReports.length === 0 && (
                                <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs italic">
                                    No hay trabajadores activos que requieran parte de trabajo hoy.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODALES DE EDICIÓN */}
            {editingOp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Wrench size={18}/> Editar Registro Técnico</h4>
                            <button onClick={() => setEditingOp(null)}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSaveOpEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Registro</label>
                                <input 
                                    type="number" step="0.01" 
                                    value={editingOp.hoursAtExecution}
                                    onChange={e => setEditingOp({...editingOp, hoursAtExecution: Number(e.target.value)})}
                                    className="w-full p-3 border rounded-xl font-bold"
                                />
                            </div>

                            {editingOp.type === 'LEVELS' && (
                                <div className="grid grid-cols-1 gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Aceite Motor (L)</label>
                                        <input type="number" step="0.1" value={editingOp.motorOil ?? ''} onChange={e => setEditingOp({...editingOp, motorOil: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Aceite Hidráulico (L)</label>
                                        <input type="number" step="0.1" value={editingOp.hydraulicOil ?? ''} onChange={e => setEditingOp({...editingOp, hydraulicOil: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Refrigerante (L)</label>
                                        <input type="number" step="0.1" value={editingOp.coolant ?? ''} onChange={e => setEditingOp({...editingOp, coolant: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                </div>
                            )}

                            {editingOp.type === 'REFUELING' && (
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <label className="block text-[10px] font-black text-green-600 uppercase mb-1">Litros Repostados</label>
                                    <input type="number" step="0.1" value={editingOp.fuelLitres ?? ''} onChange={e => setEditingOp({...editingOp, fuelLitres: Number(e.target.value)})} className="w-full p-3 border rounded-lg bg-white font-bold text-lg" />
                                </div>
                            )}

                            {editingOp.type === 'BREAKDOWN' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Causa de la Avería</label>
                                        <textarea rows={2} value={editingOp.breakdownCause || ''} onChange={e => setEditingOp({...editingOp, breakdownCause: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Solución Adoptada</label>
                                        <textarea rows={2} value={editingOp.breakdownSolution || ''} onChange={e => setEditingOp({...editingOp, breakdownSolution: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                </>
                            )}

                            {(editingOp.type === 'MAINTENANCE' || editingOp.type === 'SCHEDULED') && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción / Notas</label>
                                    <textarea rows={3} value={editingOp.description || ''} onChange={e => setEditingOp({...editingOp, description: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setEditingOp(null)} className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 rounded-xl">Cancelar</button>
                                <button type="submit" disabled={savingEdit} className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2">
                                    {savingEdit ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingPersonal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><User size={18}/> Editar Parte de Personal</h4>
                            <button onClick={() => setEditingPersonal(null)}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSavePersonalEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fecha del Parte</label>
                                <input 
                                    type="date" 
                                    value={editingPersonal.date instanceof Date ? editingPersonal.date.toISOString().split('T')[0] : new Date(editingPersonal.date).toISOString().split('T')[0]}
                                    onChange={e => setEditingPersonal({...editingPersonal, date: new Date(e.target.value)})}
                                    className="w-full p-3 border rounded-xl font-bold bg-amber-50 border-amber-200"
                                />
                                <p className="text-[9px] text-amber-600 mt-1 font-bold uppercase tracking-tighter">* Utilice esto solo para corregir errores de fecha.</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Jornada</label>
                                <input 
                                    type="number" step="0.5" 
                                    value={editingPersonal.hours}
                                    onChange={e => setEditingPersonal({...editingPersonal, hours: Number(e.target.value)})}
                                    className="w-full p-3 border rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Máquina Seleccionada</label>
                                <select 
                                    value={editingPersonal.machineId}
                                    onChange={e => setEditingPersonal({...editingPersonal, machineId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-white"
                                >
                                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Centro de Trabajo</label>
                                <select 
                                    value={editingPersonal.costCenterId}
                                    onChange={e => setEditingPersonal({...editingPersonal, costCenterId: e.target.value})}
                                    className="w-full p-3 border rounded-xl font-bold bg-white"
                                >
                                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción de Trabajo</label>
                                <textarea 
                                    rows={3}
                                    value={editingPersonal.description || ''}
                                    onChange={e => setEditingPersonal({...editingPersonal, description: e.target.value})}
                                    className="w-full p-3 border rounded-xl text-sm"
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setEditingPersonal(null)} className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 rounded-xl">Cancelar</button>
                                <button type="submit" disabled={savingEdit} className="flex-1 py-3 font-bold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2">
                                    {savingEdit ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
