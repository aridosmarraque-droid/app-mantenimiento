
import React, { useState } from 'react';
import { createCostCenter } from '../../services/db';
import { Save, ArrowLeft } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCostCenter(name);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear centro");
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
                <h3 className="text-xl font-bold text-slate-800">Nueva Cantera / Grupo</h3>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Cantera / Grupo *</label>
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
    );
};
