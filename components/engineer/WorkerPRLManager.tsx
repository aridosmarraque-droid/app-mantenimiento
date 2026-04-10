
import React, { useState, useEffect } from 'react';
import { 
    Search, Filter, Calendar, FileText, HardHat, 
    GraduationCap, AlertTriangle, CheckCircle2, 
    Clock, Plus, X, Save, Loader2, User, Building2
} from 'lucide-react';
import { 
    Worker, SubcontractorWorker, PRLDocumentType, 
    PRLAssignment, Subcontractor 
} from '../../types';
import { 
    getWorkers, getSubcontractors, getSubcontractorWorkers, 
    getPRLDocumentTypes, getPRLAssignments, savePRLAssignment, 
    updatePRLAssignment, deletePRLAssignment 
} from '../../services/db';

interface Props {
    onBack: () => void;
}

export const WorkerPRLManager: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [subs, setSubs] = useState<Subcontractor[]>([]);
    const [subWorkers, setSubWorkers] = useState<SubcontractorWorker[]>([]);
    const [docTypes, setDocTypes] = useState<PRLDocumentType[]>([]);
    
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
    const [selectedSubWorkerId, setSelectedSubWorkerId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<PRLAssignment[]>([]);
    
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<Omit<PRLAssignment, 'id' | 'documentTypeName' | 'workerName' | 'category'>>({
        documentTypeId: '',
        issueDate: new Date(),
        expiryDate: undefined,
        notified: false
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [wData, sData, dData] = await Promise.all([
                getWorkers(true),
                getSubcontractors(true),
                getPRLDocumentTypes(true)
            ]);
            setWorkers(wData);
            setSubs(sData);
            setDocTypes(dData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadSubWorkers = async (subId: string) => {
        try {
            const data = await getSubcontractorWorkers(subId, true);
            setSubWorkers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadAssignments = async (wId?: string, swId?: string) => {
        try {
            const data = await getPRLAssignments(wId, swId);
            setAssignments(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectWorker = (w: Worker) => {
        setSelectedWorkerId(w.id);
        setSelectedSubWorkerId(null);
        loadAssignments(w.id, undefined);
    };

    const handleSelectSubWorker = (sw: SubcontractorWorker) => {
        setSelectedSubWorkerId(sw.id);
        setSelectedWorkerId(null);
        loadAssignments(undefined, sw.id);
    };

    const handleSaveAssignment = async () => {
        if (!formData.documentTypeId || (!selectedWorkerId && !selectedSubWorkerId)) return;
        
        try {
            const docType = docTypes.find(d => d.id === formData.documentTypeId);
            let expiryDate = formData.expiryDate;
            
            // Auto-calculate expiry if periodicity is set
            if (!expiryDate && docType?.periodicityMonths) {
                const d = new Date(formData.issueDate);
                d.setMonth(d.getMonth() + docType.periodicityMonths);
                expiryDate = d;
            }

            await savePRLAssignment({
                ...formData,
                expiryDate,
                workerId: selectedWorkerId || undefined,
                subcontractorWorkerId: selectedSubWorkerId || undefined
            });
            
            setIsAdding(false);
            loadAssignments(selectedWorkerId || undefined, selectedSubWorkerId || undefined);
        } catch (e) {
            alert("Error al guardar asignación");
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
            {!selectedWorkerId && !selectedSubWorkerId ? (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Personal Interno</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {workers.map(w => (
                                <button key={w.id} onClick={() => handleSelectWorker(w)} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-blue-500 transition-all text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18}/></div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-xs uppercase">{w.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{w.dni}</p>
                                        </div>
                                    </div>
                                    <Plus size={16} className="text-slate-300" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Personal Subcontratas</h4>
                        <div className="space-y-4">
                            {subs.map(s => (
                                <div key={s.id} className="space-y-2">
                                    <div className="flex items-center gap-2 px-2">
                                        <Building2 size={12} className="text-orange-500" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">{s.name}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {/* This would ideally be lazy loaded or filtered */}
                                        <button onClick={() => { loadSubWorkers(s.id); }} className="text-[9px] font-bold text-blue-600 uppercase px-2 hover:underline">Ver trabajadores...</button>
                                        {subWorkers.filter(sw => sw.subcontractorId === s.id).map(sw => (
                                            <button key={sw.id} onClick={() => handleSelectSubWorker(sw)} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-orange-500 transition-all text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><User size={18}/></div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-xs uppercase">{sw.name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{sw.dni}</p>
                                                    </div>
                                                </div>
                                                <Plus size={16} className="text-slate-300" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-slate-900 p-6 rounded-3xl text-white">
                        <button onClick={() => { setSelectedWorkerId(null); setSelectedSubWorkerId(null); }} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black uppercase mb-2">
                            <X size={14} /> Volver al Listado
                        </button>
                        <h3 className="text-xl font-black uppercase tracking-tight">
                            {selectedWorkerId ? workers.find(w => w.id === selectedWorkerId)?.name : subWorkers.find(sw => sw.id === selectedSubWorkerId)?.name}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {selectedWorkerId ? 'Personal Interno' : `Subcontrata: ${subs.find(s => s.id === subWorkers.find(sw => sw.id === selectedSubWorkerId)?.subcontractorId)?.name}`}
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">Documentación y EPIs Asignados</h4>
                        {!isAdding && (
                            <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase">
                                <Plus size={14} /> Asignar Nuevo
                            </button>
                        )}
                    </div>

                    {isAdding && (
                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-blue-100 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Documento / EPI</label>
                                <select 
                                    value={formData.documentTypeId}
                                    onChange={e => setFormData({...formData, documentTypeId: e.target.value})}
                                    className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                >
                                    <option value="">Seleccionar...</option>
                                    {docTypes.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.category})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Emisión</label>
                                    <input 
                                        type="date" 
                                        value={formData.issueDate.toISOString().split('T')[0]}
                                        onChange={e => setFormData({...formData, issueDate: new Date(e.target.value)})}
                                        className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha Vencimiento</label>
                                    <input 
                                        type="date" 
                                        value={formData.expiryDate ? formData.expiryDate.toISOString().split('T')[0] : ''}
                                        onChange={e => setFormData({...formData, expiryDate: e.target.value ? new Date(e.target.value) : undefined})}
                                        className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveAssignment} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2">
                                    <Save size={18} /> Guardar Asignación
                                </button>
                                <button onClick={() => setIsAdding(false)} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {assignments.map(a => {
                            const status = getStatus(a.expiryDate);
                            return (
                                <div key={a.id} className={`bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between ${
                                    status === 'EXPIRED' ? 'border-l-4 border-l-red-500' : 
                                    status === 'WARNING' ? 'border-l-4 border-l-amber-500' : ''
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            a.category === 'EPI' ? 'bg-blue-50 text-blue-600' : 
                                            a.category === 'FORMACION' ? 'bg-green-50 text-green-600' : 
                                            'bg-indigo-50 text-indigo-600'
                                        }`}>
                                            {a.category === 'EPI' ? <HardHat size={18} /> : 
                                             a.category === 'FORMACION' ? <GraduationCap size={18} /> : 
                                             <FileText size={18} />}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-slate-800 text-xs uppercase">{a.documentTypeName}</h5>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Emisión: {a.issueDate.toLocaleDateString()}</span>
                                                {a.expiryDate && (
                                                    <span className={`text-[8px] font-black uppercase ${
                                                        status === 'EXPIRED' ? 'text-red-600' : 
                                                        status === 'WARNING' ? 'text-amber-600' : 'text-slate-500'
                                                    }`}>
                                                        Vence: {a.expiryDate.toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {status === 'EXPIRED' ? <AlertTriangle size={16} className="text-red-500" /> : 
                                         status === 'WARNING' ? <Clock size={16} className="text-amber-500" /> : 
                                         <CheckCircle2 size={16} className="text-green-500" />}
                                    </div>
                                </div>
                            );
                        })}
                        {assignments.length === 0 && (
                            <div className="py-10 text-center opacity-30">
                                <FileText size={40} className="mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase">Sin documentación asignada</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
