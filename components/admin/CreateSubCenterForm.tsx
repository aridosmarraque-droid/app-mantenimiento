
import React, { useState, useEffect } from 'react';
import { createSubCenter, getCostCenters } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, GitBranch } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateSubCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [centerId, setCenterId] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getCostCenters().then(setCenters);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createSubCenter(centerId, name);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear subcentro");
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
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <GitBranch size={24} className="text-blue-500"/> Nuevo Subcentro
                </h3>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mb-4">
                Crea divisiones dentro de una Cantera/Grupo para organizar mejor las máquinas (ej: "Palas Cargadoras", "Molienda").
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cantera / Grupo Principal *</label>
                <select
                    required
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">-- Seleccione Centro Padre --</option>
                    {centers.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name} {c.code ? `(${c.code})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Subcentro *</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Palas Cargadoras"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading || !centerId}
                className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400"
            >
                <Save className="w-5 h-5" /> {loading ? 'Guardando...' : 'Crear Subcentro'}
            </button>
        </form>
    );
};
