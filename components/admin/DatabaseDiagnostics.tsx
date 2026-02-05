import React, { useState } from 'react';
import { getSchemaInfo } from '../../services/db';
import { ArrowLeft, Search, CheckCircle, XCircle, Terminal, Clipboard, AlertTriangle, Trash2, Loader2 } from 'lucide-center';

interface Props {
    onBack: () => void;
}

export const DatabaseDiagnostics: React.FC<Props> = ({ onBack }) => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const duplicateCheckQuery = `-- 1. BUSCAR DUPLICADOS EXACTOS (Misma máquina, fecha, horas y litros)
SELECT maquina_id, fecha, horas_registro, litros_combustible, COUNT(*)
FROM mant_registros
WHERE tipo_operacion = 'REFUELING'
GROUP BY maquina_id, fecha, horas_registro, litros_combustible
HAVING COUNT(*) > 1;`;

    const duplicateDeleteQuery = `-- 2. ELIMINAR DUPLICADOS MANTENIENDO SOLO UNO
-- Ejecuta esto en el SQL Editor de Supabase
DELETE FROM mant_registros
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY maquina_id, fecha, horas_registro, litros_combustible, tipo_operacion
            ORDER BY id ASC
        ) as numero_fila
        FROM mant_registros
        WHERE tipo_operacion = 'REFUELING'
    ) t WHERE t.numero_fila > 1
);`;

    const runDiagnostic = async () => {
        setLoading(true);
        try {
            const data = await getSchemaInfo([
                'mant_registros', 'partes_trabajo', 'cp_partes_diarios', 
                'cr_partes_diarios', 'mant_maquinas', 'mant_centros', 'mant_costes_especificos'
            ]);
            setResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, msg: string) => {
        navigator.clipboard.writeText(text);
        alert(msg);
    };

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft /></button>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Herramientas de Base de Datos</h3>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-6 mx-1">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-amber-400 font-black uppercase text-[10px] tracking-widest">
                        <AlertTriangle size={14} /> Paso 1: Identificar Duplicados
                    </div>
                    <div className="relative group">
                        <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-amber-200 border border-white/10">
                            {duplicateCheckQuery}
                        </pre>
                        <button 
                            onClick={() => copyToClipboard(duplicateCheckQuery, "Consulta de búsqueda copiada.")}
                            className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                        >
                            <Clipboard size={14} />
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2 text-red-400 font-black uppercase text-[10px] tracking-widest">
                        <Trash2 size={14} /> Paso 2: Limpieza (Mantiene 1 registro)
                    </div>
                    <div className="relative group">
                        <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-red-200 border border-red-900/30">
                            {duplicateDeleteQuery}
                        </pre>
                        <button 
                            onClick={() => copyToClipboard(duplicateDeleteQuery, "Consulta de ELIMINACIÓN copiada.")}
                            className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-all"
                        >
                            <Clipboard size={14} />
                        </button>
                    </div>
                </div>
                
                <p className="text-[9px] text-slate-500 italic">
                    * La de-duplicación por código se ha deshabilitado en la app para evitar pérdida de datos si hay repostajes múltiples legítimos. Use SQL para limpiezas profundas.
                </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Estado de Tablas</h4>
                    <button onClick={runDiagnostic} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={14}/> : <Search size={14}/>} Escanear
                    </button>
                </div>
                <div className="space-y-2">
                    {results.map(res => (
                        <div key={res.name} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-xs font-bold text-slate-700">{res.name}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${res.status === 'FOUND' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {res.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
