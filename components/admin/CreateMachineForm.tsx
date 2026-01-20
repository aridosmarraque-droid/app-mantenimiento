
import React, { useState, useEffect } from 'react';
import { createMachine, getCostCenters, getSubCentersByCenter, getWorkers } from '../../services/db';
import { CostCenter, SubCenter, MaintenanceDefinition, Worker } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, ToggleRight, LayoutGrid, Calculator, Truck, Clock, Calendar } from 'lucide-react';

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
            const nextVal = !adminExpenses;
            setAdminExpenses(nextVal);
            if (nextVal) setTransportExpenses(false);
        } else {
            const nextVal = !transportExpenses;
            setTransportExpenses(nextVal);
            if (nextVal) setAdminExpenses(false);
        }
    };

    const addMaintenanceDef = () => {
        if (!newDefName) return;
        const newDef: MaintenanceDefinition = {
            name: newDefName,
            tasks: newDefTasks,
            maintenanceType: newDefType,
            intervalHours: 0,
            warningHours: 0,
            intervalMonths: 0
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
                subCenterId: subId || undefined,
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
                        {active ? <ToggleRight size={32} className="text-green-500" /> : <ToggleRight size={32} className="text-slate-300 rotate-180" />}
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

                <div>
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

            {/* Gastos e Imputaciones */}
            <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gastos e Imputaciones</h5>
                
                <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 cursor-pointer p-3 border rounded-xl transition-all ${adminExpenses ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input 
                            type="checkbox" 
                            checked={adminExpenses} 
                            onChange={() => handleExpenseChange('admin')} 
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
                            onChange={() => handleExpenseChange('transport')} 
                            className="w-5 h-5 rounded" 
                        />
                        <div className="flex items-center gap-2 font-bold text-xs uppercase">
                            <Truck size={14} /> Transp.
                        </div>
                    </label>
                </div>
            </div>

            {/* Programación de Mantenimientos (Alta) */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Plan Preventivo Inicial</h4>
                
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                    <input className="w-full p-2 border rounded" placeholder="Tarea (Ej. Cambio Aceite)" value={newDefName} onChange={e => setNewDefName(e.target.value)} />
                    
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                        <button type="button" onClick={() => setNewDefType('HOURS')} className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${newDefType === 'HOURS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Por Horas</button>
                        <button type="button" onClick={() => setNewDefType('DATE')} className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${newDefType === 'DATE' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>Calendario</button>
                    </div>

                    {newDefType === 'HOURS' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" className="w-full p-2 border rounded text-xs" placeholder="Intervalo (h)" value={newDefInterval} onChange={e => setNewDefInterval(Number(e.target.value))} />
                            <input type="number" className="w-full p-2 border rounded text-xs" placeholder="Aviso (h)" value={newDefWarning} onChange={e => setNewDefWarning(Number(e.target.value))} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" className="w-full p-2 border rounded text-xs" placeholder="Meses" value={newDefIntervalMonths} onChange={e => setNewDefIntervalMonths(Number(e.target.value))} />
                            <input type="date" className="w-full p-2 border rounded text-xs" value={newDefNextDate} onChange={e => setNewDefNextDate(e.target.value)} />
                        </div>
                    )}
                    
                    <textarea className="w-full p-2 border rounded text-xs" placeholder="Detalles de la tarea..." rows={2} value={newDefTasks} onChange={e => setNewDefTasks(e.target.value)} />
                    
                    <button type="button" onClick={addMaintenanceDef} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-xs uppercase flex items-center justify-center gap-2">
                        <Plus size={14}/> Añadir Tarea al Plan
                    </button>
                </div>

                <div className="space-y-2">
                    {defs.map((d, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                            <div>
                                <p className="text-xs font-bold text-slate-700">{d.name}</p>
                                <p className="text-[9px] text-slate-500 uppercase font-black">
                                    {d.maintenanceType === 'DATE' ? `Cada ${d.intervalMonths} meses` : `Cada ${d.intervalHours}h`}
                                </p>
                            </div>
                            <button type="button" onClick={() => removeDef(i)} className="text-red-400 p-1 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 rounded-xl text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400 shadow-lg transition-all">
                <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear Máquina Completa'}
            </button>
        </form>
    );
};
