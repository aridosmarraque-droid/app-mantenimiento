import React, { useState, useEffect } from 'react';
import { updateMachineAttributes, addMaintenanceDef, updateMaintenanceDef, deleteMaintenanceDef, getCostCenters, getSubCentersByCenter, calculateAndSyncMachineStatus, getWorkers, deleteMachine, getMachineDependencyCount } from '../../services/db';
import { CostCenter, SubCenter, Machine, MaintenanceDefinition, Worker } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, Edit2, X, AlertTriangle, Loader2, ToggleLeft, ToggleRight, LayoutGrid, Zap, MessageSquare, Mail, Calculator, Truck as TruckIcon, Calendar, Clock, User } from 'lucide-react';

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
    
    // --- EDITING MACHINE STATES ---
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
    const [activo, setActivo] = useState(machine.activo ?? true);
    const [vinculadaProduccion, setVinculadaProduccion] = useState(machine.vinculadaProduccion ?? false);

    // --- MAINTENANCE DEFS STATE ---
    const [editingDefId, setEditingDefId] = useState<string | null>(null);
    const [newDefName, setNewDefName] = useState('');
    const [newDefType, setNewDefType] = useState<'HOURS' | 'DATE'>('HOURS');
    const [newDefInterval, setNewDefInterval] = useState<number | ''>('');
    const [newDefWarning, setNewDefWarning] = useState<number | ''>('');
    const [newDefIntervalMonths, setNewDefIntervalMonths] = useState<number | ''>('');
    const [newDefNextDate, setNewDefNextDate] = useState('');
    const [newDefTasks, setNewDefTasks] = useState('');

    useEffect(() => {
        getCostCenters().then(setCenters);
        getWorkers(false).then(setWorkers); // Cargar todos los trabajadores (activos e inactivos para historial)
        calculateAndSyncMachineStatus(initialMachine).then(setMachine);
    }, [initialMachine]);

    useEffect(() => {
        if (centerId) {
            getSubCentersByCenter(centerId).then(setSubCenters);
        } else {
            setSubCenters([]);
        }
    }, [centerId]);

    const handleUpdateMachine = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateMachineAttributes(machine.id, {
                name,
                companyCode,
                costCenterId: centerId,
                subCenterId: subId || undefined,
                responsibleWorkerId: responsibleId || undefined,
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses,
                selectableForReports,
                activo,
                vinculadaProduccion
            });
            alert("Máquina actualizada correctamente.");
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al actualizar máquina.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMachine = async () => {
        const { logs, reports } = await getMachineDependencyCount(machine.id);
        if (logs > 0 || reports > 0) {
            alert(`No se puede eliminar: tiene ${logs} registros técnicos y ${reports} partes de trabajo vinculados. Primero bórrelos o inactive la máquina.`);
            return;
        }
        if (!confirm("¿Seguro que desea eliminar esta máquina permanentemente?")) return;
        
        setDeleting(true);
        try {
            await deleteMachine(machine.id);
            alert("Máquina eliminada.");
            onSuccess();
        } catch (e) {
            alert("Error al eliminar.");
        } finally {
            setDeleting(false);
        }
    };

    // --- GESTIÓN DE TAREAS DEL PLAN ---

    const resetDefForm = () => {
        setEditingDefId(null);
        setNewDefName('');
        setNewDefInterval('');
        setNewDefWarning('');
        setNewDefTasks('');
        setNewDefIntervalMonths('');
        setNewDefNextDate('');
        setNewDefType('HOURS');
    };

    const handleEditDef = (def: MaintenanceDefinition) => {
        setEditingDefId(def.id || null);
        setNewDefName(def.name);
        setNewDefType(def.maintenanceType);
        setNewDefInterval(def.intervalHours || '');
        setNewDefWarning(def.warningHours || '');
        setNewDefIntervalMonths(def.intervalMonths || '');
        setNewDefNextDate(def.nextDate ? new Date(def.nextDate).toISOString().split('T')[0] : '');
        setNewDefTasks(def.tasks);
        // Scroll to form
        window.scrollTo({ top: document.getElementById('plan-form')?.offsetTop ? document.getElementById('plan-form')!.offsetTop - 100 : 0, behavior: 'smooth' });
    };

    const handleSaveDef = async () => {
        if (!newDefName) {
            alert("El nombre de la tarea es obligatorio.");
            return;
        }

        const defPayload: MaintenanceDefinition = {
            id: editingDefId || undefined,
            machineId: machine.id,
            name: newDefName,
            tasks: newDefTasks,
            maintenanceType: newDefType,
            intervalHours: Number(newDefInterval) || 0,
            warningHours: Number(newDefWarning) || 0,
            intervalMonths: Number(newDefIntervalMonths) || 0,
            nextDate: newDefNextDate ? new Date(newDefNextDate) : undefined
        };

        try {
            if (editingDefId) {
                await updateMaintenanceDef(defPayload);
                alert("Tarea actualizada.");
            } else {
                await addMaintenanceDef(defPayload, currentHours);
                alert("Tarea añadida al plan.");
            }
            
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
            resetDefForm();
        } catch (e) { 
            console.error(e);
            alert("Error al guardar la tarea del plan."); 
        }
    };

    const handleRemoveDef = async (id: string) => {
        if (!confirm("¿Eliminar esta tarea del plan?")) return;
        try {
            await deleteMaintenanceDef(id);
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
            if (editingDefId === id) resetDefForm();
        } catch (e) {
            alert("Error al eliminar la tarea.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft size={24} />
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">Editar Máquina</h3>
                </div>
                <button onClick={handleDeleteMachine} disabled={deleting} className="text-red-500 p-2 hover:bg-red-50 rounded-lg flex items-center gap-1 text-xs font-bold uppercase">
                    {deleting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16} />} Eliminar
                </button>
            </div>

            <form onSubmit={handleUpdateMachine} className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-sm font-bold text-slate-600 uppercase">Estado Unidad</span>
                    <button type="button" onClick={() => setActivo(!activo)} className="flex items-center gap-2 text-green-600 font-bold">
                        {activo ? <ToggleRight size={32} className="text-green-500" /> : <ToggleRight size={32} className="text-slate-300 rotate-180" />}
                        {activo ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                        <input type="text" value={companyCode} onChange={e => setCompanyCode(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cantera / Grupo</label>
                        <select required value={centerId} onChange={e => setCenterId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg">
                            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Subcentro / Planta</label>
                        <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg">
                            <option value="">-- Sin Subcentro --</option>
                            {subCenters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales</label>
                        <input type="number" step="0.01" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg font-bold text-blue-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <User size={14} className="text-slate-400"/> Operario Responsable
                        </label>
                        <select 
                            value={responsibleId} 
                            onChange={e => setResponsibleId(e.target.value)} 
                            className="w-full p-3 border border-slate-300 rounded-lg bg-white"
                        >
                            <option value="">-- Sin Responsable --</option>
                            {workers.map(w => (
                                <option key={w.id} value={w.id}>{w.name} {!w.activo ? '(Baja)' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl bg-slate-50">
                        <input type="checkbox" checked={adminExpenses} onChange={() => setAdminExpenses(!adminExpenses)} />
                        <span className="text-xs font-bold">Gastos Admón</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl bg-slate-50">
                        <input type="checkbox" checked={transportExpenses} onChange={() => setTransportExpenses(!transportExpenses)} />
                        <span className="text-xs font-bold">Gastos Transp</span>
                    </label>
                </div>

                <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-700 shadow-md">
                    {loading ? <Loader2 className="animate-spin" /> : <Save />} Actualizar Ficha Técnica
                </button>
            </form>

            <div className="pt-8 border-t space-y-4">
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-widest flex items-center gap-2">
                    <Calendar className="text-indigo-600" size={20}/> Plan de Mantenimiento Preventivo
                </h4>
                
                {/* Formulario de Tarea (Añadir/Editar) */}
                <div id="plan-form" className={`p-5 rounded-2xl border-2 transition-all shadow-sm space-y-4 ${editingDefId ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center">
                        <h5 className="font-bold text-slate-700 uppercase text-xs">
                            {editingDefId ? 'Modificando Tarea Existente' : 'Programar Nueva Tarea'}
                        </h5>
                        {editingDefId && (
                            <button onClick={resetDefForm} className="text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1 uppercase">
                                <X size={14}/> Cancelar Edición
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre de la Tarea (Ej. Cambio Aceite Motor)</label>
                            <input className="w-full p-2.5 border rounded-xl font-bold" placeholder="Nombre de la tarea..." value={newDefName} onChange={e => setNewDefName(e.target.value)} />
                        </div>
                        
                        <div className="flex gap-1 p-1 bg-white border rounded-xl">
                            <button type="button" onClick={() => setNewDefType('HOURS')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${newDefType === 'HOURS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Por Horas</button>
                            <button type="button" onClick={() => setNewDefType('DATE')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${newDefType === 'DATE' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Por Calendario</button>
                        </div>

                        {newDefType === 'HOURS' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Intervalo (Horas)</label>
                                    <input type="number" className="w-full p-2.5 border rounded-xl font-mono font-bold" placeholder="250" value={newDefInterval} onChange={e => setNewDefInterval(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Aviso Previo (Horas antes)</label>
                                    <input type="number" className="w-full p-2.5 border rounded-xl font-mono font-bold text-amber-600" placeholder="25" value={newDefWarning} onChange={e => setNewDefWarning(Number(e.target.value))} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Cada X Meses</label>
                                    <input type="number" className="w-full p-2.5 border rounded-xl font-mono font-bold" placeholder="12" value={newDefIntervalMonths} onChange={e => setNewDefIntervalMonths(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Próxima Fecha</label>
                                    <input type="date" className="w-full p-2.5 border rounded-xl font-bold" value={newDefNextDate} onChange={e => setNewDefNextDate(e.target.value)} />
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descripción detallada del mantenimiento (Opcional)</label>
                            <textarea 
                                className="w-full p-3 border rounded-xl text-sm" 
                                placeholder="Escriba aquí los puntos a revisar, materiales necesarios, etc..." 
                                rows={3} 
                                value={newDefTasks} 
                                onChange={e => setNewDefTasks(e.target.value)} 
                            />
                        </div>
                        
                        <button 
                            type="button" 
                            onClick={handleSaveDef} 
                            className={`w-full py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg transition-all ${editingDefId ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-900 hover:bg-black text-white'}`}
                        >
                            {editingDefId ? <Save size={16}/> : <Plus size={16}/>}
                            {editingDefId ? 'Guardar Cambios en Tarea' : 'Añadir Tarea al Plan'}
                        </button>
                    </div>
                </div>

                {/* Listado de Tareas Definidas */}
                <div className="space-y-2">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tareas Programadas Actuales</h5>
                    {machine.maintenanceDefs.map((d) => (
                        <div key={d.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors group">
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-black text-slate-800 uppercase truncate">{d.name}</p>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${d.maintenanceType === 'HOURS' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                        {d.maintenanceType === 'DATE' ? 'Calendario' : 'Horas'}
                                    </span>
                                </div>
                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">
                                    {d.maintenanceType === 'DATE' ? 
                                        `Cada ${d.intervalMonths} meses (Vence: ${d.nextDate ? new Date(d.nextDate).toLocaleDateString() : 'N/A'})` : 
                                        `Cada ${d.intervalHours}h (Aviso a -${d.warningHours}h)`
                                    }
                                </p>
                                {d.tasks && (
                                    <p className="text-[9px] text-slate-400 mt-1 line-clamp-1 italic">"{d.tasks}"</p>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    type="button" 
                                    onClick={() => handleEditDef(d)} 
                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Editar Tarea"
                                >
                                    <Edit2 size={16}/>
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveDef(d.id!)} 
                                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                                    title="Eliminar Tarea"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {machine.maintenanceDefs.length === 0 && (
                        <div className="p-8 text-center text-slate-300 border-2 border-dashed rounded-2xl">
                            <Calendar size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs font-bold uppercase">Sin tareas programadas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
