
import React, { useState, useEffect } from 'react';
import { updateMachineAttributes, addMaintenanceDef, updateMaintenanceDef, deleteMaintenanceDef, getCostCenters, getSubCentersByCenter, calculateAndSyncMachineStatus, getWorkers, deleteMachine, getMachineDependencyCount } from '../../services/db';
import { CostCenter, SubCenter, Machine, MaintenanceDefinition, Worker } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, Edit2, X, AlertTriangle, Loader2, ToggleLeft, ToggleRight, LayoutGrid, Zap, MessageSquare, Mail, Calculator, Truck as TruckIcon, Calendar, Clock } from 'lucide-react';

interface Props {
    machine: Machine;
    onBack: () => void;
    onSuccess: () => void;
}

export const EditMachineForm: React.FC<Props> = ({ machine: initialMachine, onBack, onSuccess }) => {
    const [machine, setMachine] = useState<Machine>(initialMachine);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // --- EDITING STATES ---
    const [name, setName] = useState(machine.name);
    const [companyCode, setCompanyCode] = useState(machine.companyCode || '');
    const [centerId, setCenterId] = useState(machine.costCenterId);
    const [subId, setSubId] = useState(machine.subCenterId || '');
    const [responsibleId, setResponsibleId] = useState(machine.responsibleWorkerId || '');
    const [currentHours, setCurrentHours] = useState(machine.currentHours);
    const [requiresHours, setRequiresHours] = useState(machine.requiresHours);
    const [adminExpenses, setAdminExpenses] = useState(machine.adminExpenses);
    const [transportExpenses, setTransportExpenses] = useState(machine.transportExpenses);
    const [selectableForReports, setSelectableForReports] = useState(machine.selectableForReports ?? true);
    const [active, setActive] = useState(machine.active ?? true);
    const [vinculadaProduccion, setVinculadaProduccion] = useState(machine.vinculadaProduccion ?? false);

    useEffect(() => {
        getCostCenters().then(setCenters);
        getWorkers().then(setWorkers);
        calculateAndSyncMachineStatus(initialMachine).then(setMachine);
    }, [initialMachine]);

    useEffect(() => {
        if (centerId) {
            getSubCentersByCenter(centerId).then(setSubCenters);
        }
    }, [centerId]);

    const handleUpdateBasicInfo = async () => {
        setLoading(true);
        try {
            await updateMachineAttributes(machine.id, {
                name,
                companyCode,
                costCenterId: centerId,
                subCenterId: subId || '', 
                responsibleWorkerId: responsibleId || '', 
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses,
                selectableForReports,
                active,
                vinculadaProduccion
            });
            alert("Datos generales actualizados.");
        } catch (e) {
            console.error("Error updating machine basic info:", e);
            alert("Error al actualizar datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMachine = async () => {
        setLoading(true);
        try {
            const deps = await getMachineDependencyCount(machine.id);
            if (deps.logs > 0 || deps.reports > 0) {
                if (!confirm(`ADVERTENCIA: Tiene ${deps.logs} registros y ${deps.reports} partes. ¿Borrar todo?`)) {
                   setLoading(false); return;
                }
            } else if (!confirm(`¿Borrar "${machine.name}"?`)) {
                setLoading(false); return;
            }
            setDeleting(true);
            await deleteMachine(machine.id);
            onSuccess(); 
        } catch (e) { 
            console.error(e);
            alert("Error al eliminar la máquina"); 
        } finally { 
            setLoading(false); 
            setDeleting(false); 
        }
    };

    const [editingDefId, setEditingDefId] = useState<string | null>(null);
    const [defName, setDefName] = useState('');
    const [defType, setDefType] = useState<'HOURS' | 'DATE'>('HOURS');
    const [defInterval, setDefInterval] = useState<number | ''>('');
    const [defWarning, setDefWarning] = useState<number | ''>('');
    const [defIntervalMonths, setDefIntervalMonths] = useState<number | ''>('');
    const [defNextDate, setDefNextDate] = useState('');
    const [defTasks, setDefTasks] = useState('');

    const resetDefForm = () => { 
        setEditingDefId(null); 
        setDefName(''); 
        setDefType('HOURS'); 
        setDefInterval(''); 
        setDefWarning(''); 
        setDefIntervalMonths(''); 
        setDefNextDate(''); 
        setDefTasks(''); 
    };

    const handleEditClick = (def: MaintenanceDefinition) => {
        setEditingDefId(def.id || null); 
        setDefName(def.name); 
        setDefType(def.maintenanceType || 'HOURS');
        setDefInterval(def.intervalHours || ''); 
        setDefWarning(def.warningHours || ''); 
        setDefIntervalMonths(def.intervalMonths || '');
        setDefNextDate(def.nextDate ? new Date(def.nextDate).toISOString().split('T')[0] : ''); 
        setDefTasks(def.tasks);
    };

    const handleSaveDef = async () => {
        if (!defName) {
            alert("El nombre de la tarea es obligatorio");
            return;
        }
        
        setLoading(true);
        const isNew = editingDefId === 'new';
        
        const defPayload: MaintenanceDefinition = { 
            id: isNew ? undefined : (editingDefId || undefined), 
            machineId: machine.id, 
            name: defName, 
            maintenanceType: defType, 
            intervalHours: defType === 'HOURS' ? Number(defInterval) || 0 : 0, 
            warningHours: defType === 'HOURS' ? Number(defWarning) || 0 : 0, 
            intervalMonths: defType === 'DATE' ? Number(defIntervalMonths) || 0 : 0, 
            nextDate: defType === 'DATE' && defNextDate ? new Date(defNextDate) : undefined, 
            tasks: defTasks,
            notifiedWarning: isNew ? false : (machine.maintenanceDefs.find(d => d.id === editingDefId)?.notifiedWarning || false),
            notifiedOverdue: isNew ? false : (machine.maintenanceDefs.find(d => d.id === editingDefId)?.notifiedOverdue || false),
        };

        try {
            if (isNew) {
                await addMaintenanceDef(defPayload, machine.currentHours);
            } else if (editingDefId) {
                await updateMaintenanceDef(defPayload);
            }
            const updated = await calculateAndSyncMachineStatus(machine); 
            setMachine(updated); 
            resetDefForm();
        } catch (e: any) { 
            console.error("Error al guardar mantenimiento:", e);
            alert("Error al guardar tarea: " + (e.message || "Consulte la consola")); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleDeleteDef = async (defId: string) => {
        if (!confirm("¿Borrar esta tarea programada?")) return;
        setLoading(true);
        try { 
            await deleteMaintenanceDef(defId); 
            const updated = await calculateAndSyncMachineStatus(machine); 
            setMachine(updated); 
        } catch (e) { 
            alert("Error al eliminar mantenimiento"); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Modificar: {machine.name}</h3>
                    {!active && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black uppercase">BAJA</span>}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-bold text-slate-700">Configuración de Activo</h4>
                    <button type="button" onClick={() => setActive(!active)} className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full transition-all ${active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />} {active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2 flex items-center gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg"><Zap size={20} /></div>
                        <div className="flex-1">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900 text-sm">
                                <input type="checkbox" checked={vinculadaProduccion} onChange={e => setVinculadaProduccion(e.target.checked)} className="w-5 h-5 rounded" />
                                Vincular Horas a Producción (Máquina Fija)
                            </label>
                            <p className="text-[10px] text-indigo-600 mt-1">Si se activa, las horas de esta máquina se actualizarán solas al cerrar los partes de producción del subcentro asociado.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                        <input className="w-full p-2 border rounded" value={companyCode} onChange={e => setCompanyCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Coste</label>
                        <select className="w-full p-2 border rounded" value={centerId} onChange={e => { setCenterId(e.target.value); setSubId(''); }}>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><LayoutGrid size={14} /> Subcentro / Planta</label>
                        <select className="w-full p-2 border rounded font-bold" value={subId} onChange={e => setSubId(e.target.value)}>
                            <option value="">-- Sin Subcentro --</option>
                            {subCenters.map(s => (
                                <option key={s.id} value={s.id}>{s.name} {s.tracksProduction ? '📊' : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsable</label>
                        <select className="w-full p-2 border rounded" value={responsibleId} onChange={e => setResponsibleId(e.target.value)}>
                             <option value="">-- Sin Responsable --</option>
                            {workers.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales</label>
                        <input type="number" className="w-full p-2 border rounded font-mono font-bold" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} />
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Control y Visibilidad</h5>
                    
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded">
                        <input type="checkbox" checked={requiresHours} onChange={e => setRequiresHours(e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                        <span className="font-medium text-slate-700 text-sm">Controlar Horas/Kms Manualmente</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer bg-green-50 p-2 rounded border border-green-100">
                        <input type="checkbox" checked={selectableForReports} onChange={e => setSelectableForReports(e.target.checked)} className="w-5 h-5 text-green-600 rounded" />
                        <span className="font-medium text-green-800 text-sm">Seleccionable para Partes de Trabajo de Personal</span>
                    </label>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gastos e Imputaciones</h5>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center gap-2 cursor-pointer p-3 border rounded-xl transition-all ${adminExpenses ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <input 
                                type="checkbox" 
                                checked={adminExpenses} 
                                onChange={e => {
                                    setAdminExpenses(e.target.checked);
                                    if(e.target.checked) setTransportExpenses(false);
                                }} 
                                className="w-5 h-5 rounded" 
                            />
                            <div className="flex items-center gap-2 font-bold text-xs uppercase">
                                <Calculator size={14} /> Admón.
                            </div>
                        </label>
                        
                        <label className={`flex items-center gap-2 cursor-pointer p-3 border rounded-xl transition-all ${transportExpenses ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <input 
                                type="checkbox" 
                                checked={transportExpenses} 
                                onChange={e => {
                                    setTransportExpenses(e.target.checked);
                                    if(e.target.checked) setAdminExpenses(false);
                                }} 
                                className="w-5 h-5 rounded" 
                            />
                            <div className="flex items-center gap-2 font-bold text-xs uppercase">
                                <TruckIcon size={14} /> Transp.
                            </div>
                        </label>
                    </div>
                    <p className="text-[9px] text-slate-400 italic">Los gastos de administración y transporte son mutuamente excluyentes para informes de costes.</p>
                </div>

                <button onClick={handleUpdateBasicInfo} disabled={loading || deleting} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg disabled:bg-slate-300 mt-4">
                    {loading ? 'Guardando...' : 'Guardar Ficha Técnica'}
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-bold text-slate-700">Mantenimientos Programados</h4>
                    <button type="button" onClick={() => setEditingDefId('new')} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Plus size={20} />
                    </button>
                </div>

                {editingDefId && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in slide-in-from-top duration-300">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-black uppercase text-slate-400">{editingDefId === 'new' ? 'Nueva Tarea' : 'Editar Tarea'}</p>
                            <button type="button" onClick={resetDefForm}><X size={16} /></button>
                        </div>
                        
                        <input className="w-full p-2 border rounded" placeholder="Nombre (Ej. Aceite 500h)" value={defName} onChange={e => setDefName(e.target.value)} />
                        
                        <div className="flex gap-1 p-1 bg-slate-200 rounded-lg">
                            <button 
                                type="button" 
                                onClick={() => setDefType('HOURS')} 
                                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[10px] font-black uppercase transition-all ${defType === 'HOURS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <Clock size={14}/> Horas/Km
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setDefType('DATE')} 
                                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-[10px] font-black uppercase transition-all ${defType === 'DATE' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <Calendar size={14}/> Calendario
                            </button>
                        </div>

                        {defType === 'HOURS' ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Intervalo (h)</label>
                                    <input type="number" className="w-full p-2 border rounded" value={defInterval} onChange={e => setDefInterval(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Aviso Previo (h)</label>
                                    <input type="number" className="w-full p-2 border rounded" value={defWarning} onChange={e => setDefWarning(Number(e.target.value))} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Cada (Meses)</label>
                                    <input type="number" className="w-full p-2 border rounded" value={defIntervalMonths} onChange={e => setDefIntervalMonths(Number(e.target.value))} placeholder="Ej. 6" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Siguiente Vencim.</label>
                                    <input type="date" className="w-full p-2 border rounded" value={defNextDate} onChange={e => setDefNextDate(e.target.value)} />
                                </div>
                            </div>
                        )}

                        <textarea className="w-full p-2 border rounded text-xs" placeholder="Tareas a realizar..." rows={2} value={defTasks} onChange={e => setDefTasks(e.target.value)} />
                        
                        <button type="button" onClick={handleSaveDef} disabled={loading} className="w-full py-2 bg-slate-800 text-white rounded font-bold">
                            {loading ? <Loader2 className="animate-spin inline" size={14} /> : 'Guardar Tarea'}
                        </button>
                    </div>
                )}

                <div className="space-y-2">
                    {machine.maintenanceDefs.map((def) => (
                        <div key={def.id || Math.random().toString()} className={`flex justify-between items-center bg-slate-50 p-3 rounded border-2 hover:border-blue-300 transition-colors ${def.maintenanceType === 'DATE' ? 'border-purple-50' : 'border-slate-100'}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800">{def.name}</p>
                                    <div className="flex gap-1">
                                        {def.notifiedWarning && <span title="Aviso Enviado" className="text-amber-500"><MessageSquare size={12} /></span>}
                                        {def.notifiedOverdue && <span title="Vencimiento Enviado" className="text-red-500"><Mail size={12} /></span>}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                    {def.maintenanceType === 'DATE' ? (
                                        <><Calendar size={10} className="text-purple-500"/> Cada {def.intervalMonths} meses (Próximo: {def.nextDate ? new Date(def.nextDate).toLocaleDateString() : '?'})</>
                                    ) : (
                                        <><Clock size={10} className="text-blue-500"/> Cada {def.intervalHours}h (Aviso: {def.warningHours}h)</>
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => handleEditClick(def)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                <button type="button" onClick={() => { if(def.id) handleDeleteDef(def.id); }} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-red-50 p-6 rounded-xl border-2 border-red-100 mx-1">
                <button onClick={handleDeleteMachine} disabled={deleting || loading} className="w-full py-3 bg-white border-2 border-red-500 text-red-600 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                    <Trash2 size={18} /> {deleting ? 'Eliminando...' : 'BORRAR ACTIVO'}
                </button>
            </div>
        </div>
    );
};
