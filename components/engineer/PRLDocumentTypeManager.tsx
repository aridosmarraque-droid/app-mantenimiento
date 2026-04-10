
import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Save, X, 
    HardHat, FileText, GraduationCap, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { PRLDocumentType, PRLCategory } from '../../types';
import { getPRLDocumentTypes, createPRLDocumentType, updatePRLDocumentType } from '../../services/db';

interface Props {
    onBack: () => void;
}

export const PRLDocumentTypeManager: React.FC<Props> = ({ onBack }) => {
    const [docTypes, setDocTypes] = useState<PRLDocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    
    const [formData, setFormData] = useState<Omit<PRLDocumentType, 'id'>>({
        name: '',
        category: 'DOCUMENTO',
        periodicityMonths: 12,
        warningDays: 30,
        activo: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getPRLDocumentTypes(false);
            setDocTypes(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return;
        try {
            if (editingId) {
                await updatePRLDocumentType(editingId, formData);
            } else {
                await createPRLDocumentType(formData);
            }
            setEditingId(null);
            setIsAdding(false);
            setFormData({ name: '', category: 'DOCUMENTO', periodicityMonths: 12, warningDays: 30, activo: true });
            loadData();
        } catch (e) {
            alert("Error al guardar");
        }
    };

    const startEdit = (d: PRLDocumentType) => {
        setEditingId(d.id);
        setFormData({
            name: d.name,
            category: d.category,
            periodicityMonths: d.periodicityMonths,
            warningDays: d.warningDays,
            activo: d.activo
        });
        setIsAdding(true);
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Tipos de Documentación y EPIs</h3>
                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-200"
                    >
                        <Plus size={16} /> Nuevo Tipo
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-blue-100 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre del Documento / EPI</label>
                            <input 
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                placeholder="Ej: Casco de Seguridad, Reconocimiento Médico..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
                                <select 
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value as PRLCategory})}
                                    className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                >
                                    <option value="DOCUMENTO">Documento</option>
                                    <option value="EPI">EPI (Protección)</option>
                                    <option value="FORMACION">Formación</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Periodicidad (Meses)</label>
                                <input 
                                    type="number"
                                    value={formData.periodicityMonths || ''}
                                    onChange={e => setFormData({...formData, periodicityMonths: parseInt(e.target.value) || undefined})}
                                    className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                    placeholder="0 = Sin vencimiento"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Días de Preaviso</label>
                            <input 
                                type="number"
                                value={formData.warningDays}
                                onChange={e => setFormData({...formData, warningDays: parseInt(e.target.value) || 0})}
                                className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={handleSave}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> {editingId ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button 
                            onClick={() => { setIsAdding(false); setEditingId(null); }}
                            className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {docTypes.map(d => (
                    <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${
                                d.category === 'EPI' ? 'bg-blue-50 text-blue-600' : 
                                d.category === 'FORMACION' ? 'bg-green-50 text-green-600' : 
                                'bg-indigo-50 text-indigo-600'
                            }`}>
                                {d.category === 'EPI' ? <HardHat size={20} /> : 
                                 d.category === 'FORMACION' ? <GraduationCap size={20} /> : 
                                 <FileText size={20} />}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-sm uppercase">{d.name}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                        <Clock size={10} /> {d.periodicityMonths ? `${d.periodicityMonths} Meses` : 'Sin vencimiento'}
                                    </span>
                                    <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1">
                                        <AlertCircle size={10} /> Preaviso: {d.warningDays} Días
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => startEdit(d)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                            <Edit2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
