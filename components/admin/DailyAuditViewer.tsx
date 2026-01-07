import React, { useState, useEffect, useCallback } from 'react';
import { getDailyAuditLogs, getWorkers, getAllMachines, getCostCenters, getServiceProviders, getCPReportsByRange, getCRReportsByRange } from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider, CPDailyReport, CRDailyReport } from '../../types';
import { ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, Fuel, CalendarClock, Loader2, ClipboardList, Info, AlertCircle, Mountain, Waves, ChevronRight, Droplets, Factory } from 'lucide-react';

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
            
            // --- LÓGICA DE DE-DUPLICACIÓN POR CONTENIDO (FINGERPRINT) ---
            const getOpFingerprint = (op: OperationLog) => 
                `${op.machineId}-${op.workerId}-${op.hoursAtExecution}-${op.type}-${new Date(op.date).getTime()}`;
            
            const getPersonalFingerprint = (p: PersonalReport) => 
                `${p.workerId}-${p.machineId || 'none'}-${p.hours}-${new Date(p.date).getTime()}`;

            const uniqueOpsMap = new Map();
            data.ops.forEach(op => {
                const fp = getOpFingerprint(op);
                if (!uniqueOpsMap.has(fp)) uniqueOpsMap.set(fp, op);
            });

            const uniquePersonalMap = new Map();
            data.personal.forEach(p => {
                const fp = getPersonalFingerprint(p);
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

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Desconocido";
    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : "General / Planta";
    };
    const getCenterName = (id?: string) => centers.find(c => c.id === id)?.name || "N/A";
    const getProviderName = (id?: string) => providers.find(p => p.id === id)?.name || "Propio";

    const typeConfig: any = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50' },
        'BREAKDOWN': { label: 'Avería', icon: Wrench, color: 'text-red-600 bg-red-50' },
        'MAINTENANCE': { label: 'Mant.', icon: Hammer, color: 'text-amber-600 bg-amber-50' },
        'REFUELING': { label: 'Repost.', icon: Fuel, color: 'text-green-600 bg-green-50' },
        'SCHEDULED': { label: 'Prog.', icon: CalendarClock, color: 'text-purple-600 bg-purple-50' }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
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
                            {/* CANTERA PURA */}
                            {auditData.cp.map(report => (
                                <div key={`cp-${report.id}`} className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Mountain size={20}/></div>
                                            <div>
                                                <div className="font-bold text-slate-800">Cantera Pura</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-amber-600">{report.millsEnd - report.millsStart}h</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Producción</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div>
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Machacadora</p>
                                            <p className="font-mono font-bold">{report.crusherStart} → {report.crusherEnd}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Molinos</p>
                                            <p className="font-mono font-bold">{report.millsStart} → {report.millsEnd}</p>
                                        </div>
                                    </div>
                                    {report.comments && (
                                        <p className="mt-3 text-xs text-slate-600 italic border-l-2 border-amber-200 pl-3">"{report.comments}"</p>
                                    )}
                                </div>
                            ))}

                            {/* CANTO RODADO */}
                            {auditData.cr.map(report => (
                                <div key={`cr-${report.id}`} className="bg-white border border-teal-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Waves size={20}/></div>
                                            <div>
                                                <div className="font-bold text-slate-800">Canto Rodado</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{getWorkerName(report.workerId)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-teal-600">{(report.washingEnd - report.washingStart + report.triturationEnd - report.triturationStart).toFixed(2)}h</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Tot. Planta</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div>
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Lavado</p>
                                            <p className="font-mono font-bold">{report.washingStart} → {report.washingEnd}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 font-bold uppercase text-[9px]">Trituración</p>
                                            <p className="font-mono font-bold">{report.triturationStart} → {report.triturationEnd}</p>
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
                                    <div key={`op-${op.id}`} className="bg-white border border-blue-50 rounded-2xl p-5 shadow-sm hover:border-blue-200 transition-all">
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
                                            <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-1 rounded-full border">
                                                {new Date(op.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-700 border border-slate-100 leading-relaxed">
                                            {op.type === 'LEVELS' && `Revisión Niveles: Aceite Motor (${op.motorOil}L), Hidráulico (${op.hydraulicOil}L), Refrigerante (${op.coolant}L)`}
                                            {op.type === 'BREAKDOWN' && (
                                                <>
                                                    <div className="font-black text-red-600 uppercase text-[9px] mb-1 flex items-center gap-1"><AlertCircle size={10}/> Avería Detectada</div>
                                                    <div className="font-bold text-slate-800">{op.breakdownCause}</div>
                                                    <div className="mt-1 opacity-80">Solución: {op.breakdownSolution}</div>
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
                                            <div className="mt-2 pt-2 border-t border-slate-200 text-[9px] text-slate-400 font-bold flex justify-between uppercase">
                                                <span>Talleres: {getProviderName(op.repairerId)}</span>
                                                <span className="opacity-40">Ref: {op.id.substring(0,8)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {auditData.ops.length === 0 && <div className="text-center py-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs italic">Sin registros de maquinaria hoy.</div>}
                        </div>
                    </div>

                    {/* BLOQUE 3: PARTES DE PERSONAL */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 text-slate-800 font-black text-sm uppercase tracking-tighter">
                            <span className="bg-green-500 w-2 h-6 rounded-full"></span>
                            3. Personal y Trabajo
                        </h4>
                        <div className="grid gap-3">
                            {auditData.personal.map(p => (
                                <div key={`p-${p.id}`} className="bg-white border border-green-50 rounded-2xl p-5 shadow-sm hover:border-green-200 transition-all">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100"><ClipboardList size={22} /></div>
                                            <div>
                                                <div className="font-black text-slate-900 leading-tight">{getWorkerName(p.workerId)}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1">
                                                    <Factory size={10} className="text-green-600"/> {getCenterName(p.costCenterId)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-center shadow-sm">
                                            <div className="text-sm font-black leading-none">{p.hours}h</div>
                                            <div className="text-[8px] font-bold uppercase opacity-80">Jornada</div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-800 mb-1 uppercase tracking-tight">
                                            <Truck size={12} className="text-green-600"/> {p.machineName || "Sin Máquina Asignada"}
                                        </div>
                                        {p.description && <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-green-200 pl-3">"{p.description}"</p>}
                                    </div>
                                </div>
                            ))}
                            {auditData.personal.length === 0 && <div className="text-center py-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs italic">No hay partes de personal registrados.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
