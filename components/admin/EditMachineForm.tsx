
import React, { useState, useEffect } from 'react';
import { updateMachineAttributes, addMaintenanceDef, updateMaintenanceDef, deleteMaintenanceDef, getCostCenters, getSubCentersByCenter, calculateAndSyncMachineStatus, getWorkers, deleteMachine, getMachineDependencyCount } from '../../services/db';
import { CostCenter, SubCenter, Machine, MaintenanceDefinition, Worker } from '../../types';
// Fixed missing Truck import from lucide-react
import { Save, ArrowLeft, Plus, Trash2, Edit2, X, AlertTriangle, Loader2, ToggleLeft, ToggleRight, LayoutGrid, Zap, Calendar, Clock, Truck } from 'lucide-react';

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
    
    // --- MACHINE BASIC INFO ---
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

    // --- MAINTENANCE DEFS FORM STATE ---
    const [showDefForm, setShowDefForm] = useState(false);
    const [editingDefId, setEditingDefId] = useState<string | null>(null);
    const [defName, setDefName] = useState('');
    const [defType, setDefType] = useState<'HOURS' | 'DATE'>('HOURS');
    const [defInterval, setDefInterval] = useState<number | ''>('');
    const [defWarning, setDefWarning] = useState<number | ''>('');
    const [defIntervalMonths, setDefIntervalMonths] = useState<number | ''>('');
    const [defNextDate, setDefNextDate] = useState('');
    const [defTasks, setDefTasks] = useState('');

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
                name, companyCode, costCenterId: centerId,
                subCenterId: subId || undefined,
                responsibleWorkerId: responsibleId || undefined,
                currentHours, requiresHours, adminExpenses,
                transportExpenses, selectableForReports, active, vinculadaProduccion
            });
            alert("Datos generales actualizados.");
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
        } catch (e) { alert("Error al actualizar datos."); }
        finally { setLoading(false); }
    };

    const resetDefForm = () => {
        setEditingDefId(null);
        setDefName('');
        setDefType('HOURS');
        setDefInterval('');
        setDefWarning('');
        setDefIntervalMonths('');
        setDefNextDate('');
        setDefTasks('');
        setShowDefForm(false);
    };

    const handleEditDefClick = (def: MaintenanceDefinition) => {
        setEditingDefId(def.id!);
        setDefName(def.name);
        setDefType(def.maintenanceType || 'HOURS');
        setDefInterval(def.intervalHours || '');
        setDefWarning(def.warningHours || '');
        setDefIntervalMonths(def.intervalMonths || '');
        setDefNextDate(def.nextDate ? new Date(def.nextDate).toISOString().split('T')[0] : '');
        setDefTasks(def.tasks);
        setShowDefForm(true);
    };

    const handleSaveDef = async () => {
        if (!defName) { alert("El nombre es obligatorio"); return; }
        setLoading(true);
        const defPayload: MaintenanceDefinition = {
            id: editingDefId || undefined,
            machineId: machine.id,
            name: defName,
            maintenanceType: defType,
            intervalHours: Number(defInterval) || 0,
            warningHours: Number(defWarning) || 0,
            intervalMonths: Number(defIntervalMonths) || 0,
            nextDate: defNextDate ? new Date(defNextDate) : undefined,
            tasks: defTasks
        };
        try {
            if (editingDefId) await updateMaintenanceDef(defPayload);
            else await addMaintenanceDef(defPayload, machine.currentHours);
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
            resetDefForm();
        } catch (e) { alert("Error al guardar mantenimiento"); }
        finally { setLoading(false); }
    };

    const handleDeleteDef = async (defId: string) => {
        if (!confirm("¿Borrar esta definición de mantenimiento?")) return;
        setLoading(true);
        try {
            await deleteMaintenanceDef(defId);
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
        } catch (e) { alert("Error al eliminar"); }
        finally { setLoading(false); }
    };

    const handleDeleteMachine = async () => {
        const deps = await getMachineDependencyCount(machine.id);
        if (deps.logs > 0 || deps.reports > 0) {
            if (!confirm(`ADVERTENCIA: Esta máquina tiene ${deps.logs} registros técnicos y ${deps.reports} partes de trabajo. Borrarla eliminará TODO el historial. ¿Está seguro?`)) return;
        } else {
            if (!confirm(`¿Seguro que desea eliminar la máquina "${machine.name}"?`)) return;
        }
        setDeleting(true);
        try {
            await deleteMachine(machine.id);
            onSuccess();
        } catch (e) { alert("Error al eliminar máquina"); }
        finally { setDeleting(false); }
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm sticky top-0 z-10">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Modificar: {machine.name}</h3>
                    {!active && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black uppercase tracking-widest">Dada de Baja</span>}
                </div>
            </div>

            {/* SECCIÓN 1: DATOS GENERALES */}
            <div className="bg-white p-6 rounded-2xl shadow-md space-y-5 border border-slate-100 mx-1">
                <div className="flex justify-between items-center border-b pb-3">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                        <Truck className="text-blue-500" size={16}/> Ficha Técnica del Activo
                    </h4>
                    <button type="button" onClick={() => setActive(!active)} className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full transition-all ${active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 opacity-50" />} {active ? 'ACTIVO' : 'BAJA'}
                    </button>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg"><Zap size={20}/></div>
                        <div className="flex-1">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900 text-sm">
                                <input type="checkbox" checked={vinculadaProduccion} onChange={e => setVinculadaProduccion(e.target.checked)} className="w-5 h-5 rounded border-indigo-300" />
                                Máquina Fija (Horas Sincronizadas)
                            </label>
                            <p className="text-[10px] text-indigo-600 mt-1 uppercase font-bold leading-tight">Las horas se actualizan automáticamente al cerrar partes de producción.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Comercial</label>
                            <input className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:bg-white" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Cód. Interno</label>
                            <input className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50 focus:bg-white" value={companyCode} onChange={e => setCompanyCode(e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Cantera Matriz</label>
                            <select className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50" value={centerId} onChange={e => { setCenterId(e.target.value); setSubId(''); }}>
                                {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Subcentro / Planta</label>
                            <select className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50" value={subId} onChange={e => setSubId(e.target.value)}>
                                <option value="">-- Ninguno --</option>
                                {subCenters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Responsable</label>
                            <select className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-slate-50" value={responsibleId} onChange={e => setResponsibleId(e.target.value)}>
                                 <option value="">-- Sin asignar --</option>
                                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Contador Actual (h/km)</label>
                            <input type="number" className="w-full p-3 border border-slate-200 rounded-xl font-black text-blue-600 bg-slate-50 focus:bg-white text-lg" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <input type="checkbox" checked={requiresHours} onChange={e => setRequiresHours(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" />
                        <span className="font-bold text-slate-700 text-xs uppercase tracking-tight">Solicitar horas en cada registro</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer bg-green-50 p-3 rounded-xl border border-green-100">
                        <input type="checkbox" checked={selectableForReports} onChange={e => setSelectableForReports(e.target.checked)} className="w-5 h-5 rounded border-green-300 text-green-600" />
                        <span className="font-bold text-green-800 text-xs uppercase tracking-tight">Habilitar en Partes Diarios de Personal</span>
                    </label>
                </div>

                <button onClick={handleUpdateBasicInfo} disabled={loading || deleting} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin inline mr-2" size={20}/> : <Save className="inline mr-2" size={20}/>}
                    Guardar Cambios Ficha
                </button>
            </div>

            {/* SECCIÓN 2: MANTENIMIENTOS PROGRAMADOS */}
            <div className="bg-white p-6 rounded-2xl shadow-md space-y-4 border border-slate-100 mx-1">
                <div className="flex justify-between items-center border-b pb-3">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                        <Calendar className="text-purple-600" size={16}/> Mantenimientos Programados
                    </h4>
                    <button 
                        onClick={() => { resetDefForm(); setShowDefForm(true); }}
                        className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1 shadow-sm"
                    >
                        <Plus size={14}/> Añadir Definición
                    </button>
                </div>

                {/* Lista de mantenimientos existentes */}
                <div className="space-y-3">
                    {machine.maintenanceDefs.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 italic text-xs">No hay planes de mantenimiento creados para esta unidad.</div>
                    ) : (
                        machine.maintenanceDefs.map(def => (
                            <div key={def.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-purple-200 transition-all group">
                                <div>
                                    <p className="font-black text-slate-800 text-sm uppercase leading-tight mb-1">{def.name}</p>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${def.maintenanceType === 'HOURS' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {def.maintenanceType === 'HOURS' ? `${def.intervalHours}h` : `${def.intervalMonths} meses`}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{def.maintenanceType === 'HOURS' ? 'Por Contador' : 'Por Calendario'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditDefClick(def)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDeleteDef(def.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Formulario de Creación/Edición de Mantenimiento */}
                {showDefForm && (
                    <div className="mt-6 p-6 bg-purple-50 rounded-3xl border-2 border-purple-200 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-5">
                            <h5 className="font-black text-purple-900 uppercase text-xs tracking-tighter flex items-center gap-2">
                                {editingDefId ? <Edit2 size={16}/> : <Plus size={16}/>}
                                {editingDefId ? 'Modificar Plan' : 'Nuevo Plan de Mantenimiento'}
                            </h5>
                            <button onClick={resetDefForm} className="text-purple-400 hover:text-purple-600"><X size={20}/></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Nombre del Mantenimiento</label>
                                <input className="w-full p-3 border border-purple-200 rounded-xl font-bold bg-white" placeholder="Ej. Cambio Aceite Motor" value={defName} onChange={e => setDefName(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setDefType('HOURS')} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${defType === 'HOURS' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-purple-400 border-purple-100'}`}>
                                    <Clock size={14}/> Por Horas
                                </button>
                                <button onClick={() => setDefType('DATE')} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${defType === 'DATE' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-purple-400 border-purple-100'}`}>
                                    <Calendar size={14}/> Por Fecha
                                </button>
                            </div>

                            {defType === 'HOURS' ? (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Cada (horas)</label>
                                        <input type="number" className="w-full p-3 border border-purple-200 rounded-xl font-black bg-white" value={defInterval} onChange={e => setDefInterval(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Preaviso (horas)</label>
                                        <input type="number" className="w-full p-3 border border-purple-200 rounded-xl font-black bg-white" value={defWarning} onChange={e => setDefWarning(Number(e.target.value))} />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Intervalo (Meses)</label>
                                        <input type="number" className="w-full p-3 border border-purple-200 rounded-xl font-black bg-white" value={defIntervalMonths} onChange={e => setDefIntervalMonths(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Siguiente Fecha</label>
                                        <input type="date" className="w-full p-3 border border-purple-200 rounded-xl font-black bg-white" value={defNextDate} onChange={e => setDefNextDate(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-purple-400 uppercase mb-1">Tareas a realizar</label>
                                <textarea rows={3} className="w-full p-3 border border-purple-200 rounded-xl font-medium bg-white text-xs" placeholder="Describa el protocolo..." value={defTasks} onChange={e => setDefTasks(e.target.value)} />
                            </div>

                            <button onClick={handleSaveDef} disabled={loading} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-purple-700 transition-all">
                                {loading ? <Loader2 className="animate-spin inline mr-2" size={18}/> : <Save className="inline mr-2" size={18}/>}
                                {editingDefId ? 'Actualizar Definición' : 'Añadir Definición'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SECCIÓN 3: ELIMINACIÓN PELIGROSA */}
            <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 mx-1">
                <button onClick={handleDeleteMachine} disabled={deleting || loading} className="w-full py-4 bg-white border-2 border-red-500 text-red-600 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 shadow-sm">
                    <Trash2 size={20} /> {deleting ? 'ELIMINANDO...' : 'ELIMINAR ESTA MÁQUINA'}
                </button>
                <p className="text-[9px] text-red-400 font-bold uppercase text-center mt-3 tracking-tighter">Atención: Esta acción no se puede deshacer y borrará todos los registros históricos.</p>
            </div>
        </div>
    );
};
