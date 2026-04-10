
import React, { useState, useEffect } from 'react';
import { 
    Search, Calendar, User, Building2, FileText, 
    AlertTriangle, CheckCircle2, Clock, Loader2,
    ChevronRight, Filter, ArrowUpDown, HardHat
} from 'lucide-react';
import { 
    PRLAssignment, CompanyPRLDocument, Worker, Subcontractor, 
    SubcontractorWorker, PRLCategory 
} from '../../types';
import { 
    getPRLAssignments, getCompanyPRLDocuments, getWorkers, 
    getSubcontractors, getSubcontractorWorkers 
} from '../../services/db';

interface Props {
    onBack: () => void;
}

type ReportTab = 'EXPIRATIONS' | 'SEARCH';

interface UnifiedDoc {
    id: string;
    title: string;
    subjectName: string;
    subjectType: 'TRABAJADOR' | 'SUBCONTRATA' | 'EMPRESA';
    expiryDate?: Date;
    status: 'EXPIRED' | 'WARNING' | 'VALID';
    category?: PRLCategory;
    daysRemaining: number;
}

export const PRLReports: React.FC<Props> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<ReportTab>('EXPIRATIONS');
    const [loading, setLoading] = useState(true);
    
    // Data
    const [unifiedDocs, setUnifiedDocs] = useState<UnifiedDoc[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [subs, setSubs] = useState<Subcontractor[]>([]);
    
    // Search Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<{id: string, type: 'WORKER' | 'SUB' | 'SUB_WORKER'} | null>(null);
    const [subjectDocs, setSubjectDocs] = useState<PRLAssignment[]>([]);
    const [subCompanyDocs, setSubCompanyDocs] = useState<CompanyPRLDocument[]>([]);

    useEffect(() => {
        loadGlobalData();
    }, []);

    const loadGlobalData = async () => {
        setLoading(true);
        try {
            const [assignments, companyDocs, allWorkers, allSubs] = await Promise.all([
                getPRLAssignments(),
                getCompanyPRLDocuments(), // Gets all
                getWorkers(false),
                getSubcontractors(false)
            ]);

            setWorkers(allWorkers);
            setSubs(allSubs);

            const today = new Date();
            today.setHours(0,0,0,0);

            const unified: UnifiedDoc[] = [];

            // Add Assignments
            assignments.forEach(a => {
                if (!a.expiryDate) return;
                const exp = new Date(a.expiryDate);
                exp.setHours(0,0,0,0);
                const diffTime = exp.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let status: 'EXPIRED' | 'WARNING' | 'VALID' = 'VALID';
                if (diffDays < 0) status = 'EXPIRED';
                else if (diffDays <= 30) status = 'WARNING';

                unified.push({
                    id: a.id,
                    title: a.documentTypeName || 'Documento',
                    subjectName: a.workerName || 'Desconocido',
                    subjectType: a.subcontractorWorkerId ? 'SUBCONTRATA' : 'TRABAJADOR',
                    expiryDate: a.expiryDate,
                    status,
                    category: a.category,
                    daysRemaining: diffDays
                });
            });

            // Add Company Docs
            companyDocs.forEach(d => {
                if (!d.expiryDate) return;
                const exp = new Date(d.expiryDate);
                exp.setHours(0,0,0,0);
                const diffTime = exp.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let status: 'EXPIRED' | 'WARNING' | 'VALID' = 'VALID';
                if (diffDays < 0) status = 'EXPIRED';
                else if (diffDays <= (d.warningDays || 30)) status = 'WARNING';

                unified.push({
                    id: d.id,
                    title: d.name,
                    subjectName: d.subcontractorId ? (allSubs.find(s => s.id === d.subcontractorId)?.name || 'Subcontrata') : 'Empresa Principal',
                    subjectType: 'EMPRESA',
                    expiryDate: d.expiryDate,
                    status,
                    daysRemaining: diffDays
                });
            });

            // Sort: Expired first, then Warning, then by date
            unified.sort((a, b) => {
                if (a.status === 'EXPIRED' && b.status !== 'EXPIRED') return -1;
                if (a.status !== 'EXPIRED' && b.status === 'EXPIRED') return 1;
                if (a.status === 'WARNING' && b.status === 'VALID') return -1;
                if (a.status === 'VALID' && b.status === 'WARNING') return 1;
                return (a.expiryDate?.getTime() || 0) - (b.expiryDate?.getTime() || 0);
            });

            setUnifiedDocs(unified);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubjectSelect = async (id: string, type: 'WORKER' | 'SUB' | 'SUB_WORKER') => {
        setLoading(true);
        setSelectedSubject({ id, type });
        try {
            if (type === 'WORKER') {
                const docs = await getPRLAssignments(id);
                setSubjectDocs(docs);
                setSubCompanyDocs([]);
            } else if (type === 'SUB') {
                const [cDocs, subWorkers] = await Promise.all([
                    getCompanyPRLDocuments(id),
                    getSubcontractorWorkers(id, false)
                ]);
                setSubCompanyDocs(cDocs);
                
                // Get all assignments for all workers of this sub
                const allWorkerDocs = await Promise.all(
                    subWorkers.map(sw => getPRLAssignments(undefined, sw.id))
                );
                setSubjectDocs(allWorkerDocs.flat());
            } else if (type === 'SUB_WORKER') {
                const docs = await getPRLAssignments(undefined, id);
                setSubjectDocs(docs);
                setSubCompanyDocs([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading && unifiedDocs.length === 0) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                    onClick={() => setActiveTab('EXPIRATIONS')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'EXPIRATIONS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Clock size={14} /> Vencimientos Globales
                </button>
                <button 
                    onClick={() => setActiveTab('SEARCH')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'SEARCH' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Search size={14} /> Consulta por Sujeto
                </button>
            </div>

            {activeTab === 'EXPIRATIONS' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Listado Ordenado por Vencimiento</h3>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">CADUCADOS</span>
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">PREAVISO</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {unifiedDocs.map(doc => (
                            <div key={doc.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group transition-all hover:border-blue-200 ${
                                doc.status === 'EXPIRED' ? 'border-l-4 border-l-red-500' : 
                                doc.status === 'WARNING' ? 'border-l-4 border-l-amber-500' : ''
                            }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${
                                        doc.subjectType === 'TRABAJADOR' ? 'bg-blue-50 text-blue-600' :
                                        doc.subjectType === 'SUBCONTRATA' ? 'bg-orange-50 text-orange-600' :
                                        'bg-indigo-50 text-indigo-600'
                                    }`}>
                                        {doc.subjectType === 'TRABAJADOR' ? <User size={20} /> : 
                                         doc.subjectType === 'SUBCONTRATA' ? <Building2 size={20} /> : 
                                         <FileText size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-slate-800 text-sm uppercase">{doc.title}</h4>
                                            {doc.category && (
                                                <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{doc.category}</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                            {doc.subjectName} <span className="mx-1 opacity-30">•</span> {doc.subjectType}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[10px] font-black uppercase ${
                                        doc.status === 'EXPIRED' ? 'text-red-600' : 
                                        doc.status === 'WARNING' ? 'text-amber-600' : 'text-slate-400'
                                    }`}>
                                        {doc.expiryDate?.toLocaleDateString()}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                        {doc.status === 'EXPIRED' ? `Hace ${Math.abs(doc.daysRemaining)} días` : 
                                         doc.status === 'WARNING' ? `En ${doc.daysRemaining} días` : 
                                         `Faltan ${doc.daysRemaining} días`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'SEARCH' && (
                <div className="space-y-6">
                    {/* Search Selector */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="BUSCAR TRABAJADOR O EMPRESA..." 
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 uppercase text-xs"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {searchTerm && !selectedSubject && (
                            <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-50">
                                {/* Workers */}
                                {workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase())).map(w => (
                                    <button key={w.id} onClick={() => handleSubjectSelect(w.id, 'WORKER')} className="w-full p-4 text-left hover:bg-blue-50 flex items-center justify-between group transition-colors">
                                        <div className="flex items-center gap-3">
                                            <User size={16} className="text-blue-500" />
                                            <span className="text-xs font-black text-slate-700 uppercase">{w.name}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase group-hover:text-blue-600">Trabajador Propio</span>
                                    </button>
                                ))}
                                {/* Subcontractors */}
                                {subs.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                                    <button key={s.id} onClick={() => handleSubjectSelect(s.id, 'SUB')} className="w-full p-4 text-left hover:bg-orange-50 flex items-center justify-between group transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Building2 size={16} className="text-orange-500" />
                                            <span className="text-xs font-black text-slate-700 uppercase">{s.name}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase group-hover:text-orange-600">Empresa Subcontrata</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedSubject && (
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-3">
                                    {selectedSubject.type === 'WORKER' ? <User className="text-blue-600" /> : <Building2 className="text-orange-600" />}
                                    <div>
                                        <h4 className="font-black text-slate-800 text-sm uppercase">
                                            {selectedSubject.type === 'WORKER' ? workers.find(w => w.id === selectedSubject.id)?.name : subs.find(s => s.id === selectedSubject.id)?.name}
                                        </h4>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Sujeto Seleccionado</p>
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedSubject(null); setSubjectDocs([]); setSubCompanyDocs([]); }} className="p-2 hover:bg-blue-100 rounded-xl transition-colors text-blue-600">
                                    <X size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    {selectedSubject && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Documentación Asociada</h3>
                            
                            <div className="space-y-3">
                                {subjectDocs.map(doc => (
                                    <div key={doc.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 text-slate-400 rounded-xl">
                                                <HardHat size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm uppercase">{doc.documentTypeName}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                    {doc.workerName ? `Trabajador: ${doc.workerName}` : 'Documento Personal'}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Emisión: {doc.issueDate.toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-700 uppercase">
                                                {doc.expiryDate ? doc.expiryDate.toLocaleDateString() : 'Sin Vencimiento'}
                                            </p>
                                            {doc.expiryDate && (
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Vencimiento</p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {subCompanyDocs.map(doc => (
                                    <div key={doc.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-sm uppercase">{doc.name}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Documento de Empresa</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-700 uppercase">
                                                {doc.expiryDate ? doc.expiryDate.toLocaleDateString() : 'Sin Vencimiento'}
                                            </p>
                                            {doc.expiryDate && (
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Vencimiento</p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {subjectDocs.length === 0 && subCompanyDocs.length === 0 && (
                                    <div className="py-20 text-center opacity-30">
                                        <FileText size={64} className="mx-auto mb-4 text-slate-300" />
                                        <p className="font-black uppercase tracking-widest text-[10px]">Sin documentos registrados para este sujeto</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const X = ({ size, className }: { size?: number, className?: string }) => (
    <svg 
        width={size || 24} 
        height={size || 24} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);
