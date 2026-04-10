
import React, { useState } from 'react';
import { 
    ShieldCheck, Users, Building2, FileText, 
    Bell, Settings, ArrowLeft, Plus, Search,
    HardHat, ClipboardList, AlertTriangle
} from 'lucide-react';
import { PRLDocumentTypeManager } from './PRLDocumentTypeManager';
import { SubcontractorManager } from './SubcontractorManager';
import { WorkerPRLManager } from './WorkerPRLManager';
import { CompanyPRLManager } from './CompanyPRLManager';

interface Props {
    onBack: () => void;
}

enum EngineerView {
    HOME,
    DOC_TYPES,
    SUBCONTRACTORS,
    WORKERS_PRL,
    COMPANY_DOCS
}

export const EngineerDashboard: React.FC<Props> = ({ onBack }) => {
    const [view, setView] = useState<EngineerView>(EngineerView.HOME);

    const renderView = () => {
        switch (view) {
            case EngineerView.DOC_TYPES:
                return <PRLDocumentTypeManager onBack={() => setView(EngineerView.HOME)} />;
            case EngineerView.SUBCONTRACTORS:
                return <SubcontractorManager onBack={() => setView(EngineerView.HOME)} />;
            case EngineerView.WORKERS_PRL:
                return <WorkerPRLManager onBack={() => setView(EngineerView.HOME)} />;
            case EngineerView.COMPANY_DOCS:
                return <CompanyPRLManager onBack={() => setView(EngineerView.HOME)} />;
            default:
                return (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                                    <ShieldCheck size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Ingeniería</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prevención de Riesgos Laborales (PRL)</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setView(EngineerView.DOC_TYPES)}
                                    className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-blue-500 hover:bg-white transition-all text-left group"
                                >
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <HardHat size={24} />
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1">Documentación PRL</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">EPIs, Carnets, Cursos</p>
                                </button>

                                <button 
                                    onClick={() => setView(EngineerView.SUBCONTRACTORS)}
                                    className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-orange-500 hover:bg-white transition-all text-left group"
                                >
                                    <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <Building2 size={24} />
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1">Subcontratas</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Empresas y Trabajadores</p>
                                </button>

                                <button 
                                    onClick={() => setView(EngineerView.WORKERS_PRL)}
                                    className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-green-500 hover:bg-white transition-all text-left group"
                                >
                                    <div className="p-3 bg-green-100 text-green-600 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <Users size={24} />
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1">Control Personal</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Asignación y Vencimientos</p>
                                </button>

                                <button 
                                    onClick={() => setView(EngineerView.COMPANY_DOCS)}
                                    className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-indigo-500 hover:bg-white transition-all text-left group"
                                >
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <FileText size={24} />
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase mb-1">Docs. Empresa</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Seguros, CAE, RC</p>
                                </button>
                            </div>
                        </div>

                        <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle className="text-amber-600" size={24} />
                                <h3 className="font-black text-amber-800 uppercase text-sm">Alertas Próximas</h3>
                            </div>
                            <p className="text-xs text-amber-700 font-medium">
                                El sistema notificará automáticamente vía WhatsApp al ingeniero cuando un documento o EPI esté próximo a vencer según el preaviso configurado.
                            </p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="pb-20">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gestión de Ingeniería</h1>
            </div>
            {renderView()}
        </div>
    );
};
