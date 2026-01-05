
import React, { useState, useEffect } from 'react';
import { getCostCenters, getSubCentersByCenter, createSubCenter, deleteSubCenter, updateSubCenter } from '../../services/db';
import { CostCenter, SubCenter } from '../../types';
import { ArrowLeft, Plus, Trash2, Edit2, LayoutGrid, Factory, Save, Database } from 'lucide-react';

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
    const [prodField, setProdField] = useState<any>('');

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
        }
    }, [selectedCenterId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateSubCenter(editingId, { name, tracksProduction: tracksProd, productionField: prodField || undefined });
            } else {
                await createSubCenter({ centerId: selectedCenterId, name, tracksProduction: tracksProd, productionField: prodField || undefined });
            }
            setName(''); setTracksProd(false); setProdField(''); setEditingId(null);
            getSubCentersByCenter(selectedCenterId).then(setSubCenters);
        } catch (e) { alert("Error"); }
    };

    const handleEdit = (s: SubCenter) => {
        setEditingId(s.id);
        setName(s.name);
        setTracksProd(s.tracksProduction);
        setProdField(s.productionField || '');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500"><ArrowLeft /></button>
                <h3 className="text-xl font-bold">Plantas y Subcentros</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Factory size={16}/> Cantera Matriz</label>
                <select value={selectedCenterId} onChange={e => setSelectedCenterId(e.target.value)} className="w-full p-3 border rounded-lg">
                    <option value="">-- Seleccionar Cantera --</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {selectedCenterId && (
                <div className="animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleSave} className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm space-y-4 mb-6">
                        <h4 className="font-bold text-blue-900 flex items-center gap-2">
                            {editingId ? <Edit2 size={18}/> : <Plus size={18}/>}
                            {editingId ? 'Editar Subcentro' : 'Nueva Planta / Sección'}
                        </h4>
                        <div className="space-y-3">
                            <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Nombre (ej. Planta de Lavado)"/>
                            
                            <div className="bg-white p-4 rounded-lg border border-blue-200">
                                <label className="flex items-center gap-2 font-bold text-sm text-slate-700 cursor-pointer">
                                    <input type="checkbox" checked={tracksProd} onChange={e => setTracksProd(e.target.checked)} className="w-5 h-5"/>
                                    Registra producción propia
                                </label>
                                {tracksProd && (
                                    <div className="mt-3">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Vincular a campo de parte diario:</label>
                                        <select required value={prodField} onChange={e => setProdField(e.target.value)} className="w-full p-2 border rounded font-bold text-blue-700">
                                            <option value="">-- Vincular a --</option>
                                            <option value="MACHACADORA">CP: Machacadora</option>
                                            <option value="MOLINOS">CP: Molinos / Planta Principal</option>
                                            <option value="LAVADO">CR: Planta de Lavado</option>
                                            <option value="TRITURACION">CR: Trituración Secundario</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg">
                                {editingId ? 'Actualizar Subcentro' : 'Añadir Subcentro'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-white rounded-xl shadow-md divide-y overflow-hidden">
                        {subCenters.map(s => (
                            <div key={s.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 text-slate-500 rounded"><LayoutGrid size={20}/></div>
                                    <div>
                                        <p className="font-bold text-slate-800">{s.name}</p>
                                        {s.tracksProduction && (
                                            <p className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                                                <Database size={10}/> Sync: {s.productionField}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(s)} className="p-2 text-blue-600"><Edit2 size={18}/></button>
                                    <button onClick={() => deleteSubCenter(s.id).then(() => getSubCentersByCenter(selectedCenterId).then(setSubCenters))} className="p-2 text-red-600"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
