
import React, { useState, useEffect } from 'react';
import { createMachine, getCostCenters } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateMachineForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [name, setName] = useState('');
    const [centerId, setCenterId] = useState('');
    const [currentHours, setCurrentHours] = useState(0);
    const [requiresHours, setRequiresHours] = useState(true);
    const [adminExpenses, setAdminExpenses] = useState(false);

    useEffect(() => {
        getCostCenters().then(setCenters);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createMachine({
                name,
                costCenterId: centerId,
                currentHours,
                requiresHours,
                adminExpenses
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear máquina");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Nueva Máquina</h3>
            </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Coste *</label>
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

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                <input 
                    type="checkbox" 
                    id="reqHours"
                    checked={requiresHours}
                    onChange={e => setRequiresHours(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                />
                <label htmlFor="reqHours" className="text-slate-700 font-medium">Controlar Horas</label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                <input 
                    type="checkbox" 
                    id="adminExp"
                    checked={adminExpenses}
                    onChange={e => setAdminExpenses(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                />
                <label htmlFor="adminExp" className="text-slate-700 font-medium">Gastos de Administración</label>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400"
            >
                <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear Máquina'}
            </button>
        </form>
    );
};
