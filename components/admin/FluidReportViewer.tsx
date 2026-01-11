import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getCostCenters } from '../../services/db';
import { getMachineFluidStats, formatDecimal } from '../../services/stats';
import { analyzeFluidHealth } from '../../services/ai';
import { generateFluidReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog } from '../../types';
import { 
    ArrowLeft, Loader2, AlertTriangle, Truck, Sparkles, Activity,
    Thermometer, ShieldCheck, Waves, TrendingUp, TrendingDown, Minus,
    Send, BrainCircuit, History, Info, Key
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

const getDeviationStatus = (dev: number) => {
    if (dev <= 10 && dev >= -10) return { color: 'text-green-600', bg: 'bg-green-50', label: 'Estable', icon: ShieldCheck };
    if (dev > 10 && dev <= 25) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Incremento Ligero', icon: TrendingUp };
    if (dev > 25) return { color: 'text-red-600', bg: 'bg-red-50', label: 'ALERTA / AVERÍA', icon: AlertTriangle };
    return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Reducción', icon: TrendingDown };
};

export const FluidReportViewer: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [sending, setSending] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            // @ts-ignore
            const selected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(selected);
        };
        checkKey();

        const loadInitialData = async () => {
            const [centers, allM] = await Promise.all([
                getCostCenters(),
                getAllMachines(false)
            ]);
            const mobileCenter = centers.find(c => {
                const name = c.name.toLowerCase();
                return name.includes('móvil') || name.includes('movil');
            });
            setMachines(mobileCenter 
                ? allM.filter(m => m.costCenterId === mobileCenter.id)
                : allM.filter(m => m.companyCode)
            );
        };
        loadInitialData();
    }, []);

    const handleSelectKey = async () => {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
        if (selectedMachineId) loadStats();
    };

    const runAiDiagnosis = useCallback(async (currentStats: any, machine: Machine) => {
        if (!hasApiKey) return;
        setAnalyzing(true);
        try {
            const result = await analyzeFluidHealth(
                machine.name,
                currentStats.motor,
                currentStats.hydraulic,
                currentStats.coolant,
                machine.currentHours
            );
            setAiAnalysis(result);
        } catch (e) {
            console.error(e);
            setAiAnalysis("Error en diagnóstico IA: Verifique conectividad o clave API.");
        } finally {
            setAnalyzing(false);
        }
    }, [hasApiKey]);

    const loadStats = useCallback(async () => {
        if (!selectedMachineId) return;
        setLoading(true);
        setAiAnalysis(null);
        try {
            const data = await getMachineFluidStats(selectedMachineId);
            setStats(data);
            const machine = machines.find(m => m.id === selectedMachineId);
            if (machine && (data.motor.logsCount >= 2 || data.hydraulic.logsCount >= 2 || data.coolant.logsCount >= 2)) {
                runAiDiagnosis(data, machine);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedMachineId, machines, runAiDiagnosis]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSendMonthlyReport = async () => {
        if (!hasApiKey) {
            alert("Debe seleccionar una API Key antes de generar el informe IA.");
            handleSelectKey();
            return;
        }
        if (!confirm("Se enviará el Monitor de Salud con Resumen de Alertas e IA a aridos@marraque.es. ¿Confirmar?")) return;
        setSending(true);
        try {
            const now = new Date();
            const periodName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            const consolidatedData = [];

            for (const m of machines) {
                const mStats = await getMachineFluidStats(m.id);
                if (mStats.motor.logsCount >= 2 || mStats.hydraulic.logsCount >= 2 || mStats.coolant.logsCount >= 2) {
                    const diagnosis = await analyzeFluidHealth(m.name, mStats.motor, mStats.hydraulic, mStats.coolant, m.currentHours);
                    consolidatedData.push({ machine: m, stats: mStats, aiAnalysis: diagnosis });
                }
            }

            if (consolidatedData.length === 0) {
                alert("Sin datos suficientes.");
                setSending(false);
                return;
            }

            const pdfBase64 = generateFluidReportPDF(consolidatedData, periodName);
            const res = await sendEmail(
                ['aridos@marraque.es'],
                `Monitor Salud Fluidos - Auditoría ${periodName}`,
                `<p>Informe técnico generado con <strong>IA de Patrones</strong>. Incluye puntos de ruptura de tendencia.</p>`,
                pdfBase64,
                `Salud_Fluidos_${periodName.replace(/\s+/g, '_')}.pdf`
            );

            if (res.success) alert("Informe enviado correctamente.");
            else alert("Error al enviar email.");
        } catch (e) { alert("Error en proceso."); }
        finally { setSending(false); }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Salud de Fluidos</h3>
                        <p className="text-[10px] font-black text-indigo-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <BrainCircuit size={10}/> Detección de Rupturas IA
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!hasApiKey && (
                        <button onClick={handleSelectKey} className="bg-amber-100 text-amber-700 p-2.5 rounded-xl border border-amber-200 animate-pulse">
                            <Key size={20}/>
                        </button>
                    )}
                    <button 
                        onClick={handleSendMonthlyReport}
                        disabled={sending || machines.length === 0}
                        className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                </div>
            </div>

            {!hasApiKey && (
                <div className="mx-1 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center gap-3 text-center">
                    <AlertTriangle className="text-amber-600" size={32} />
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">API Key no configurada</p>
                    <p className="text-[10px] text-amber-600">Para utilizar el diagnóstico IA de patrones, debe seleccionar su clave de Google AI Studio.</p>
                    <button onClick={handleSelectKey} className="bg-amber-600 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase shadow-md">Configurar Ahora</button>
                </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                    <Truck size={12}/> Seleccionar Maquinaria Móvil
                </label>
                <select 
                    value={selectedMachineId}
                    onChange={e => setSelectedMachineId(e.target.value)}
                    className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">-- Seleccionar Unidad --</option>
                    {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-black uppercase tracking-widest text-[10px]">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
                    Analizando Serie Temporal...
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="grid grid-cols-1 gap-4">
                        <TrendCard title="Aceite Motor" stat={stats.motor} icon={Activity} />
                        <TrendCard title="Aceite Hidráulico" stat={stats.hydraulic} icon={Waves} />
                        <TrendCard title="Refrigerante" stat={stats.coolant} icon={Thermometer} />
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl shadow-xl relative overflow-hidden">
                        <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/5 rotate-12" />
                        <h4 className="text-white font-black uppercase text-[10px] tracking-widest mb-4 flex items-center gap-2">
                            <BrainCircuit size={16} className="text-indigo-400" /> Diagnóstico Predictivo IA
                        </h4>
                        
                        {analyzing ? (
                            <div className="flex items-center gap-3 text-indigo-300 py-6 animate-pulse">
                                <Loader2 className="animate-spin" size={24}/>
                                <span className="text-xs font-black uppercase tracking-widest">Calculando punto de quiebre...</span>
                            </div>
                        ) : aiAnalysis ? (
                            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 animate-in zoom-in-95 duration-300">
                                <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-line font-medium prose prose-invert">
                                    {aiAnalysis}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 text-xs italic py-4 flex items-center gap-2">
                                <Info size={14}/> Datos insuficientes para auditoría profunda.
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h4 className="font-black text-slate-500 uppercase text-[10px] tracking-widest flex items-center gap-1">
                                <History size={14}/> Historial de Consumos
                            </h4>
                        </div>
                        <div className="divide-y max-h-80 overflow-y-auto">
                            {stats.history.map((log: OperationLog) => (
                                <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{log.hoursAtExecution}h</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(log.motorOil ?? 0) > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[9px] font-black">M: {formatDecimal(log.motorOil!, 1)}L</span>}
                                        {(log.hydraulicOil ?? 0) > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[9px] font-black">H: {formatDecimal(log.hydraulicOil!, 1)}L</span>}
                                        {(log.coolant ?? 0) > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[9px] font-black">R: {formatDecimal(log.coolant!, 1)}L</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <Activity size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione máquina móvil</p>
                </div>
            )}
        </div>
    );
};

const TrendCard = ({ title, stat, icon: Icon }: any) => {
    const isError = stat.logsCount < 2;
    const info = getDeviationStatus(stat.deviation);
    const StatusIcon = info.icon;

    return (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden ${isError ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-slate-50 text-slate-400`}>
                        <Icon size={18} />
                    </div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h5>
                </div>
                {!isError && (
                    <div className={`text-[9px] font-black px-2 py-1 rounded-full border flex items-center gap-1 ${info.bg} ${info.color}`}>
                        <StatusIcon size={10} /> {info.label}
                    </div>
                )}
            </div>

            {isError ? (
                <div className="text-[9px] text-slate-400 font-bold uppercase italic flex items-center gap-2">
                    <Minus size={14}/> Serie temporal insuficiente
                </div>
            ) : (
                <div className="space-y-4 relative z-10">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Tendencia Reciente</p>
                            <span className={`text-4xl font-black ${info.color}`}>{formatDecimal(stat.recentRate)}</span>
                            <span className="ml-1 text-[10px] font-bold text-slate-400">L/100h</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Desviación</p>
                            <span className={`text-xl font-black ${info.color}`}>
                                {stat.deviation > 0 ? '+' : ''}{formatDecimal(stat.deviation, 1)}%
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Media Base</p>
                            <p className="text-xs font-black text-slate-500">{formatDecimal(stat.baselineRate)} L/100h</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Puntos Serie</p>
                            <p className="text-xs font-black text-slate-500">{stat.logsCount} Muestras</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
