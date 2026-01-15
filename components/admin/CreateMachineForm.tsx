
import React, { useState, useEffect } from 'react';
import { createMachine, getCostCenters, getSubCentersByCenter, getWorkers } from '../../services/db';
import { CostCenter, SubCenter, MaintenanceDefinition, Worker } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, ToggleRight, LayoutGrid } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateMachineForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Main Form State
    const [name, setName] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [centerId, setCenterId] = useState('');
    const [subId, setSubId] = useState('');
    const [responsibleId, setResponsibleId] = useState('');
    const [currentHours, setCurrentHours] = useState(0);
    const [requiresHours, setRequiresHours] = useState(true);
    const [adminExpenses, setAdminExpenses] = useState(false);
    const [transportExpenses, setTransportExpenses] = useState(false);
    const [selectableForReports, setSelectableForReports] = useState(true); 
    const [active, setActive] = useState(true);

    // Maintenance Defs State
    const [defs, setDefs] = useState<MaintenanceDefinition[]>([]);
    
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
    }, []);

    // Cargar subcentros cuando cambia el centro
    useEffect(() => {
        if (centerId) {
            getSubCentersByCenter(centerId).then(setSubCenters);
            setSubId(''); // Reset subcenter when center changes
        } else {
            setSubCenters([]);
        }
    }, [centerId]);

    const handleExpenseChange = (type: 'admin' | 'transport') => {
        if (type === 'admin') {
            setAdminExpenses(!adminExpenses);
            if (!adminExpenses) setTransportExpenses(false);
        } else {
            setTransportExpenses(!transportExpenses);
            if (!transportExpenses) setAdminExpenses(false);
        }
    };

    const addMaintenanceDef = () => {
        if (!newDefName) return;
        const newDef: MaintenanceDefinition = {
            name: newDefName,
            tasks: newDefTasks,
            maintenanceType: newDefType,
            intervalHours: 0,
            warningHours: 0
        };
        if (newDefType === 'HOURS') {
            if (!newDefInterval || !newDefWarning) return;
            newDef.intervalHours = Number(newDefInterval);
            newDef.warningHours = Number(newDefWarning);
        } else {
            if (!newDefNextDate) return;
            newDef.intervalMonths = newDefIntervalMonths ? Number(newDefIntervalMonths) : 0;
            newDef.nextDate = new Date(newDefNextDate);
        }
        setDefs([...defs, newDef]);
        setNewDefName('');
        setNewDefInterval('');
        setNewDefWarning('');
        setNewDefTasks('');
        setNewDefIntervalMonths('');
        setNewDefNextDate('');
    };

    const removeDef = (index: number) => {
        const newDefs = [...defs];
        newDefs.splice(index, 1);
        setDefs(newDefs);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createMachine({
                name,
                companyCode,
                costCenterId: centerId,
                subCenterId: subId || undefined, // Incluimos el subcentro
                responsibleWorkerId: responsibleId || undefined,
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses,
                selectableForReports,
                maintenanceDefs: defs,
                active
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear máquina.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-6 pb-20">
            <div className="flex items-center gap-2 border-b pb-2">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Nueva Máquina</h3>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-sm font-bold text-slate-600 uppercase">Estado inicial</span>
                    <button type="button" onClick={() => setActive(!active)} className="flex items-center gap-2 text-green-600 font-bold">
                        <ToggleRight size={32} className={active ? 'text-green-500' : 'text-slate-300 rotate-180'} />
                        {active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Máquina *</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                        <input type="text" value={companyCode} onChange={e => setCompanyCode(e.target.value)} placeholder="Ej. RETRO-01" className="w-full p-3 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kms Iniciales</label>
                        <input type="number" value={currentHours} onChange={e => setCurrentHours(Number(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cantera / Grupo *</label>
                    <select 
                        required 
                        value={centerId} 
                        onChange={e => setCenterId(e.target.value)} 
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Seleccionar --</option>
                        {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* NUEVO: Selección de Subcentro */}
                <div className="animate-in fade-in duration-300">
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        <LayoutGrid size={14} className="text-blue-500"/> Subcentro / Planta
                    </label>
                    <select 
                        disabled={!centerId}
                        value={subId} 
                        onChange={e => setSubId(e.target.value)} 
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                        <option value="">-- Sin Subcentro / General --</option>
                        {subCenters.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    {!centerId && <p className="text-[10px] text-slate-400 mt-1 italic">Seleccione primero una cantera para ver sus plantas.</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Operario Responsable</label>
                    <select 
                        value={responsibleId} 
                        onChange={e => setResponsibleId(e.target.value)} 
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Sin Responsable --</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Config Checkboxes */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                    <input type="checkbox" id="reqHours" checked={requiresHours} onChange={e => setRequiresHours(e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                    <label htmlFor="reqHours" className="text-slate-700 font-medium">Controlar Horas/Kms</label>
                </div>
                <div className="flex items-center gap-3">
                    <input type="checkbox" id="selectableReports" checked={selectableForReports} onChange={e => setSelectableForReports(e.target.checked)} className="w-5 h-5 text-green-600 rounded" />
                    <label htmlFor="selectableReports" className="text-slate-700 font-medium">Seleccionable en Partes de Trabajo</label>
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 rounded-xl text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400 shadow-lg transition-all">
                <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear Máquina Completa'}
            </button>
        </form>
    );
};
