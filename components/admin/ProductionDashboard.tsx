import React, { useEffect, useState, useCallback } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { updateCPReportAnalysis } from '../../services/db';
import { analyzeProductionReport } from '../../services/ai';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, AlertCircle, Sparkles, BrainCircuit, Search, Activity, Clock } from 'lucide-react';
import { CPDailyReport } from '../../types';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month, day] = selectedDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const data = await getProductionEfficiencyStats(dateObj);
            setStats(data);
        } catch (e) {
            console.error("Error loading stats:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleAnalyzeClick = async (report: CPDailyReport, efficiency: number) => {
        setAnalyzingId(report.id);
        try {
            const analysis = await analyzeProductionReport(
                report.comments || 'Sin comentarios registrados.',
                efficiency,
                new Date(report.date)
            );
            await updateCPReportAnalysis(report.id, analysis);
            await loadStats();
        } catch (error) {
            alert("Error al conectar con Gemini IA.");
        } finally {
            setAnalyzingId(null);
        }
    };

    const dailyReports = stats?.daily?.reports || [];
    const latestReport = dailyReports.length > 0 ? dailyReports[0] : null;
    const latestEfficiency = stats?.daily?.efficiency || 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-amber-600" /> Panel Eficiencia IA
                    </h2>
                </div>
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                {/* Selector de Fecha */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                            <Calendar size={12}/> Fecha del Informe
                        </label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-700 bg-slate-50"
                        />
                    </div>
                    <button 
                        onClick={loadStats}
                        disabled={loading}
                        className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3.5 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} 
                        <span className="font-bold uppercase text-xs tracking-widest">Consultar</span>
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                        <Activity className="animate-pulse mb-4 text-amber-500" size={48} />
                        <p className="font-black uppercase tracking-widest text-xs">Calculando indicadores...</p>
                    </div>
                ) : stats && (
                    <>
                        {/* Gerente Virtual Section */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden">
                            <BrainCircuit className="absolute -right-6 -bottom-6 w-32 h-32 text-white/5 rotate-12" />
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black text-indigo-300 flex items-center gap-2 uppercase text-[10px] tracking-widest">
                                        <Sparkles className="w-4 h-4" /> Gerente Virtual (IA)
                                    </h3>
                                    {latestReport && (
                                        latestReport.aiAnalysis ? (
                                            <span className="bg-green-500/20 text-green-400 text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-green-500/30">
                                                Auditado
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={() => handleAnalyzeClick(latestReport, latestEfficiency)}
                                                disabled={analyzingId === latestReport.id}
                                                className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-2 rounded-lg shadow-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {analyzingId === latestReport.id ? <RefreshCw className="animate-spin" size={12}/> : <BrainCircuit size={12} />}
                                                Analizar Incidencias
                                            </button>
                                        )
                                    )}
                                </div>

                                <div className="text-sm text-slate-200">
                                    {latestReport ? (
                                        latestReport.aiAnalysis ? (
                                            <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
                                                <div className="whitespace-pre-line text-xs leading-relaxed font-medium">
                                                    {latestReport.aiAnalysis}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-6 border border-dashed border-white/10 rounded-2xl text-slate-400 text-center text-xs italic">
                                                "Sin diagnóstico. Solicite el análisis para evaluar incidencias y eficiencia del día."
                                            </div>
                                        )
                                    ) : (
                                        <div className="p-6 text-slate-500 text-center text-xs font-bold uppercase">
                                            No hay reportes de producción en esta fecha.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Comparativas Temporales */}
                        <div className="grid grid-cols-1 gap-4">
                            <StatCard title="Eficiencia del Día" stat={stats.daily} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ComparisonCard title="Semana (vs Ant.)" data={stats.weekly} />
                                <ComparisonCard title="Mes (vs Ant.)" data={stats.monthly} />
                            </div>
                            <ComparisonCard title="Acumulado Anual" data={stats.yearly} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ title, stat }: { title: string, stat: any }) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${stat.efficiency >= 85 ? 'text-green-600' : stat.efficiency >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                    {stat.efficiency.toFixed(1)}%
                </span>
            </div>
        </div>
        <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1 text-[10px] font-black text-slate-700 uppercase">
                <Activity size={12} className="text-green-500"/> {stat.totalActualHours}h Reales
            </div>
            <div className="flex items-center justify-end gap-1 text-[10px] font-black text-slate-400 uppercase">
                <Clock size={12}/> {stat.totalPlannedHours}h Planificadas
            </div>
        </div>
    </div>
);

const ComparisonCard = ({ title, data }: { title: string, data: ProductionComparison }) => {
    const isPositive = data.diff >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border ${isPositive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    <Icon size={10} /> {data.diff > 0 ? '+' : ''}{data.diff}%
                </div>
            </div>
            <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-800">{data.current.efficiency.toFixed(1)}%</span>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Prev: {data.previous.efficiency.toFixed(1)}%</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Real: {data.current.totalActualHours}h</span>
                <span>Plan: {data.current.totalPlannedHours}h</span>
            </div>
        </div>
    );
};
