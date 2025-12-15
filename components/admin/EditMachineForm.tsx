
import React, { useState, useEffect } from 'react';
import { updateMachineAttributes, addMaintenanceDef, updateMaintenanceDef, deleteMaintenanceDef, getCostCenters, calculateAndSyncMachineStatus } from '../../services/db';
import { CostCenter, Machine, MaintenanceDefinition } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, Edit2, X } from 'lucide-react';

interface Props {
    machine: Machine;
    onBack: () => void;
    onSuccess: () => void;
}

export const EditMachineForm: React.FC<Props> = ({ machine: initialMachine, onBack, onSuccess }) => {
    // We keep local state for the machine to show updates immediately
    const [machine, setMachine] = useState<Machine>(initialMachine);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(false);
    
    // --- EDITING STATES ---
    const [name, setName] = useState(machine.name);
    const [companyCode, setCompanyCode] = useState(machine.companyCode || '');
    const [centerId, setCenterId] = useState(machine.costCenterId);
    const [currentHours, setCurrentHours] = useState(machine.currentHours);
    const [requiresHours, setRequiresHours] = useState(machine.requiresHours);
    const [adminExpenses, setAdminExpenses] = useState(machine.adminExpenses);
    const [transportExpenses, setTransportExpenses] = useState(machine.transportExpenses);

    // --- MAINT DEF FORM STATE ---
    const [editingDefId, setEditingDefId] = useState<string | null>(null);
    const [defName, setDefName] = useState('');
    const [defInterval, setDefInterval] = useState<number | ''>('');
    const [defWarning, setDefWarning] = useState<number | ''>('');
    const [defTasks, setDefTasks] = useState('');

    useEffect(() => {
        getCostCenters().then(setCenters);
        // Ensure we have latest defs
        calculateAndSyncMachineStatus(initialMachine).then(setMachine);
    }, [initialMachine]);

    // Handle Basic Info Update
    const handleUpdateBasicInfo = async () => {
        setLoading(true);
        try {
            await updateMachineAttributes(machine.id, {
                name,
                companyCode,
                costCenterId: centerId,
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses
            });
            alert("Datos generales actualizados.");
        } catch (e) {
            alert("Error al actualizar datos.");
        } finally {
            setLoading(false);
        }
    };

    // Maintenance Handlers
    const resetDefForm = () => {
        setEditingDefId(null);
        setDefName('');
        setDefInterval('');
        setDefWarning('');
        setDefTasks('');
    };

    const handleEditClick = (def: MaintenanceDefinition) => {
        setEditingDefId(def.id!);
        setDefName(def.name);
        setDefInterval(def.intervalHours);
        setDefWarning(def.warningHours);
        setDefTasks(def.tasks);
    };

    const handleSaveDef = async () => {
        if (!defName || !defInterval || !defWarning) return;
        setLoading(true);

        const defPayload: MaintenanceDefinition = {
            id: editingDefId || undefined,
            machineId: machine.id,
            name: defName,
            intervalHours: Number(defInterval),
            warningHours: Number(defWarning),
            tasks: defTasks
        };

        try {
            if (editingDefId) {
                await updateMaintenanceDef(defPayload);
            } else {
                await addMaintenanceDef(defPayload, machine.currentHours);
            }
            // Refresh
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
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Modificar Máquina: {machine.name}</h3>
            </div>

            {/* Basic Info Form */}
            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <h4 className="font-bold text-slate-700 border-b pb-2">Datos Generales</h4>
                
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales</label>
                        <input type="number" className="w-full p-2 border rounded" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={requiresHours} onChange={e => setRequiresHours(e.target.checked)} />
                        <span>Control Horas</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={adminExpenses} onChange={e => setAdminExpenses(e.target.checked)} />
                        <span>Gastos Admin</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={transportExpenses} onChange={e => setTransportExpenses(e.target.checked)} />
                        <span>Gastos Transporte</span>
                    </label>
                </div>

                <button onClick={handleUpdateBasicInfo} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                    Guardar Datos Generales
                </button>
            </div>

            {/* Maintenance Definitions Manager */}
            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <h4 className="font-bold text-slate-700 border-b pb-2">Mantenimientos Programados</h4>
                
                {/* List */}
                <div className="space-y-2">
                    {machine.maintenanceDefs.map(def => (
                        <div key={def.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded border border-slate-200 gap-2">
                            <div>
                                <p className="font-bold text-slate-800">{def.name}</p>
                                <p className="text-xs text-slate-500">Cada {def.intervalHours}h (Aviso {def.warningHours}h) - {def.tasks}</p>
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
                    {machine.maintenanceDefs.length === 0 && <p className="text-slate-400 text-sm text-center">Sin mantenimientos definidos.</p>}
                </div>

                {/* Add/Edit Form */}
                <div className={`p-4 rounded-lg border-2 ${editingDefId ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'} mt-4`}>
                    <h5 className="font-bold text-sm mb-3 flex justify-between items-center">
                        {editingDefId ? 'Editar Mantenimiento' : 'Añadir Nuevo Mantenimiento'}
                        {editingDefId && <button onClick={resetDefForm} className="text-xs text-slate-500 flex items-center gap-1"><X size={12}/> Cancelar Edición</button>}
                    </h5>
                    
                    <div className="space-y-3">
                        <input 
                            placeholder="Nombre (ej. Mantenimiento 500h)" 
                            className="w-full p-2 border rounded"
                            value={defName}
                            onChange={e => setDefName(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="Intervalo" 
                                className="w-1/2 p-2 border rounded"
                                value={defInterval}
                                onChange={e => setDefInterval(Number(e.target.value))}
                            />
                            <input 
                                type="number" 
                                placeholder="Preaviso" 
                                className="w-1/2 p-2 border rounded"
                                value={defWarning}
                                onChange={e => setDefWarning(Number(e.target.value))}
                            />
                        </div>
                        <textarea 
                            placeholder="Tareas..." 
                            className="w-full p-2 border rounded"
                            rows={2}
                            value={defTasks}
                            onChange={e => setDefTasks(e.target.value)}
                        />
                        <button 
                            onClick={handleSaveDef} 
                            disabled={loading || !defName || !defInterval}
                            className={`w-full py-2 rounded font-bold flex items-center justify-center gap-2 ${editingDefId ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                        >
                            {editingDefId ? <Save size={18}/> : <Plus size={18}/>}
                            {editingDefId ? 'Actualizar Definición' : 'Añadir Definición'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
