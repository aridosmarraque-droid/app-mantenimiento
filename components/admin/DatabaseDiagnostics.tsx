import React, { useState } from 'react';
import { getSchemaInfo } from '../../services/db';
import { ArrowLeft, Database, Search, CheckCircle, XCircle, Terminal, Clipboard } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DatabaseDiagnostics: React.FC<Props> = ({ onBack }) => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sqlQuery] = useState(`SELECT table_name, string_agg(column_name || ' (' || data_type || ')', ', ') as columnas FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name;`);

    const tablesToTest = [
        'mant_registros',
        'partes_trabajo',
        'cp_partes_diarios',
        'cr_partes_diarios',
        'cp_planificacion',
        'mant_maquinas',
        'mant_trabajadores',
        'mant_centros',
        'mant_subcentros'
    ];

    const runDiagnostic = async () => {
        setLoading(true);
        try {
            const data = await getSchemaInfo(tablesToTest);
            setResults(data);
        } catch (e) {
            console.error("Error diagnostic:", e);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copiado al portapapeles");
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft /></button>
                <h3 className="text-xl font-bold text-slate-800">Diagnóstico de Base de Datos</h3>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase text-xs tracking-widest">
                    <Terminal size={16} /> SQL Helper
                </div>
                <p className="text-xs text-slate-400 leading-relaxed italic">
                    Para arreglar la app definitivamente, necesito que ejecutes esta consulta en el **SQL Editor de Supabase** y me pegues el resultado.
                </p>
                <div className="relative group">
                    <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-green-400 border border-white/10">
                        {sqlQuery}
                    </pre>
                    <button 
                        onClick={() => copyToClipboard(sqlQuery)}
                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                        title="Copiar consulta"
                    >
                        <Clipboard size={14} />
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md space-y-4 border border-slate-100">
                <div className="flex justify-between items-center">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Escaneo de Tablas</h4>
                    <button 
                        onClick={runDiagnostic} 
                        disabled={loading}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Escaneando...' : <><Search size={14}/> Iniciar Escaneo</>}
                    </button>
                </div>

                {results.length > 0 && (
                    <div className="space-y-3">
                        {results.map(res => (
                            <div key={res.name} className={`p-4 rounded-xl border-2 transition-all ${res.status === 'FOUND' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {res.status === 'FOUND' ? <CheckCircle className="text-green-500" size={18}/> : <XCircle className="text-slate-300" size={18}/>}
                                        <span className="font-black text-slate-800 text-sm tracking-tight">{res.name}</span>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${res.status === 'FOUND' ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {res.status}
                                    </span>
                                </div>
                                {res.status === 'FOUND' && res.columns && res.columns.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Columnas detectadas:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {res.columns.map((c: string) => (
                                                <span key={c} className="text-[9px] bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded font-mono font-bold">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {res.status === 'ERROR' && (
                                    <p className="mt-2 text-[10px] text-red-500 font-bold italic">{res.message}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {results.length === 0 && !loading && (
                    <div className="text-center py-10 flex flex-col items-center gap-2">
                        <Database className="text-slate-200" size={48} />
                        <p className="text-xs text-slate-400 font-medium">Haz clic en iniciar escaneo para validar las tablas existentes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
