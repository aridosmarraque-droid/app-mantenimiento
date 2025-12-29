
import React, { useState, useEffect } from 'react';
import { getDailyAuditLogs, getWorkers, getAllMachines, getCostCenters, getServiceProviders } from '../../services/db';
import { OperationLog, PersonalReport, Worker, Machine, CostCenter, ServiceProvider } from '../../types';
import { ArrowLeft, Search, Calendar, User, Truck, Droplet, Wrench, Hammer, Fuel, CalendarClock, Loader2, ClipboardList, Info } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DailyAuditViewer: React.FC<Props> = ({ onBack }) => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [auditData, setAuditData] = useState<{ ops: OperationLog[], personal: PersonalReport[] }>({ ops: [], personal: [] });
    
    // Catalogs for display
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

    const fetchAudit = async () => {
        setLoading(true);
        try {
            const data = await getDailyAuditLogs(new Date(date));
            setAuditData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAudit();
    }, [date]);

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
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Auditoría Diaria</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Auditoría</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                        />
                    </div>
                    <button 
                        onClick={fetchAudit}
                        className="bg-slate-800 text-white p-3 rounded-lg hover:bg-slate-900 transition-colors h-12 flex items-center gap-2"
                    >
                        <Search size={18} /> Refrescar
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4" size={40} />
                    <p>Consultando registros...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* SECCIÓN MANTENIMIENTO */}
                    <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-slate-700 font-bold border-l-4 border-l-amber-500 pl-2">
                             MANTENIMIENTO Y OPERACIONES <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{auditData.ops.length}</span>
                        </h4>
                        <div className="grid gap-3">
                            {auditData.ops.map(op => {
                                const cfg = typeConfig[op.type];
                                const Icon = cfg.icon;
                                return (
                                    <div key={op.id} className="bg-white border rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${cfg.color}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 leading-tight">{getMachineName(op.machineId)}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1"><User size={10}/> {getWorkerName(op.workerId)} | {op.hoursAtExecution}h</div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                {op.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 border border-slate-100">
                                            {op.type === 'LEVELS' && `Niveles: Aceite Motor (${op.motorOil}L), Hidr. (${op.hydraulicOil}L), Refrig. (${op.coolant}L)`}
                                            {op.type === 'BREAKDOWN' && (
                                                <>
                                                    <div className="font-bold text-red-600 uppercase text-[9px]">Avería: {op.breakdownCause}</div>
                                                    <div>Solución: {op.breakdownSolution}</div>
                                                </>
                                            )}
                                            {op.type === 'MAINTENANCE' && (
                                                <>
                                                    <div className="font-bold uppercase text-[9px]">{op.maintenanceType}</div>
                                                    <div>{op.description} {op.materials && `| Mat: ${op.materials}`}</div>
                                                </>
                                            )}
                                            {op.type === 'REFUELING' && `Repostaje: ${op.fuelLitres} Litros`}
                                            {op.type === 'SCHEDULED' && `Programado Realizado: ${op.description || "Mant. Def"}`}
                                            <div className="mt-1 text-[9px] text-slate-400 italic">Ejecutado por: {getProviderName(op.repairerId)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                            {auditData.ops.length === 0 && <p className="text-center text-sm text-slate-400 py-6 italic">Sin operaciones registradas este día.</p>}
                        </div>
                    </div>

                    {/* SECCIÓN PARTES TRABAJO PERSONAL */}
                    <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-slate-700 font-bold border-l-4 border-l-green-500 pl-2">
                             PARTES DE TRABAJO PERSONAL <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{auditData.personal.length}</span>
                        </h4>
                        <div className="grid gap-3">
                            {auditData.personal.map(p => (
                                <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all border-l-4 border-l-green-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                                <ClipboardList size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 leading-tight">{getWorkerName(p.workerId)}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                                    <span className="flex items-center gap-1 font-bold text-green-700"><Info size={10}/> {p.hours}h</span>
                                                    <span>{getCenterName(p.costCenterId)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white bg-green-600 px-2 py-1 rounded">TRABAJO</span>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 border border-slate-100">
                                        <div className="font-bold text-[9px] uppercase text-slate-400 mb-1">Máquina / Tajo</div>
                                        <div className="font-semibold">{p.machineName || "General"}</div>
                                        {p.description && (
                                            <div className="mt-2 text-slate-600 italic">"{p.description}"</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {auditData.personal.length === 0 && <p className="text-center text-sm text-slate-400 py-6 italic">Sin partes de trabajo registrados este día.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
