
import React, { useState, useEffect } from 'react';
import { getCostCenters, getSubCentersByCenter, createSubCenter, deleteSubCenter, updateSubCenter } from '../../services/db';
import { CostCenter, SubCenter } from '../../types';
import { ArrowLeft, Plus, Trash2, Edit2, LayoutGrid, Factory, Save, Database, X } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const SubCenterManager: React.FC<Props> = ({ onBack }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState('');
    const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
    const [loading, setLoading] = useState(false);

    // Form
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [tracksProd, setTracksProd] = useState(false);
    const [prodField, setProdField] = useState<string>('');

    useEffect(() => {
        getCostCenters().then(setCenters);
    }, []);

    useEffect(() => {
        if (selectedCenterId) {
            setLoading(true);
            getSubCentersByCenter(selectedCenterId).then(data => {
                setSubCenters(data);
                setLoading(false);
            });
        } else {
            setSubCenters([]);
        }
    }, [selectedCenterId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (tracksProd && !prodField) {
            alert("Debe seleccionar un campo de producción para vincular.");
            return;
        }

        try {
            const payload = { 
                name, 
                tracksProduction: tracksProd, 
                productionField: tracksProd ? (prodField as any) : null 
            };

            if (editingId) {
                await updateSubCenter(editingId, payload);
            } else {
                await createSubCenter({ centerId: selectedCenterId, ...payload });
            }
            
            // Reset
            setName(''); 
            setTracksProd(false); 
            setProdField(''); 
            setEditingId(null);
            
            // Reload list
            const data = await getSubCentersByCenter(selectedCenterId);
            setSubCenters(data);
            alert("Operación realizada con éxito");
        } catch (error: any) { 
            console.error(error);
            alert("Error al procesar la solicitud: " + (error.message || "Verifique los datos")); 
        }
    };

    const handleEdit = (s: SubCenter) => {
        setEditingId(s.id);
        setName(s.name);
        setTracksProd(s.tracksProduction);
        setProdField(s.productionField || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setName('');
        setTracksProd(false);
        setProdField('');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft /></button>
                <h3 className="text-xl font-bold text-slate-800">Plantas y Subcentros</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mx-1">
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2">
                    <Factory size={14} className="text-blue-500"/> 1. Seleccionar Cantera Matriz
                </label>
                <select 
                    value={selectedCenterId} 
                    onChange={e => {
                        setSelectedCenterId(e.target.value);
                        setEditingId(null);
                    }} 
                    className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
                >
                    <option value="">-- Elija Cantera --</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {selectedCenterId && (
                <div className="px-1 space-y-6">
                    <form onSubmit={handleSave} className={`p-6 rounded-2xl border-2 shadow-lg space-y-5 transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                                {editingId ? <Edit2 size={16} className="text-blue-600"/> : <Plus size={16} className="text-green-600"/>}
                                {editingId ? 'Modificar Planta' : 'Nueva Planta / Sección'}
                            </h4>
                            {editingId && (
                                <button type="button" onClick={cancelEdit} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                    <X size={14}/> CANCELAR
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Nombre de la Instalación</label>
                                <input 
                                    required 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full p-4 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500" 
                                    placeholder="Ej. Planta de Trituración Secundaria"
                                />
                            </div>
                            
                            <div className={`p-4 rounded-xl border transition-colors ${tracksProd ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                                <label className="flex items-center gap-3 font-bold text-sm text-slate-700 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={tracksProd} 
                                        onChange={e => {
                                            setTracksProd(e.target.checked);
                                            if (!e.target.checked) setProdField('');
                                        }} 
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600"
                                    />
                                    Registra producción propia (Mantenimiento sincronizado)
                                </label>
                                
                                {tracksProd && (
                                    <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                                        <label className="block text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-widest">Vincular a campo de parte diario:</label>
                                        <select 
                                            required 
                                            value={prodField} 
                                            onChange={e => setProdField(e.target.value)} 
                                            className="w-full p-3 border border-indigo-100 rounded-xl font-black text-indigo-700 bg-white shadow-sm"
                                        >
                                            <option value="">-- Seleccionar Campo --</option>
                                            <optgroup label="Cantera Pura (CP)">
                                                <option value="MACHACADORA">Machacadora (Inicio/Fin)</option>
                                                <option value="MOLINOS">Molinos / Planta (Inicio/Fin)</option>
                                            </optgroup>
                                            <optgroup label="Canto Rodado (CR)">
                                                <option value="LAVADO">Planta de Lavado (Inicio/Fin)</option>
                                                <option value="TRITURACION">Trituración (Inicio/Fin)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">
                                <Save size={18} className="inline mr-2"/>
                                {editingId ? 'Actualizar Planta' : 'Crear Planta'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-white rounded-2xl shadow-md divide-y border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b">
                            <h4 className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Plantas registradas</h4>
                        </div>
                        {subCenters.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic text-sm">No hay subcentros creados para esta cantera.</div>
                        ) : (
                            subCenters.map(s => (
                                <div key={s.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${s.tracksProduction ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <LayoutGrid size={24}/>
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 tracking-tight leading-none mb-1">{s.name}</p>
                                            {s.tracksProduction ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">Sincronizado</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                                        <Database size={10}/> {s.productionField}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Sin vinculación</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(s)} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={20}/></button>
                                        <button 
                                            onClick={() => {
                                                if(confirm("¿Borrar planta?")) {
                                                    deleteSubCenter(s.id).then(() => getSubCentersByCenter(selectedCenterId).then(setSubCenters));
                                                }
                                            }} 
                                            className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <Trash2 size={20}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
