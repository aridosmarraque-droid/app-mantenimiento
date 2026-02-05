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
    const [activo, setActivo] = useState(machine.activo ?? true);
    const [vinculadaProduccion, setVinculadaProduccion] = useState(machine.vinculadaProduccion ?? false);

    // Maintenance Defs State (Local)
    const [newDefName, setNewDefName] = useState('');
    const [newDefType, setNewDefType] = useState<'HOURS' | 'DATE'>('HOURS');
    const [newDefInterval, setNewDefInterval] = useState<number | ''>('');
    const [newDefWarning, setNewDefWarning] = useState<number | ''>('');
    const [newDefIntervalMonths, setNewDefIntervalMonths] = useState<number | ''>('');
    const [newDefNextDate, setNewDefNextDate] = useState('');
    const [newDefTasks, setNewDefTasks] = useState('');

    useEffect(() => {
        getCostCenters().then(setCenters);
        getWorkers().then(setWorkers);
        calculateAndSyncMachineStatus(initialMachine).then(setMachine);
    }, [initialMachine]);

    useEffect(() => {
        if (centerId) {
            getSubCentersByCenter(centerId).then(setSubCenters);
        } else {
            setSubCenters([]);
        }
    }, [centerId]);

    const handleUpdate = async (e: React.FormEvent) => {
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

    const handleDelete = async () => {
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

    const handleAddDef = async () => {
        if (!newDefName) return;
        const newDef: MaintenanceDefinition = {
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
            await addMaintenanceDef(newDef, currentHours);
            const updated = await calculateAndSyncMachineStatus(machine);
            setMachine(updated);
            // Reset
            setNewDefName(''); setNewDefInterval(''); setNewDefWarning(''); setNewDefTasks(''); setNewDefIntervalMonths(''); setNewDefNextDate('');
        } catch (e) { alert("Error al añadir tarea."); }
    };

    const handleRemoveDef = async (id: string) => {
        if (!confirm("¿Eliminar esta tarea del plan?")) return;
        await deleteMaintenanceDef(id);
        const updated = await calculateAndSyncMachineStatus(machine);
        setMachine(updated);
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
                <button onClick={handleDelete} disabled={deleting} className="text-red-500 p-2 hover:bg-red-50 rounded-lg flex items-center gap-1 text-xs font-bold uppercase">
                    {deleting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16} />} Eliminar
                </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
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

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales</label>
                    <input type="number" step="0.01" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg font-bold text-blue-600" />
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

                <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-700">
                    {loading ? <Loader2 className="animate-spin" /> : <Save />} Actualizar Atributos Ficha
                </button>
            </form>

            <div className="pt-6 border-t space-y-4">
                <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Plan de Mantenimiento Preventivo</h4>
                
                {/* Add New Def */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <input className="w-full p-2 border rounded" placeholder="Nueva Tarea (Ej. Cambio Filtros)" value={newDefName} onChange={e => setNewDefName(e.target.value)} />
                    <div className="flex gap-2">
                        <select value={newDefType} onChange={e => setNewDefType(e.target.value as any)} className="p-2 border rounded text-xs">
                            <option value="HOURS">Por Horas</option>
                            <option value="DATE">Calendario</option>
                        </select>
                        {newDefType === 'HOURS' ? (
                            <>
                                <input type="number" className="flex-1 p-2 border rounded text-xs" placeholder="Int. (h)" value={newDefInterval} onChange={e => setNewDefInterval(Number(e.target.value))} />
                                <input type="number" className="flex-1 p-2 border rounded text-xs" placeholder="Aviso (h)" value={newDefWarning} onChange={e => setNewDefWarning(Number(e.target.value))} />
                            </>
                        ) : (
                            <input type="date" className="flex-1 p-2 border rounded text-xs" value={newDefNextDate} onChange={e => setNewDefNextDate(e.target.value)} />
                        )}
                    </div>
                    <button type="button" onClick={handleAddDef} className="w-full py-2 bg-slate-800 text-white rounded font-bold text-xs uppercase flex items-center justify-center gap-2">
                        <Plus size={14}/> Añadir Tarea
                    </button>
                </div>

                {/* List Current Defs */}
                <div className="space-y-2">
                    {machine.maintenanceDefs.map((d) => (
                        <div key={d.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                            <div>
                                <p className="text-xs font-bold text-slate-700">{d.name}</p>
                                <p className="text-[9px] text-slate-500 uppercase font-black">
                                    {d.maintenanceType === 'DATE' ? `Vence: ${d.nextDate ? new Date(d.nextDate).toLocaleDateString() : 'N/A'}` : `Cada ${d.intervalHours}h (Aviso a ${d.warningHours}h)`}
                                </p>
                            </div>
                            <button type="button" onClick={() => handleRemoveDef(d.id!)} className="text-red-400 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
