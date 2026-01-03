
import React, { useState, useEffect } from 'react';
import { updateMachineAttributes, addMaintenanceDef, updateMaintenanceDef, deleteMaintenanceDef, getCostCenters, calculateAndSyncMachineStatus, getWorkers, deleteMachine, getMachineDependencyCount } from '../../services/db';
import { CostCenter, Machine, MaintenanceDefinition, Worker } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, Edit2, X, AlertTriangle, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
    machine: Machine;
    onBack: () => void;
    onSuccess: () => void;
}

export const EditMachineForm: React.FC<Props> = ({ machine: initialMachine, onBack, onSuccess }) => {
    const [machine, setMachine] = useState<Machine>(initialMachine);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // --- EDITING STATES ---
    const [name, setName] = useState(machine.name);
    const [companyCode, setCompanyCode] = useState(machine.companyCode || '');
    const [centerId, setCenterId] = useState(machine.costCenterId);
    const [responsibleId, setResponsibleId] = useState(machine.responsibleWorkerId || '');
    const [currentHours, setCurrentHours] = useState(machine.currentHours);
    const [requiresHours, setRequiresHours] = useState(machine.requiresHours);
    const [adminExpenses, setAdminExpenses] = useState(machine.adminExpenses);
    const [transportExpenses, setTransportExpenses] = useState(machine.transportExpenses);
    const [selectableForReports, setSelectableForReports] = useState(machine.selectableForReports ?? true);
    const [active, setActive] = useState(machine.active ?? true);

    // --- MAINT DEF FORM STATE ---
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

    const handleUpdateBasicInfo = async () => {
        setLoading(true);
        try {
            await updateMachineAttributes(machine.id, {
                name,
                companyCode,
                costCenterId: centerId,
                responsibleWorkerId: responsibleId || undefined,
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses,
                selectableForReports,
                active
            });
            alert("Datos generales actualizados.");
        } catch (e) {
            alert("Error al actualizar datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMachine = async () => {
        setLoading(true);
        try {
            const deps = await getMachineDependencyCount(machine.id);
            const hasHistory = deps.logs > 0 || deps.reports > 0;

            if (hasHistory) {
                const confirmMsg = `ADVERTENCIA DE INTEGRIDAD:\n\nEste activo no puede borrarse directamente sin afectar al histórico.\n\n- Registros de Mantenimiento: ${deps.logs}\n- Partes de Trabajo: ${deps.reports}\n\nSi borras el activo, se eliminarán TAMBIÉN todos estos registros de la base de datos de forma permanente.\n\n¿Deseas proceder con el borrado TOTAL o prefieres simplemente DESACTIVAR el activo en la sección de datos generales?`;
                
                const choice = confirm(confirmMsg);
                if (!choice) {
                   setLoading(false);
                   return;
                }
            } else {
                if (!confirm(`¿Estás seguro de eliminar "${machine.name}"? No tiene historial vinculado.`)) {
                    setLoading(false);
                    return;
                }
            }

            setDeleting(true);
            await deleteMachine(machine.id);
            alert("Activo y su historial eliminados correctamente.");
            onSuccess(); 
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Error al intentar eliminar el activo.");
        } finally {
            setDeleting(false);
            setLoading(false);
        }
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
    };

    const handleEditClick = (def: MaintenanceDefinition) => {
        setEditingDefId(def.id!);
        setDefName(def.name);
        setDefType(def.maintenanceType || 'HOURS');
        setDefInterval(def.intervalHours || '');
        setDefWarning(def.warningHours || '');
        setDefIntervalMonths(def.intervalMonths || '');
        setDefNextDate(def.nextDate ? new Date(def.nextDate).toISOString().split('T')[0] : '');
        setDefTasks(def.tasks);
    };

    const handleSaveDef = async () => {
        if (!defName) return;
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
            if (editingDefId) {
                await updateMaintenanceDef(defPayload);
            } else {
                await addMaintenanceDef(defPayload, machine.currentHours);
            }
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
            resetDefForm();
        } catch (error) {
            alert("Error al guardar mantenimiento.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDef = async (defId: string) => {
        if (!confirm("¿Seguro que quieres borrar este mantenimiento?")) return;
        setLoading(true);
        try {
            await deleteMaintenanceDef(defId);
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
        } catch (error) {
            alert("Error al borrar.");
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
                    {!active && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black uppercase">Activo dado de Baja</span>}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-bold text-slate-700">Datos Generales</h4>
                    <button 
                        type="button" 
                        onClick={() => setActive(!active)} 
                        className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full transition-all ${active ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}
                    >
                        {active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                        <input className="w-full p-2 border rounded" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                        <input className="w-full p-2 border rounded" value={companyCode} onChange={e => setCompanyCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Centro</label>
                        <select className="w-full p-2 border rounded" value={centerId} onChange={e => setCenterId(e.target.value)}>
                            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsable</label>
                        <select className="w-full p-2 border rounded" value={responsibleId} onChange={e => setResponsibleId(e.target.value)}>
                             <option value="">-- Sin Responsable --</option>
                            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kilómetros Actuales</label>
                        <input type="number" className="w-full p-2 border rounded" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} />
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded">
                        <input type="checkbox" checked={requiresHours} onChange={e => setRequiresHours(e.target.checked)} className="w-5 h-5" />
                        <span className="font-medium text-slate-700">Control Horas/Kms</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer bg-green-50 p-2 rounded border border-green-100">
                        <input type="checkbox" checked={selectableForReports} onChange={e => setSelectableForReports(e.target.checked)} className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Seleccionable para Partes de Trabajo</span>
                    </label>

                    <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500">
                            <input type="checkbox" checked={adminExpenses} onChange={e => setAdminExpenses(e.target.checked)} />
                            GASTOS ADMIN
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500">
                            <input type="checkbox" checked={transportExpenses} onChange={e => setTransportExpenses(e.target.checked)} />
                            GASTOS TRANSPORTE
                        </label>
                    </div>
                </div>

                <button onClick={handleUpdateBasicInfo} disabled={loading || deleting} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300">
                    {loading ? 'Guardando...' : 'Guardar Datos Generales'}
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <h4 className="font-bold text-slate-700 border-b pb-2">Mantenimientos Programados</h4>
                <div className="space-y-2">
                    {machine.maintenanceDefs.map(def => (
                        <div key={def.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded border border-slate-200 gap-2">
                            <div>
                                <p className="font-bold text-slate-800">{def.name}</p>
                                <p className="text-xs text-slate-500">
                                     {def.maintenanceType === 'HOURS' 
                                            ? `Cada ${def.intervalHours}h (Aviso ${def.warningHours}h)`
                                            : `Por Fecha: ${def.nextDate ? new Date(def.nextDate).toLocaleDateString() : 'Pendiente'} (Cada ${def.intervalMonths || 0} meses)`
                                     }
                                </p>
                            </div>
                            <div className="flex gap-2 self-end sm:self-auto">
                                <button onClick={() => handleEditClick(def)} className="p-2 text-blue-600 hover:bg-blue-100 rounded">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDeleteDef(def.id!)} className="p-2 text-red-600 hover:bg-red-100 rounded">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {machine.maintenanceDefs.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Sin mantenimientos definidos.</p>}
                </div>

                <div className={`p-4 rounded-lg border-2 ${editingDefId ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'} mt-4`}>
                    <h5 className="font-bold text-sm mb-3 flex justify-between items-center">
                        {editingDefId ? 'Editar Mantenimiento' : 'Añadir Nuevo Mantenimiento'}
                        {editingDefId && <button onClick={resetDefForm} className="text-xs text-slate-500 flex items-center gap-1"><X size={12}/> Cancelar Edición</button>}
                    </h5>
                    <div className="space-y-3">
                         <div className="flex gap-2 mb-2">
                            <button type="button" onClick={() => setDefType('HOURS')} className={`flex-1 py-1 text-sm font-bold rounded ${defType === 'HOURS' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Por Horas</button>
                            <button type="button" onClick={() => setDefType('DATE')} className={`flex-1 py-1 text-sm font-bold rounded ${defType === 'DATE' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Por Fecha</button>
                        </div>
                        <input placeholder="Nombre (ej. Mantenimiento 500h)" className="w-full p-2 border rounded" value={defName} onChange={e => setDefName(e.target.value)} />
                        {defType === 'HOURS' ? (
                            <div className="flex gap-2">
                                <input type="number" placeholder="Intervalo" className="w-1/2 p-2 border rounded" value={defInterval} onChange={e => setDefInterval(Number(e.target.value))} />
                                <input type="number" placeholder="Preaviso" className="w-1/2 p-2 border rounded" value={defWarning} onChange={e => setDefWarning(Number(e.target.value))} />
                            </div>
                        ) : (
                             <div className="flex gap-2">
                                <input type="date" className="w-1/2 p-2 border rounded" value={defNextDate} onChange={e => setDefNextDate(e.target.value)} />
                                <input type="number" placeholder="Repetir (Meses)" className="w-1/2 p-2 border rounded" value={defIntervalMonths} onChange={e => setDefIntervalMonths(Number(e.target.value))} />
                            </div>
                        )}
                        <textarea placeholder="Tareas..." className="w-full p-2 border rounded" rows={2} value={defTasks} onChange={e => setDefTasks(e.target.value)} />
                        <button onClick={handleSaveDef} disabled={loading || !defName} className={`w-full py-2 rounded font-bold flex items-center justify-center gap-2 ${editingDefId ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'} disabled:bg-slate-300`}>
                            {editingDefId ? <Save size={18}/> : <Plus size={18}/>}
                            {editingDefId ? 'Actualizar Definición' : 'Añadir Definición'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-red-50 p-6 rounded-xl border-2 border-red-100 shadow-sm mx-1">
                <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                    <AlertTriangle size={20} />
                    <h4>Zona de Peligro</h4>
                </div>
                <p className="text-xs text-red-600 mb-4 font-medium leading-relaxed">
                    Si el activo ya tiene historial, te recomendamos usar la opción <strong>INACTIVO</strong> en la sección de datos generales para que deje de ser seleccionable pero mantenga su trazabilidad.<br/>
                    Al eliminar este activo físicamente, se borrarán TAMBIÉN todos sus mantenimientos y partes de trabajo vinculados de forma irreversible.
                </p>
                <button 
                    onClick={handleDeleteMachine}
                    disabled={deleting || loading}
                    className="w-full py-3 bg-white border-2 border-red-500 text-red-600 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                >
                    {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    {deleting ? 'Eliminando...' : 'Borrado Físico Integral'}
                </button>
            </div>
        </div>
    );
};
