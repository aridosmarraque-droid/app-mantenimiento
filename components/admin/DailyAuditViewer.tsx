
import React, { useState, useEffect, useCallback } from 'react';
import { getDailyAuditLogs, getWorkers, getAllMachines, getCostCenters, getServiceProviders } from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider } from '../../types';
import { ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, Fuel, CalendarClock, Loader2, ClipboardList, Info, AlertCircle } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DailyAuditViewer: React.FC<Props> = ({ onBack }) => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState<{ ops: OperationLog[], personal: PersonalReport[] }>({ ops: [], personal: [] });
    
    // Catalogs
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
        // Limpiamos datos anteriores para evitar "flashes" de info vieja que parezcan duplicados
        setAuditData({ ops: [], personal: [] });
        
        try {
            const data = await getDailyAuditLogs(new Date(date));
            
            // FILTRO DE SEGURIDAD PARA EVITAR DUPLICADOS POR IDS
            const uniqueOps = Array.from(new Map(data.ops.map(item => [item.id, item])).values());
            const uniquePersonal = Array.from(new Map(data.personal.map(item => [item.id, item])).values());
            
            setAuditData({ ops: uniqueOps, personal: uniquePersonal });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Operario Desconocido";
    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : "Máquina Desconocida";
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
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Auditoría Diaria</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4 border border-slate-100">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Auditoría</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)} 
                                className="w-full p-3 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={fetchAudit}
                        disabled={loading}
                        className="bg-slate-800 text-white p-3 rounded-lg hover:bg-slate-900 transition-colors h-12 flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />} 
                        {loading ? 'Buscando...' : 'Refrescar'}
                    </button>
                </div>
                {auditData.ops.length === 0 && auditData.personal.length === 0 && !loading && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg text-xs font-medium">
                        <AlertCircle size={14} /> No hay registros guardados para esta fecha.
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4" size={40} />
                    <p className="font-medium">Consultando registros...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* SECCIÓN MANTENIMIENTO */}
                    <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-slate-700 font-bold border-l-4 border-l-amber-500 pl-2">
                             MANTENIMIENTO Y OPERACIONES <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">{auditData.ops.length}</span>
                        </h4>
                        <div className="grid gap-3">
                            {auditData.ops.map(op => {
                                const cfg = typeConfig[op.type] || { label: 'Otro', icon: Info, color: 'text-slate-600 bg-slate-50' };
                                const Icon = cfg.icon;
                                return (
                                    <div key={`op-${op.id}`} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${cfg.color}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 leading-tight">{getMachineName(op.machineId)}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><User size={10}/> {getWorkerName(op.workerId)} | <span className="font-mono">{op.hoursAtExecution}h</span></div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border">
                                                {op.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-600 border border-slate-100 mt-2">
                                            {op.type === 'LEVELS' && `Niveles: Aceite Motor (${op.motorOil}L), Hidr. (${op.hydraulicOil}L), Refrig. (${op.coolant}L)`}
                                            {op.type === 'BREAKDOWN' && (
                                                <>
                                                    <div className="font-bold text-red-600 uppercase text-[9px] mb-1">Avería: {op.breakdownCause}</div>
                                                    <div className="text-slate-700">Solución: {op.breakdownSolution}</div>
                                                </>
                                            )}
                                            {op.type === 'MAINTENANCE' && (
                                                <>
                                                    <div className="font-bold uppercase text-[9px] text-amber-700 mb-1">{op.maintenanceType}</div>
                                                    <div className="text-slate-700">{op.description} {op.materials && `| Mat: ${op.materials}`}</div>
                                                </>
                                            )}
                                            {op.type === 'REFUELING' && `Repostaje: ${op.fuelLitres} Litros`}
                                            {op.type === 'SCHEDULED' && `Programado Realizado: ${op.description || "Mant. Def"}`}
                                            <div className="mt-2 pt-2 border-t border-slate-200 text-[9px] text-slate-400 italic flex justify-between items-center">
                                                <span>Ejecutado por: {getProviderName(op.repairerId)}</span>
                                                <span className="font-mono text-[8px] opacity-50 uppercase">{op.id.substring(0,8)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {auditData.ops.length === 0 && <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-dashed italic">Sin operaciones de mantenimiento registradas.</p>}
                        </div>
                    </div>

                    {/* SECCIÓN PARTES TRABAJO PERSONAL */}
                    <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-slate-700 font-bold border-l-4 border-l-green-500 pl-2">
                             PARTES DE TRABAJO PERSONAL <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">{auditData.personal.length}</span>
                        </h4>
                        <div className="grid gap-3">
                            {auditData.personal.map(p => (
                                <div key={`p-${p.id}`} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all border-l-4 border-l-green-400">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-100">
                                                <ClipboardList size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 leading-tight">{getWorkerName(p.workerId)}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                                                    <span className="flex items-center gap-1 font-bold text-green-700 bg-green-50 px-1.5 rounded"><Info size={10}/> {p.hours}h</span>
                                                    <span className="opacity-75">{getCenterName(p.costCenterId)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white bg-green-600 px-2 py-1 rounded shadow-sm uppercase tracking-wider">Trabajo</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded text-xs text-slate-700 border border-slate-100">
                                        <div className="font-bold text-[9px] uppercase text-slate-400 mb-1 flex justify-between">
                                            <span>Máquina / Tajo</span>
                                            <span className="font-mono text-[8px] opacity-50">{p.id.substring(0,8)}</span>
                                        </div>
                                        <div className="font-semibold text-slate-800">{p.machineName || "Actividad General"}</div>
                                        {p.description && (
                                            <div className="mt-2.5 text-slate-600 italic leading-relaxed pl-2 border-l-2 border-slate-200">
                                                "{p.description}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {auditData.personal.length === 0 && <p className="text-center text-sm text-slate-400 py-10 bg-white rounded-xl border border-dashed italic">Sin partes de trabajo personal registrados.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
