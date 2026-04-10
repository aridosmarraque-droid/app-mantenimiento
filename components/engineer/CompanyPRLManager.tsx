
import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Save, X, 
    FileText, Building2, AlertTriangle, CheckCircle2, 
    Clock, Loader2, ShieldAlert
} from 'lucide-react';
import { CompanyPRLDocument, Subcontractor } from '../../types';
import { 
    getCompanyPRLDocuments, saveCompanyPRLDocument, 
    updateCompanyPRLDocument, deleteCompanyPRLDocument,
    getSubcontractors
} from '../../services/db';

interface Props {
    onBack: () => void;
}

export const CompanyPRLManager: React.FC<Props> = ({ onBack }) => {
    const [docs, setDocs] = useState<CompanyPRLDocument[]>([]);
    const [subs, setSubs] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedSubId, setSelectedSubId] = useState<string | null>(null); // null = Main Company

    const [formData, setFormData] = useState<Omit<CompanyPRLDocument, 'id'>>({
        subcontractorId: undefined,
        name: '',
        issueDate: new Date(),
        expiryDate: undefined,
        warningDays: 30,
        notified: false
    });

    useEffect(() => {
        loadData();
    }, [selectedSubId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [dData, sData] = await Promise.all([
                getCompanyPRLDocuments(selectedSubId || undefined),
                getSubcontractors(true)
            ]);
            setDocs(dData);
            setSubs(sData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return;
        try {
            const data = { ...formData, subcontractorId: selectedSubId || undefined };
            if (editingId) await updateCompanyPRLDocument(editingId, data);
            else await saveCompanyPRLDocument(data);
            setIsAdding(false);
            setEditingId(null);
            setFormData({ subcontractorId: undefined, name: '', issueDate: new Date(), expiryDate: undefined, warningDays: 30, notified: false });
            loadData();
        } catch (e) {
            alert("Error al guardar documento");
        }
    };

    const getStatus = (expiryDate?: Date) => {
        if (!expiryDate) return 'VALID';
        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(expiryDate);
        exp.setHours(0,0,0,0);
        
        if (exp < today) return 'EXPIRED';
        
        const diffTime = exp.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) return 'WARNING';
        
        return 'VALID';
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button 
                    onClick={() => setSelectedSubId(null)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                        selectedSubId === null ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'
                    }`}
                >
                    Empresa Principal
                </button>
                {subs.map(s => (
                    <button 
                        key={s.id}
                        onClick={() => setSelectedSubId(s.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                            selectedSubId === s.id ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'
                        }`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">
                    {selectedSubId ? 'Documentación Subcontrata' : 'Documentación Empresa Principal'}
                </h3>
                {!isAdding && (
                    <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-200">
                        <Plus size={16} /> Nuevo Documento
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-3xl shadow-xl border border-indigo-100 space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre del Documento (RC, CAE, etc.)</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Emisión</label>
                            <input type="date" value={formData.issueDate.toISOString().split('T')[0]} onChange={e => setFormData({...formData, issueDate: new Date(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Vencimiento</label>
                            <input type="date" value={formData.expiryDate ? formData.expiryDate.toISOString().split('T')[0] : ''} onChange={e => setFormData({...formData, expiryDate: e.target.value ? new Date(e.target.value) : undefined})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Días de Preaviso</label>
                        <input type="number" value={formData.warningDays} onChange={e => setFormData({...formData, warningDays: parseInt(e.target.value) || 0})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                            <Save size={18} /> {editingId ? 'Actualizar' : 'Guardar'}
                        </button>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {docs.map(d => {
                    const status = getStatus(d.expiryDate);
                    return (
                        <div key={d.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group ${
                            status === 'EXPIRED' ? 'border-l-4 border-l-red-500' : 
                            status === 'WARNING' ? 'border-l-4 border-l-amber-500' : ''
                        }`}>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm uppercase">{d.name}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Emisión: {d.issueDate.toLocaleDateString()}</span>
                                        {d.expiryDate && (
                                            <span className={`text-[9px] font-black uppercase ${
                                                status === 'EXPIRED' ? 'text-red-600' : 
                                                status === 'WARNING' ? 'text-amber-600' : 'text-slate-500'
                                            }`}>
                                                Vence: {d.expiryDate.toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setEditingId(d.id); setFormData(d); setIsAdding(true); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                                <Edit2 size={18} />
                            </button>
                        </div>
                    );
                })}
                {docs.length === 0 && (
                    <div className="py-20 text-center opacity-30">
                        <FileText size={64} className="mx-auto mb-4 text-slate-300" />
                        <p className="font-black uppercase tracking-widest text-[10px]">Sin documentación registrada</p>
                    </div>
                )}
            </div>
        </div>
    );
};
