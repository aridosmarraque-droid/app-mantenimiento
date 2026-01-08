import React, { useState, useEffect } from 'react';
import { createCostCenter, getCostCenters, deleteCostCenter, updateCostCenter } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, Loader2, Factory, Trash2, Edit2, X, ClipboardCheck } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [selectable, setSelectable] = useState(true);
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
        setSelectable(center.selectableForReports !== false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setSelectable(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await updateCostCenter(editingId, name, selectable);
                alert("Cantera actualizada");
            } else {
                await createCostCenter(name, selectable);
                alert("Cantera creada");
            }
            
            setName('');
            setSelectable(true);
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Cantera</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ej. Cantera Machacadora"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <input 
                        type="checkbox" 
                        id="selectableCenter" 
                        checked={selectable} 
                        onChange={e => setSelectable(e.target.checked)} 
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                    <label htmlFor="selectableCenter" className="text-xs font-black text-slate-600 uppercase cursor-pointer select-none">
                        Seleccionable para Parte de Trabajo
                    </label>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full py-3 rounded-lg text-white font-bold flex justify-center items-center gap-2 disabled:bg-slate-400 ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    <Save className="w-5 h-5" /> {loading ? 'Guardando...' : editingId ? 'Actualizar Cantera' : 'Crear Cantera'}
                </button>
            </form>

            <div className="space-y-2">
                <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest border-b pb-1">Canteras Existentes</h4>
                {centers.length === 0 && <p className="text-slate-400 text-sm">No hay canteras registradas.</p>}
                {centers.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 border rounded bg-white hover:bg-slate-50 transition-colors shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${c.selectableForReports !== false ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                                <Factory size={18}/>
                            </div>
                            <div>
                                <span className="font-bold text-slate-700 block leading-tight">{c.name}</span>
                                {c.selectableForReports !== false ? (
                                    <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1"><ClipboardCheck size={10}/> Seleccionable en partes</span>
                                ) : (
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Privado / Solo gestión</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1">
                             <button onClick={() => handleEdit(c)} className="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-colors" title="Editar">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors" title="Eliminar">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
