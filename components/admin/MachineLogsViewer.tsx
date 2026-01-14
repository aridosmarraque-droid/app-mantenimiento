
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAllMachines, getMachineLogs, getWorkers, getServiceProviders, getCostCenters, getSubCentersByCenter, updateOperationLog, deleteOperationLog } from '../../services/db';
import { Machine, OperationLog, OperationType, Worker, ServiceProvider, CostCenter, SubCenter } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, FileText, Download, Droplet, Wrench, Hammer, Fuel, CalendarClock, Factory, Truck, Loader2, Info, LayoutGrid, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const MachineLogsViewer: React.FC<Props> = ({ onBack }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [providers, setProviders] = useState<ServiceProvider[]>([]);
    
    // Filters
    const [selectedCenterId, setSelectedCenterId] = useState('');
    const [selectedSubId, setSelectedSubId] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<OperationType[]>([]);

    // Results
    const [logs, setLogs] = useState<OperationLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const searchIdRef = useRef(0);

    // Edit Modal State
    const [editingLog, setEditingLog] = useState<OperationLog | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        getCostCenters().then(setCenters);
        getAllMachines().then(setMachines);
        getWorkers(false).then(setWorkers);
        getServiceProviders().then(setProviders);
    }, []);

    // Cargar subcentros cuando cambia el centro
    useEffect(() => {
        if (selectedCenterId) {
            getSubCentersByCenter(selectedCenterId).then(setSubCenters);
        } else {
            setSubCenters([]);
        }
    }, [selectedCenterId]);

    // Máquinas filtradas basadas en centro y subcentro
    const filteredMachines = useMemo(() => {
        if (!selectedCenterId) return [];
        let filtered = machines.filter(m => m.costCenterId === selectedCenterId);
        if (selectedSubId) {
            filtered = filtered.filter(m => m.subCenterId === selectedSubId);
        }
        return filtered;
    }, [selectedCenterId, selectedSubId, machines]);

    const handleSearch = async () => {
        if (!selectedMachineId || loading) return;
        
        const currentSearchId = ++searchIdRef.current;
        setLoading(true);
        setHasSearched(true);
        
        try {
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;
            const data = await getMachineLogs(selectedMachineId, start, end, selectedTypes);
            
            if (currentSearchId !== searchIdRef.current) return; 

            // Fidelidad total: se muestra exactamente lo devuelto por DB
            setLogs(data || []);
        } catch (error) {
            console.error("Error al buscar logs:", error);
        } finally {
            if (currentSearchId === searchIdRef.current) {
                setLoading(false);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar este registro de la base de datos de forma permanente?")) return;
        try {
            setLoading(true);
            await deleteOperationLog(id);
            await handleSearch(); // Recargar tras borrar
        } catch (e) {
            alert("Error al borrar registro.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLog) return;
        setSavingEdit(true);
        try {
            await updateOperationLog(editingLog.id, editingLog);
            setEditingLog(null);
            await handleSearch(); // Recargar tras editar
        } catch (e) {
            alert("Error al actualizar registro.");
        } finally {
            setSavingEdit(false);
        }
    };

    const toggleType = (type: OperationType) => {
        if (selectedTypes.includes(type)) {
            setSelectedTypes(selectedTypes.filter(t => t !== type));
        } else {
            setSelectedTypes([...selectedTypes, type]);
        }
    };

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || "Operario " + id;
    const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || 'Propio';

    const renderLogDetails = (log: OperationLog) => {
        switch (log.type) {
            case 'LEVELS':
                return (
                    <div className="text-sm">
                        <div className="grid grid-cols-3 gap-2">
                            {log.motorOil ? <div className="bg-blue-50 p-2 rounded text-center">Oil Motor<br/><span className="font-bold">{log.motorOil}L</span></div> : null}
                            {log.hydraulicOil ? <div className="bg-blue-50 p-2 rounded text-center">Oil Hidr.<br/><span className="font-bold">{log.hydraulicOil}L</span></div> : null}
                            {log.coolant ? <div className="bg-blue-50 p-2 rounded text-center">Refrig.<br/><span className="font-bold">{log.coolant}L</span></div> : null}
                        </div>
                    </div>
                );
            case 'BREAKDOWN':
                return (
                    <div className="text-sm">
                        <div className="font-bold text-red-700 flex items-center gap-1 mb-1 uppercase text-[10px]">Causa detectada:</div>
                        <div className="bg-red-50 p-2 rounded text-slate-700 font-medium mb-2 border border-red-100">{log.breakdownCause}</div>
                        <div className="font-bold text-slate-800 flex items-center gap-1 mb-1 uppercase text-[10px]">Solución aplicada:</div>
                        <div className="bg-slate-100 p-2 rounded text-slate-600">{log.breakdownSolution}</div>
                    </div>
                );
            case 'MAINTENANCE':
                return (
                    <div className="text-sm">
                        <div className="font-bold uppercase text-[10px] text-amber-700 mb-1">{log.maintenanceType}</div>
                        {log.description && <div className="text-slate-800 font-medium">{log.description}</div>}
                        {log.materials && <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded italic">Materiales: {log.materials}</div>}
                    </div>
                );
            case 'SCHEDULED':
                return (
                    <div className="text-sm">
                         <div className="font-bold text-purple-700 uppercase text-[10px] mb-1">Mantenimiento Programado Realizado</div>
                         <div className="text-slate-800 font-bold">{log.description || 'Definición de sistema'}</div>
                    </div>
                );
            case 'REFUELING':
                return (
                    <div className="text-lg font-black text-green-700 flex items-center gap-2">
                        <Fuel size={20}/> {log.fuelLitres} Litros
                    </div>
                );
            default: return null;
        }
    };

    const typeConfig = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50 border-blue-200 shadow-blue-100' },
        'BREAKDOWN': { label: 'Averías', icon: Wrench, color: 'text-red-600 bg-red-50 border-red-200 shadow-red-100' },
        'MAINTENANCE': { label: 'Mantenimiento', icon: Hammer, color: 'text-amber-600 bg-amber-50 border-amber-200 shadow-amber-100' },
        'REFUELING': { label: 'Repostaje', icon: Fuel, color: 'text-green-600 bg-green-50 border-green-200 shadow-green-100' },
        'SCHEDULED': { label: 'Programado', icon: CalendarClock, color: 'text-purple-600 bg-purple-50 border-purple-200 shadow-purple-100' }
    };

    return (
        <div className="space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
             <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Registros por Máquina</h3>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-md space-y-5 border border-slate-100 mx-1">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                        <Factory size={14} className="text-blue-500" /> 1. Centro de Trabajo
                    </label>
                    <select 
                        value={selectedCenterId}
                        onChange={e => {
                            setSelectedCenterId(e.target.value);
                            setSelectedSubId('');
                            setSelectedMachineId('');
                            setHasSearched(false);
                            setLogs([]);
                        }}
                        className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none shadow-sm"
                    >
                        <option value="">-- Seleccionar Centro --</option>
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                        <LayoutGrid size={14} className="text-blue-500" /> 2. Subcentro / Planta
                    </label>
                    <select 
                        disabled={!selectedCenterId}
                        value={selectedSubId}
                        onChange={e => {
                            setSelectedSubId(e.target.value);
                            setSelectedMachineId('');
                            setHasSearched(false);
                            setLogs([]);
                        }}
                        className={`w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none shadow-sm transition-all ${!selectedCenterId ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        <option value="">-- Todos los Subcentros --</option>
                        {subCenters.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                        <Truck size={14} className="text-blue-500" /> 3. Selección de Máquina
                    </label>
                    <select 
                        disabled={!selectedCenterId}
                        value={selectedMachineId}
                        onChange={e => {
                            setSelectedMachineId(e.target.value);
                            setHasSearched(false);
                            setLogs([]);
                        }}
                        className={`w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-bold shadow-sm ${!selectedCenterId ? 'opacity-40 bg-slate-100 cursor-not-allowed' : 'bg-white text-slate-800'}`}
                    >
                        <option value="">{selectedCenterId ? '-- Elegir Unidad --' : '-- Primero seleccione centro --'}</option>
                        {filteredMachines.map(m => (
                            <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2 flex items-center gap-1 tracking-widest">
                            <Calendar size={14} /> Inicio
                        </label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2 flex items-center gap-1 tracking-widest">
                            <Calendar size={14} /> Fin
                        </label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Tipos de Registro</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(typeConfig) as OperationType[]).map(type => (
                            <label key={type} className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all ${selectedTypes.includes(type) ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                                <input type="checkbox" checked={selectedTypes.includes(type)} onChange={() => toggleType(type)} className="hidden" />
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedTypes.includes(type) ? 'bg-white border-white' : 'border-slate-300'}`}>
                                    {selectedTypes.includes(type) && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"/>}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-tight">{typeConfig[type].label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleSearch}
                    disabled={!selectedMachineId || loading}
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-slate-200 uppercase tracking-widest"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} 
                    {loading ? 'Consultando...' : 'Obtener Registros'}
                </button>
            </div>

            {/* Results */}
            {hasSearched && (
                <div className="bg-white p-5 rounded-2xl shadow-md min-h-[300px] border border-slate-100 mx-1">
                    <div className="flex justify-between items-center border-b pb-4 mb-6">
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Listado Histórico</h4>
                        <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full uppercase">{logs.length} Resultados</span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="text-sm font-black uppercase tracking-widest">Procesando datos...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-slate-400 py-20 flex flex-col items-center">
                            <div className="bg-slate-50 p-6 rounded-full mb-4"><FileText size={48} className="opacity-20" /></div>
                            <p className="font-bold text-sm">No se han encontrado registros</p>
                            <p className="text-xs opacity-60">Pruebe a cambiar los filtros de fecha o tipo.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {logs.map(log => {
                                const conf = typeConfig[log.type] || { label: 'Otro', icon: FileText, color: 'text-slate-500 bg-slate-50 border-slate-100' };
                                const Icon = conf.icon;
                                return (
                                    <div key={log.id} className="flex gap-4 p-5 border-2 border-slate-50 rounded-2xl hover:border-blue-100 transition-all shadow-sm group relative">
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => setEditingLog(log)} className="p-2 bg-white text-blue-600 rounded-lg shadow border border-blue-50 hover:bg-blue-50" title="Editar">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(log.id)} className="p-2 bg-white text-red-600 rounded-lg shadow border border-red-50 hover:bg-red-50" title="Borrar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${conf.color}`}>
                                            <Icon size={28} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider">{conf.label}</span>
                                                <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
                                                    <Calendar size={10}/> {new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 flex items-center gap-3 mb-3">
                                                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded uppercase">{getWorkerName(log.workerId)}</span>
                                                <span className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{log.hoursAtExecution}h</span>
                                            </div>
                                            <div className="bg-slate-50/50 p-4 rounded-xl text-slate-700 border border-slate-100">
                                                {renderLogDetails(log)}
                                            </div>
                                            <div className="mt-3 flex justify-between items-center text-[8px] font-bold text-slate-300 uppercase">
                                                <span>Realizado por: {getProviderName(log.repairerId || '')}</span>
                                                <span className="font-mono opacity-50">Ref: {log.id.substring(0, 12)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DE EDICIÓN (Reusado de Auditoría para consistencia) */}
            {editingLog && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <h4 className="font-bold flex items-center gap-2"><Wrench size={18}/> Editar Registro Técnico</h4>
                            <button onClick={() => setEditingLog(null)}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fecha Registro</label>
                                <input 
                                    type="date" 
                                    value={new Date(editingLog.date).toISOString().split('T')[0]}
                                    onChange={e => setEditingLog({...editingLog, date: new Date(e.target.value)})}
                                    className="w-full p-3 border rounded-xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horas Registro</label>
                                <input 
                                    type="number" step="0.01" 
                                    value={editingLog.hoursAtExecution}
                                    onChange={e => setEditingLog({...editingLog, hoursAtExecution: Number(e.target.value)})}
                                    className="w-full p-3 border rounded-xl font-bold"
                                />
                            </div>

                            {editingLog.type === 'LEVELS' && (
                                <div className="grid grid-cols-1 gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Aceite Motor (L)</label>
                                        <input type="number" step="0.1" value={editingLog.motorOil ?? ''} onChange={e => setEditingLog({...editingLog, motorOil: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Aceite Hidráulico (L)</label>
                                        <input type="number" step="0.1" value={editingLog.hydraulicOil ?? ''} onChange={e => setEditingLog({...editingLog, hydraulicOil: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Refrigerante (L)</label>
                                        <input type="number" step="0.1" value={editingLog.coolant ?? ''} onChange={e => setEditingLog({...editingLog, coolant: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                    </div>
                                </div>
                            )}

                            {editingLog.type === 'REFUELING' && (
                                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                    <label className="block text-[10px] font-black text-green-600 uppercase mb-1">Litros Repostados</label>
                                    <input type="number" step="0.1" value={editingLog.fuelLitres ?? ''} onChange={e => setEditingLog({...editingLog, fuelLitres: Number(e.target.value)})} className="w-full p-3 border rounded-lg bg-white font-bold text-lg" />
                                </div>
                            )}

                            {editingLog.type === 'BREAKDOWN' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Causa de la Avería</label>
                                        <textarea rows={2} value={editingLog.breakdownCause || ''} onChange={e => setEditingLog({...editingLog, breakdownCause: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Solución Adoptada</label>
                                        <textarea rows={2} value={editingLog.breakdownSolution || ''} onChange={e => setEditingLog({...editingLog, breakdownSolution: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                    </div>
                                </>
                            )}

                            {(editingLog.type === 'MAINTENANCE' || editingLog.type === 'SCHEDULED') && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción / Notas</label>
                                    <textarea rows={3} value={editingLog.description || ''} onChange={e => setEditingLog({...editingLog, description: e.target.value})} className="w-full p-3 border rounded-xl text-sm" />
                                </div>
                            )}

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setEditingLog(null)} className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 rounded-xl">Cancelar</button>
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
