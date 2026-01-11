import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines } from '../../services/db';
import { getMachineFluidStats } from '../../services/stats';
import { analyzeFluidHealth } from '../../services/ai';
import { Machine, OperationLog } from '../../types';
import { 
    ArrowLeft, Droplet, Search, Loader2, 
    AlertTriangle, Truck, Info, Sparkles, Activity,
    Thermometer, ShieldCheck, Waves
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

const getStatusInfo = (rate: number, type: string) => {
    let threshold = 0.5; // L/100h default
    if (type === 'COOLANT') threshold = 1.0;
    if (type === 'HYDRAULIC') threshold = 2.0;

    if (rate === 0) return { color: 'text-slate-300', bg: 'bg-slate-50', label: 'Sin Datos', icon: ShieldCheck };
    if (rate < threshold * 0.5) return { color: 'text-green-600', bg: 'bg-green-50', label: 'Excelente', icon: ShieldCheck };
    if (rate < threshold) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Seguimiento', icon: Info };
    return { color: 'text-red-600', bg: 'bg-red-50', label: 'AVERÍA PROBABLE', icon: AlertTriangle };
};

export const FluidReportViewer: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        getAllMachines(false).then(setMachines);
    }, []);

    const loadStats = useCallback(async () => {
        if (!selectedMachineId) return;
        setLoading(true);
        setAiAnalysis(null);
        try {
            const data = await getMachineFluidStats(selectedMachineId);
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedMachineId]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleRunAiDiagnosis = async () => {
        if (!stats) return;
        setAnalyzing(true);
        const machine = machines.find(m => m.id === selectedMachineId);
        try {
            const result = await analyzeFluidHealth(
                machine?.name || 'Desconocida',
                stats.motor.consumptionPer100h,
                stats.hydraulic.consumptionPer100h,
                stats.coolant.consumptionPer100h,
                machine?.currentHours || 0
            );
            setAiAnalysis(result);
        } catch (e) {
            alert("Error en el diagnóstico de IA");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Salud de Fluidos</h3>
                    <p className="text-[10px] font-black text-indigo-600 uppercase mt-1 tracking-widest">Monitor Preventivo de Averías</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                    <Truck size={12}/> Seleccionar Maquinaria
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
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
                    <p className="font-black uppercase tracking-widest text-[10px]">Analizando patrones históricos...</p>
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="grid grid-cols-1 gap-4">
                        <FluidCard 
                            title="Aceite Motor" 
                            stat={stats.motor} 
                            icon={Activity} 
                            color="orange" 
                            info={getStatusInfo(stats.motor.consumptionPer100h, 'MOTOR')}
                        />
                        <FluidCard 
                            title="Aceite Hidráulico" 
                            stat={stats.hydraulic} 
                            icon={Waves} 
                            color="amber" 
                            info={getStatusInfo(stats.hydraulic.consumptionPer100h, 'HYDRAULIC')}
                        />
                        <FluidCard 
                            title="Refrigerante Motor" 
                            stat={stats.coolant} 
                            icon={Thermometer} 
                            color="blue" 
                            info={getStatusInfo(stats.coolant.consumptionPer100h, 'COOLANT')}
                        />
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl shadow-xl relative overflow-hidden">
                        <Sparkles className="absolute -right-4 -top-4 w-32 h-32 text-white/5 rotate-12" />
                        <h4 className="text-white font-black uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={18} className="text-indigo-400" /> Diagnóstico de Ingeniería IA
                        </h4>
                        
                        {!aiAnalysis ? (
                            <button 
                                onClick={handleRunAiDiagnosis}
                                disabled={analyzing}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                                {analyzing ? 'Procesando Datos...' : 'Solicitar Análisis de Avería'}
                            </button>
                        ) : (
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 animate-in zoom-in-95 duration-300">
                                <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-line font-medium italic">
                                    {aiAnalysis}
                                </div>
                                <button 
                                    onClick={() => setAiAnalysis(null)}
                                    className="mt-4 text-[10px] text-indigo-300 font-bold uppercase underline"
                                >
                                    Cerrar Análisis
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b">
                            <h4 className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Últimas Reposiciones</h4>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {stats.history.map((log: OperationLog) => (
                                <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{log.hoursAtExecution}h</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(log.motorOil ?? 0) > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black">M: {log.motorOil}L</span>}
                                        {(log.hydraulicOil ?? 0) > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black">H: {log.hydraulicOil}L</span>}
                                        {(log.coolant ?? 0) > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black">R: {log.coolant}L</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <Activity size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione una unidad para monitorizar</p>
                </div>
            )}
        </div>
    );
};

const FluidCard = ({ title, stat, icon: Icon, color, info }: any) => {
    const isError = stat.logsCount < 2;
    const StatusIcon = info.icon;
    const barColor = info.color.replace('text', 'bg');

    return (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden ${isError ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-slate-50 ${info.color}`}>
                        <Icon size={18} />
                    </div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h5>
                </div>
                <div className={`text-[9px] font-black px-2 py-1 rounded-full border flex items-center gap-1 ${info.bg} ${info.color}`}>
                    <StatusIcon size={10} /> {info.label}
                </div>
            </div>

            {isError ? (
                <div className="text-[9px] text-slate-400 font-bold uppercase italic flex items-center gap-2">
                    <Info size={14}/> Datos insuficientes
                </div>
            ) : (
                <div className="space-y-3 relative z-10">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black ${info.color}`}>{stat.consumptionPer100h}</span>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase leading-none">L</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase">/100h</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Consumido</p>
                            <p className="text-xs font-black text-slate-700">{stat.consumedLiters.toFixed(1)} L</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Horas</p>
                            <p className="text-xs font-black text-slate-700">{stat.workedHours} h</p>
                        </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div 
                            className={`h-full transition-all duration-1000 ${barColor}`} 
                            style={{ width: `${Math.min((stat.consumptionPer100h / 1.5) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};
