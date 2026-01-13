
import React, { useState, useEffect } from 'react';
import { getWorkers, getWorkerDocuments, saveWorkerDocument } from '../../services/db';
import { Worker, WorkerDocument } from '../../types';
import { ArrowLeft, User, FileText, Calendar, ShieldCheck, AlertCircle, Clock, Search, Upload, CheckCircle2, ChevronRight, Loader2, Save } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DocumentManager: React.FC<Props> = ({ onBack }) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [docs, setDocs] = useState<WorkerDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados del formulario
    const [docType, setDocType] = useState<WorkerDocument['docType']>('CURSO_PRL');
    const [expiry, setExpiry] = useState('');

    useEffect(() => {
        getWorkers(false).then(data => {
            setWorkers(data);
            setLoading(false);
        });
    }, []);

    const handleSelectWorker = async (w: Worker) => {
        setSelectedWorker(w);
        setLoading(true);
        try {
            const userDocs = await getWorkerDocuments(w.id);
            setDocs(userDocs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDoc = async () => {
        if (!selectedWorker || !expiry) return;
        setSaving(true);
        try {
            const labels: Record<string, string> = {
                'CURSO_PRL': 'Curso Prevención Riesgos',
                'APTITUD_MEDICA': 'Reconocimiento Médico',
                'ENTREGA_EPI': 'Firma Entrega EPIs',
                'DNI': 'Renovación Documentación Identidad'
            };

            const newDoc: Omit<WorkerDocument, 'id'> = {
                workerId: selectedWorker.id,
                title: labels[docType] || docType,
                category: 'TRABAJADOR',
                issueDate: new Date(),
                expiryDate: new Date(expiry),
                status: 'ACTIVE',
                docType: docType
            };
            await saveWorkerDocument(newDoc);
            const userDocs = await getWorkerDocuments(selectedWorker.id);
            setDocs(userDocs);
            setExpiry('');
            alert("Documento registrado con éxito.");
        } catch (e) {
            alert("Error al guardar documento.");
        } finally {
            setSaving(false);
        }
    };

    const filteredWorkers = workers.filter(w => 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        w.dni.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedWorker) {
        return (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <button onClick={() => setSelectedWorker(null)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-slate-800 transition-all"><ArrowLeft size={20}/></button>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight leading-none">{selectedWorker.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedWorker.dni}</p>
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-5">
                    <div className="flex items-center gap-2">
                        <Upload size={16} className="text-green-400"/>
                        <h4 className="text-xs font-black uppercase tracking-widest text-green-400">Registrar Vencimiento</h4>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Categoría del Documento</label>
                            <select 
                                value={docType} 
                                onChange={e => setDocType(e.target.value as any)}
                                className="w-full bg-white/10 border border-white/10 p-3 rounded-xl font-bold text-sm focus:bg-white/20 transition-all outline-none"
                            >
                                <option value="CURSO_PRL" className="text-slate-900">Curso PRL (6h/20h)</option>
                                <option value="APTITUD_MEDICA" className="text-slate-900">Reconocimiento Médico</option>
                                <option value="ENTREGA_EPI" className="text-slate-900">Firma Entrega EPIs</option>
                                <option value="DNI" className="text-slate-900">Renovación DNI / Permisos</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fecha de Próximo Vencimiento</label>
                            <input 
                                type="date" 
                                value={expiry}
                                onChange={e => setExpiry(e.target.value)}
                                className="w-full bg-white/10 border border-white/10 p-3 rounded-xl font-bold text-sm focus:bg-white/20 transition-all outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleSaveDoc}
                            disabled={saving || !expiry}
                            className="w-full py-4 bg-green-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition-all disabled:opacity-30 flex justify-center items-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                            {saving ? 'Guardando...' : 'Actualizar Expediente'}
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                        <Clock size={14} className="text-slate-400"/>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Documental en Vigor</h4>
                    </div>
                    
                    {loading ? (
                        <div className="flex justify-center py-10 text-slate-300"><Loader2 className="animate-spin" size={32}/></div>
                    ) : docs.length === 0 ? (
                        <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-slate-100 text-center text-slate-300">
                            <FileText size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-xs font-bold uppercase">Sin registros digitalizados</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {docs.map(doc => {
                                const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
                                return (
                                    <div key={doc.id} className={`bg-white p-4 rounded-2xl shadow-sm border-2 flex justify-between items-center transition-colors ${isExpired ? 'border-red-100 bg-red-50/20' : 'border-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {isExpired ? <AlertCircle size={20}/> : <ShieldCheck size={20}/>}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm uppercase leading-tight">{doc.title}</p>
                                                <p className={`text-[10px] font-black mt-1 ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                                                    Vencimiento: {doc.expiryDate?.toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        {isExpired ? (
                                            <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">CADUCADO</span>
                                        ) : (
                                            <span className="text-[8px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-tighter">ACTIVO</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-700 transition-colors"><ArrowLeft size={24} /></button>
                <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Gestión Documental</h3>
                    <p className="text-[10px] font-bold text-blue-600 uppercase mt-1 tracking-widest">Módulo Prevención y Seguridad</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100 mx-1">
                <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-slate-300" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar trabajador o DNI..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 mx-1 max-h-[60vh] overflow-y-auto pb-10">
                {filteredWorkers.map(w => (
                    <button 
                        key={w.id} 
                        onClick={() => handleSelectWorker(w)}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group hover:border-blue-200 transition-all active:scale-95"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                                <User size={20} />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 leading-none group-hover:text-blue-700">{w.name}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{w.dni}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-200 group-hover:text-blue-500 transition-all" size={20}/>
                    </button>
                ))}
                {filteredWorkers.length === 0 && (
                    <div className="p-10 text-center text-slate-400 italic text-sm">No se encontraron trabajadores.</div>
                )}
            </div>
        </div>
    );
};
