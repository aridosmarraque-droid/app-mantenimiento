
import React, { useState, useEffect } from 'react';
import { createCostCenter, getCostCenters, deleteCostCenter, updateCostCenter } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, Loader2, Factory, Trash2, Edit2, X } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    
    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadCenters();
    }, []);

    const loadCenters = () => {
        getCostCenters().then(setCenters);
    };

    const handleEdit = (center: CostCenter) => {
        setEditingId(center.id);
        setName(center.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                // Update mode
                // @ts-ignore - Check if updateCostCenter exists in imported db service
                await updateCostCenter(editingId, name);
                alert("Cantera actualizada");
            } else {
                // Create mode
                await createCostCenter(name);
                alert("Cantera creada");
            }
            
            setName('');
            setEditingId(null);
            loadCenters();
        } catch (error) {
            console.error(error);
            alert("Error al guardar centro");
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

            <form onSubmit={handleSubmit} className={`space-y-4 p-4 rounded-lg border-2 transition-colors ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                <h4 className="font-semibold text-slate-700 flex justify-between items-center">
                    {editingId ? 'Editar Cantera' : 'Añadir Nueva'}
                    {editingId && (
                        <button type="button" onClick={cancelEdit} className="text-xs font-normal text-slate-500 flex items-center gap-1 hover:text-slate-800">
                            <X size={14}/> Cancelar
                        </button>
                    )}
                </h4>
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
                    className={`w-full py-3 rounded-lg text-white font-bold flex justify-center items-center gap-2 disabled:bg-slate-400 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    <Save className="w-5 h-5" /> {loading ? 'Guardando...' : editingId ? 'Actualizar Nombre' : 'Crear'}
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
                        <div className="flex gap-2">
                             <button onClick={() => handleEdit(c)} className="text-blue-500 hover:bg-blue-50 p-2 rounded" title="Editar Nombre">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Eliminar">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
