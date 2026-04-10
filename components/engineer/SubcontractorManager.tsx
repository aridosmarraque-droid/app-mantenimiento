
import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Save, X, 
    Building2, Users, UserPlus, Phone, Mail, 
    ChevronRight, Loader2, Briefcase
} from 'lucide-react';
import { Subcontractor, SubcontractorWorker } from '../../types';
import { 
    getSubcontractors, createSubcontractor, updateSubcontractor,
    getSubcontractorWorkers, createSubcontractorWorker, updateSubcontractorWorker
} from '../../services/db';

interface Props {
    onBack: () => void;
}

export const SubcontractorManager: React.FC<Props> = ({ onBack }) => {
    const [subs, setSubs] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSub, setSelectedSub] = useState<Subcontractor | null>(null);
    const [workers, setWorkers] = useState<SubcontractorWorker[]>([]);
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [isAddingWorker, setIsAddingWorker] = useState(false);
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

    const [subForm, setSubForm] = useState<Omit<Subcontractor, 'id'>>({
        name: '', cif: '', contactName: '', phone: '', email: '', activo: true
    });

    const [workerForm, setWorkerForm] = useState<Omit<SubcontractorWorker, 'id'>>({
        subcontractorId: '', name: '', dni: '', phone: '', email: '', activo: true
    });

    useEffect(() => {
        loadSubs();
    }, []);

    const loadSubs = async () => {
        setLoading(true);
        try {
            const data = await getSubcontractors(false);
            setSubs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadWorkers = async (subId: string) => {
        try {
            const data = await getSubcontractorWorkers(subId, false);
            setWorkers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSaveSub = async () => {
        if (!subForm.name || !subForm.cif) return;
        try {
            if (editingSubId) await updateSubcontractor(editingSubId, subForm);
            else await createSubcontractor(subForm);
            setIsAddingSub(false);
            setEditingSubId(null);
            setSubForm({ name: '', cif: '', contactName: '', phone: '', email: '', activo: true });
            loadSubs();
        } catch (e) {
            alert("Error al guardar subcontrata");
        }
    };

    const handleSaveWorker = async () => {
        if (!workerForm.name || !workerForm.dni || !selectedSub) return;
        try {
            const data = { ...workerForm, subcontractorId: selectedSub.id };
            if (editingWorkerId) await updateSubcontractorWorker(editingWorkerId, data);
            else await createSubcontractorWorker(data);
            setIsAddingWorker(false);
            setEditingWorkerId(null);
            setWorkerForm({ subcontractorId: '', name: '', dni: '', phone: '', email: '', activo: true });
            loadWorkers(selectedSub.id);
        } catch (e) {
            alert("Error al guardar trabajador");
        }
    };

    const selectSub = (s: Subcontractor) => {
        setSelectedSub(s);
        loadWorkers(s.id);
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {!selectedSub ? (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Empresas Subcontratistas</h3>
                        {!isAddingSub && (
                            <button onClick={() => setIsAddingSub(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-orange-200">
                                <Plus size={16} /> Nueva Empresa
                            </button>
                        )}
                    </div>

                    {isAddingSub && (
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-orange-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre Comercial</label>
                                    <input type="text" value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">CIF</label>
                                    <input type="text" value={subForm.cif} onChange={e => setSubForm({...subForm, cif: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Persona de Contacto</label>
                                    <input type="text" value={subForm.contactName} onChange={e => setSubForm({...subForm, contactName: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Teléfono</label>
                                    <input type="text" value={subForm.phone} onChange={e => setSubForm({...subForm, phone: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email</label>
                                    <input type="email" value={subForm.email} onChange={e => setSubForm({...subForm, email: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveSub} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                                    <Save size={18} /> {editingSubId ? 'Actualizar' : 'Guardar'}
                                </button>
                                <button onClick={() => { setIsAddingSub(false); setEditingSubId(null); }} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {subs.map(s => (
                            <div key={s.id} onClick={() => selectSub(s)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group cursor-pointer hover:border-orange-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800 text-sm uppercase">{s.name}</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.cif} • {s.contactName || 'Sin contacto'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="space-y-6">
                    <div className="bg-slate-900 p-6 rounded-3xl text-white">
                        <div className="flex items-center justify-between mb-2">
                            <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black uppercase">
                                <X size={14} /> Volver a Empresas
                            </button>
                            <button onClick={() => { setEditingSubId(selectedSub.id); setSubForm(selectedSub); setIsAddingSub(true); setSelectedSub(null); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all">
                                <Edit2 size={16} />
                            </button>
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight">{selectedSub.name}</h3>
                        <div className="flex items-center gap-4 mt-3 opacity-60 text-[10px] font-bold uppercase">
                            <span className="flex items-center gap-1"><Phone size={10}/> {selectedSub.phone || '---'}</span>
                            <span className="flex items-center gap-1"><Mail size={10}/> {selectedSub.email || '---'}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">Trabajadores de la Subcontrata</h4>
                        {!isAddingWorker && (
                            <button onClick={() => setIsAddingWorker(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase">
                                <UserPlus size={14} /> Añadir Operario
                            </button>
                        )}
                    </div>

                    {isAddingWorker && (
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-blue-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre Completo</label>
                                    <input type="text" value={workerForm.name} onChange={e => setWorkerForm({...workerForm, name: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">DNI / NIE</label>
                                    <input type="text" value={workerForm.dni} onChange={e => setWorkerForm({...workerForm, dni: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Teléfono</label>
                                    <input type="text" value={workerForm.phone} onChange={e => setWorkerForm({...workerForm, phone: e.target.value})} className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveWorker} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                                    <Save size={18} /> {editingWorkerId ? 'Actualizar' : 'Guardar'}
                                </button>
                                <button onClick={() => { setIsAddingWorker(false); setEditingWorkerId(null); }} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {workers.map(w => (
                            <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                                        <Users size={18} />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-800 text-xs uppercase">{w.name}</h5>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{w.dni}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setEditingWorkerId(w.id); setWorkerForm(w); setIsAddingWorker(true); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        ))}
                        {workers.length === 0 && (
                            <div className="py-10 text-center opacity-30">
                                <Users size={40} className="mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase">Sin trabajadores registrados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
