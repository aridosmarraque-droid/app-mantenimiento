
import React, { useState, useEffect } from 'react';
import { createMachine, getCostCenters } from '../../services/db';
import { CostCenter, MaintenanceDefinition } from '../../types';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateMachineForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Main Form State
    const [name, setName] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [centerId, setCenterId] = useState('');
    const [currentHours, setCurrentHours] = useState(0);
    const [requiresHours, setRequiresHours] = useState(true);
    const [adminExpenses, setAdminExpenses] = useState(false);
    const [transportExpenses, setTransportExpenses] = useState(false);

    // Maintenance Defs State
    const [defs, setDefs] = useState<MaintenanceDefinition[]>([]);
    
    // Temp State for new Def
    const [newDefName, setNewDefName] = useState('');
    const [newDefInterval, setNewDefInterval] = useState<number | ''>('');
    const [newDefWarning, setNewDefWarning] = useState<number | ''>('');
    const [newDefTasks, setNewDefTasks] = useState('');

    useEffect(() => {
        getCostCenters().then(setCenters);
    }, []);

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
        if (!newDefName || !newDefInterval || !newDefWarning) return;
        
        const newDef: MaintenanceDefinition = {
            name: newDefName,
            intervalHours: Number(newDefInterval),
            warningHours: Number(newDefWarning),
            tasks: newDefTasks
        };
        
        setDefs([...defs, newDef]);
        
        // Reset inputs
        setNewDefName('');
        setNewDefInterval('');
        setNewDefWarning('');
        setNewDefTasks('');
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
                currentHours,
                requiresHours,
                adminExpenses,
                transportExpenses,
                maintenanceDefs: defs
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear máquina. Revisa la consola para más detalles.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Nueva Máquina</h3>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Máquina *</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                    <input
                        type="text"
                        value={companyCode}
                        onChange={e => setCompanyCode(e.target.value)}
                        placeholder="Ej. RETRO-01"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
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
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horas Iniciales</label>
                    <input
                        type="number"
                        value={currentHours}
                        onChange={e => setCurrentHours(Number(e.target.value))}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h4 className="font-semibold text-sm text-slate-500 uppercase">Configuración</h4>
                
                <div className="flex items-center gap-3">
                    <input 
                        type="checkbox" 
                        id="reqHours"
                        checked={requiresHours}
                        onChange={e => setRequiresHours(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded"
                    />
                    <label htmlFor="reqHours" className="text-slate-700 font-medium">Controlar Horas</label>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="adminExp"
                            checked={adminExpenses}
                            onChange={() => handleExpenseChange('admin')}
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <label htmlFor="adminExp" className="text-slate-700 font-medium">Gastos de Administración</label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="transExp"
                            checked={transportExpenses}
                            onChange={() => handleExpenseChange('transport')}
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <label htmlFor="transExp" className="text-slate-700 font-medium">Gastos de Transporte</label>
                    </div>
                </div>
            </div>

            {/* Maintenance Definitions */}
            <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-1">
                    <h4 className="font-bold text-slate-700">Mantenimientos Programados</h4>
                </div>

                {/* List of added defs */}
                {defs.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {defs.map((def, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <div>
                                    <p className="font-bold text-blue-900">{def.name}</p>
                                    <p className="text-xs text-blue-700">Cada {def.intervalHours}h (Aviso {def.warningHours}h)</p>
                                </div>
                                <button type="button" onClick={() => removeDef(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add New Def Form */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <input 
                        placeholder="Nombre (ej. Mantenimiento 500h)" 
                        className="w-full p-2 border rounded"
                        value={newDefName}
                        onChange={e => setNewDefName(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            placeholder="Intervalo (horas)" 
                            className="w-1/2 p-2 border rounded"
                            value={newDefInterval}
                            onChange={e => setNewDefInterval(Number(e.target.value))}
                        />
                        <input 
                            type="number" 
                            placeholder="Preaviso (horas)" 
                            className="w-1/2 p-2 border rounded"
                            value={newDefWarning}
                            onChange={e => setNewDefWarning(Number(e.target.value))}
                        />
                    </div>
                    <textarea 
                        placeholder="Tareas a realizar..." 
                        className="w-full p-2 border rounded"
                        rows={2}
                        value={newDefTasks}
                        onChange={e => setNewDefTasks(e.target.value)}
                    />
                    <button 
                        type="button" 
                        onClick={addMaintenanceDef}
                        disabled={!newDefName || !newDefInterval}
                        className="w-full py-2 bg-slate-200 text-slate-700 font-bold rounded hover:bg-slate-300 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        <Plus size={16} /> Añadir Mantenimiento
                    </button>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400"
            >
                <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear Máquina Completa'}
            </button>
        </form>
    );
};

