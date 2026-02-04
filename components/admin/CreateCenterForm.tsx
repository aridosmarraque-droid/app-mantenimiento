import React, { useState, useEffect } from 'react';
import { createCostCenter, getCostCenters, deleteCostCenter, updateCostCenter } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, Loader2, Factory, Trash2, Edit2, X, Hash, ToggleRight, ToggleLeft } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [companyCode, setCompanyCode] = useState('');
    const [selectable, setSelectable] = useState(true);

    useEffect(() => {
        loadCenters();
    }, []);

    const loadCenters = () => {
        getCostCenters().then(setCenters);
    };

    const handleEdit = (center: CostCenter) => {
        setEditingId(center.id);
        setName(center.name);
        setCompanyCode(center.companyCode || '');
        setSelectable(center.selectableForReports !== false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setCompanyCode('');
        setSelectable(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { 
                name, 
                companyCode, 
                selectableForReports: selectable 
            };

            if (editingId) {
                await updateCostCenter(editingId, payload);
                alert("Centro actualizado.");
            } else {
                await createCostCenter(payload);
                alert("Centro creado.");
            }
            
            cancelEdit();
            loadCenters();
        } catch (error) {
            console.error(error);
            alert("Error al guardar centro.");
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
            alert("Error al eliminar.");
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
            <div className="flex items-center gap-2 border-b pb-2">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Gestionar Centros de Coste</h3>
            </div>

            <form onSubmit={handleSubmit} className={`space-y-4 p-5 rounded-2xl border-2 transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest">
                        {editingId ? 'Modificar Registro' : 'Añadir Nuevo'}
                    </h4>
                    {editingId && (
                        <button type="button" onClick={cancelEdit} className="text-[10px] font-bold text-slate-500 flex items-center gap-1 hover:text-slate-800 uppercase">
                            <X size={14}/> Cancelar
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej. Cantera Machacadora"
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                            <Hash size={10}/> Código Centro
                        </label>
                        <input
                            type="text"
                            value={companyCode}
                            onChange={e => setCompanyCode(e.target.value)}
                            placeholder="Ej. CAN-01"
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                         <button type="button" onClick={() => setSelectable(!selectable)} className={`flex items-center gap-2 p-3 border rounded-xl transition-all ${selectable ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                            {selectable ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            <span className="text-[10px] font-black uppercase">Visible en Partes</span>
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className={`w-full py-4 rounded-xl text-white font-black uppercase text-xs tracking-widest flex justify-center items-center gap-2 disabled:bg-slate-400 shadow-lg ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-black'}`}
                >
                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} 
                    {editingId ? 'Actualizar Ficha' : 'Crear Centro de Coste'}
                </button>
            </form>

            <div className="space-y-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-1">Registros Existentes</h4>
                {centers.length === 0 && <p className="text-slate-400 text-sm italic p-4">No hay centros registrados.</p>}
                <div className="grid gap-2">
                    {centers.map(c => (
                        <div key={c.id} className={`flex justify-between items-center p-4 border rounded-2xl bg-white hover:bg-slate-50 transition-all shadow-sm ${!c.selectableForReports ? 'opacity-60 border-dashed' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                    <Factory size={20}/>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-800 uppercase text-xs">{c.name}</span>
                                        {!c.selectableForReports && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black uppercase">Oculto</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.companyCode || 'SIN_COD'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title="Editar">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Eliminar">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
