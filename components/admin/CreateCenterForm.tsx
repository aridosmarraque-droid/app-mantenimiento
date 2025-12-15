
import React, { useState, useEffect } from 'react';
import { createCostCenter, getCostCenters, deleteCostCenter } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, Loader2, Factory, Trash2 } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [centers, setCenters] = useState<CostCenter[]>([]);

    useEffect(() => {
        loadCenters();
    }, []);

    const loadCenters = () => {
        getCostCenters().then(setCenters);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCostCenter(name);
            setName('');
            loadCenters();
            // Optional: onSuccess(); if we want to close immediately, but staying to create more is often better in lists
            alert("Cantera creada");
        } catch (error) {
            console.error(error);
            alert("Error al crear centro");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!confirm("¿Seguro que quieres eliminar esta cantera?")) return;
        try {
            await deleteCostCenter(id);
            loadCenters();
        } catch(e) {
            alert("Error al eliminar");
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Gestionar Canteras</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-700">Añadir Nueva</h4>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej. Cantera Machacadora"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400"
                >
                    <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear'}
                </button>
            </form>

            <div className="space-y-2">
                <h4 className="font-semibold text-slate-700">Canteras Existentes</h4>
                {centers.length === 0 && <p className="text-slate-400 text-sm">No hay canteras registradas.</p>}
                {centers.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 border rounded bg-white hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Factory size={16} className="text-slate-400"/>
                            <span className="font-medium text-slate-700">{c.name}</span>
                        </div>
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
   
