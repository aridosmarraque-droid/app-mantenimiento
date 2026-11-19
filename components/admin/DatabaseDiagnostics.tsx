import React, { useState } from 'react';
import { getSchemaInfo } from '../../services/db';
import { getPreviousMonthInfo, sendPreviousMonthFleetReports } from '../../services/automation';
import { ArrowLeft, Search, CheckCircle, XCircle, Terminal, Clipboard, AlertTriangle, Trash2, Loader2, Send } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const DatabaseDiagnostics: React.FC<Props> = ({ onBack }) => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sendingMonthly, setSendingMonthly] = useState(false);
    const prevMonthInfo = getPreviousMonthInfo();
    
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

    const rlsFixQuery = `-- 3. REPARAR PERMISOS (ERROR 401 / TABLAS VACÍAS)
-- Ejecuta esto en el SQL Editor de Supabase para habilitar acceso a todas las tablas
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        -- Habilitar RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        -- Crear política de acceso total
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable all access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;`;

    const fuelTypeColumnQuery = `-- 4. AÑADIR CAMPO TIPO DE GASOIL (GASOIL A / GASOIL B) EN MÁQUINAS
-- Ejecuta esto en el SQL Editor de Supabase
ALTER TABLE public.mant_maquinas
ADD COLUMN IF NOT EXISTS tipo_gasoil TEXT DEFAULT 'GASOIL_B';

UPDATE public.mant_maquinas
SET tipo_gasoil = 'GASOIL_B'
WHERE tipo_gasoil IS NULL;`;

    const monthlyAutomationTableQuery = `-- 5. TABLA DE CONTROL DE ENVÍOS MENSUALES (FLUIDOS + GASOIL)
-- Evita duplicados cuando varios usuarios abren la app el primer día del mes
CREATE TABLE IF NOT EXISTS public.mant_envios_mensuales (
    periodo TEXT PRIMARY KEY,
    estado TEXT NOT NULL DEFAULT 'SENT',
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    detalle TEXT
);

ALTER TABLE public.mant_envios_mensuales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.mant_envios_mensuales;
CREATE POLICY "Enable all access" ON public.mant_envios_mensuales FOR ALL USING (true) WITH CHECK (true);`;

    const runDiagnostic = async () => {
        setLoading(true);
        try {
            const data = await getSchemaInfo([
                'mant_registros', 'partes_trabajo', 'cp_partes_diarios', 
                'cr_partes_diarios', 'mant_maquinas', 'mant_centros', 'mant_costes_especificos',
                'mant_envios_mensuales'
            ]);
            setResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleManualMonthlySend = async () => {
        if (sendingMonthly) return;
        if (!confirm(`¿Generar y enviar por email los informes de Monitor de Fluidos y Monitor de Gasoil correspondientes a ${prevMonthInfo.periodName}?`)) return;
        setSendingMonthly(true);
        try {
            const res = await sendPreviousMonthFleetReports(prevMonthInfo.monthKey);
            if (res.success) {
                alert(`Informes enviados correctamente (${prevMonthInfo.periodName}).\nMonitor Fluidos: ${res.fluidCount} unidades.\nMonitor Gasoil: ${res.fuelCount} unidades.`);
            } else {
                alert(`No se pudo enviar: ${res.error || 'Error desconocido'}`);
            }
        } catch (e: any) {
            alert(e?.message || 'Error al enviar los informes mensuales.');
        } finally {
            setSendingMonthly(false);
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

                <div>
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-black uppercase text-[10px] tracking-widest">
                        <Terminal size={14} /> Paso 3: Reparar Permisos (401 Unauthorized)
                    </div>
                    <div className="relative group">
                        <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-indigo-200 border border-indigo-900/30">
                            {rlsFixQuery}
                        </pre>
                        <button 
                            onClick={() => copyToClipboard(rlsFixQuery, "Consulta de REPARACIÓN DE PERMISOS copiada.")}
                            className="absolute top-2 right-2 p-2 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-lg transition-all"
                        >
                            <Clipboard size={14} />
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2 text-green-400 font-black uppercase text-[10px] tracking-widest">
                        <Terminal size={14} /> Paso 4: Columna Tipo de Gasoil (A / B) en Máquinas
                    </div>
                    <div className="relative group">
                        <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-green-200 border border-green-900/30">
                            {fuelTypeColumnQuery}
                        </pre>
                        <button 
                            onClick={() => copyToClipboard(fuelTypeColumnQuery, "Consulta para TIPO DE GASOIL copiada.")}
                            className="absolute top-2 right-2 p-2 bg-green-500/20 hover:bg-green-500/40 rounded-lg transition-all"
                        >
                            <Clipboard size={14} />
                        </button>
                    </div>
                </div>
                
                <div>
                    <div className="flex items-center gap-2 mb-2 text-cyan-400 font-black uppercase text-[10px] tracking-widest">
                        <Terminal size={14} /> Paso 5: Control Envíos Mensuales (Fluidos y Gasoil)
                    </div>
                    <div className="relative group">
                        <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-cyan-200 border border-cyan-900/30">
                            {monthlyAutomationTableQuery}
                        </pre>
                        <button 
                            onClick={() => copyToClipboard(monthlyAutomationTableQuery, "Consulta para CONTROL MENSUAL copiada.")}
                            className="absolute top-2 right-2 p-2 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-lg transition-all"
                        >
                            <Clipboard size={14} />
                        </button>
                    </div>
                </div>
                
                <p className="text-[9px] text-slate-500 italic">
                    * La de-duplicación por código se ha deshabilitado en la app para evitar pérdida de datos si hay repostajes múltiples legítimos. Use SQL para limpiezas profundas.
                </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Cierre Mensual: Fluidos y Gasoil ({prevMonthInfo.periodName})</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                        La app envía ambos informes automáticamente el primer día del mes que se abre. Pulsa aquí si quieres enviarlos manualmente ahora.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleManualMonthlySend}
                    disabled={sendingMonthly}
                    className="bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                    {sendingMonthly ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Enviar Mes Anterior
                </button>
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
