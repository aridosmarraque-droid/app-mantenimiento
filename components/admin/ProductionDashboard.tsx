import React, { useEffect, useState, useCallback } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { updateCPReportAnalysis } from '../../services/db';
import { analyzeProductionReport } from '../../services/ai';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, AlertCircle, Sparkles, BrainCircuit, Search, Key } from 'lucide-react';
import { CPDailyReport } from '../../types';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            // @ts-ignore
            const selected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(selected);
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
    };

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month, day] = selectedDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const data = await getProductionEfficiencyStats(dateObj);
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleAnalyzeClick = async (report: CPDailyReport, efficiency: number) => {
        if (!hasApiKey) {
            alert("Seleccione una API Key para usar la IA.");
            handleSelectKey();
            return;
        }
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
            alert("Error al analizar con IA");
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
                {!hasApiKey && (
                    <button onClick={handleSelectKey} className="bg-amber-100 text-amber-700 p-2 rounded-lg border border-amber-200 animate-pulse">
                        <Key size={18}/>
                    </button>
                )}
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
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
                        className="w-full sm:w-auto bg-amber-600 text-white px-6 py-3 rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} 
                        <span className="font-bold">Consultar</span>
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <RefreshCw className="animate-spin mb-4 text-amber-500" size={40} />
                        <p className="font-black uppercase tracking-widest text-xs">Calculando Eficiencia...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-md border border-indigo-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-black text-indigo-900 flex items-center gap-2 uppercase text-xs tracking-widest">
                                    <BrainCircuit className="w-6 h-6 text-indigo-600" /> Gerente Virtual (IA)
                                </h3>
                                {latestReport && (
                                    latestReport.aiAnalysis ? (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-full border border-green-200 flex items-center gap-1">
                                            <Sparkles size={12}/> Analizado
                                        </span>
                                    ) : (
                                        <button 
                                            onClick={() => handleAnalyzeClick(latestReport, latestEfficiency)}
                                            disabled={analyzingId === latestReport.id}
                                            className="bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-2 rounded-lg shadow-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-all"
                                        >
                                            {analyzingId === latestReport.id ? <RefreshCw className="animate-spin" size={14}/> : <Sparkles size={14} />}
                                            Analizar Día
                                        </button>
                                    )
                                )}
                            </div>

                            <div className="text-sm text-slate-700">
                                {latestReport ? (
                                    <>
                                        <p className="mb-3 text-slate-500 text-[10px] uppercase font-black">Partes de: {new Date(latestReport.date).toLocaleDateString()}</p>
                                        {latestReport.aiAnalysis ? (
                                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-inner">
                                                <div className="whitespace-pre-line text-xs font-medium leading-relaxed">{latestReport.aiAnalysis}</div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/50 p-6 rounded-xl border border-indigo-100 italic text-slate-400 text-center text-xs">
                                                "Solicite un análisis para obtener conclusiones técnicas."
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-white/50 p-6 rounded-xl border border-dashed border-slate-200 text-slate-400 text-center text-xs font-bold uppercase">
                                        No hay reportes hoy.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatCard title="Eficiencia del Día" stat={stats.daily} />
                            <ComparisonCard title="Eficiencia Semanal" data={stats.weekly} />
                            <ComparisonCard title="Eficiencia Mensual" data={stats.monthly} />
                            <ComparisonCard title="Eficiencia Anual" data={stats.yearly} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ title, stat }: { title: string, stat: any }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-full text-slate-500 uppercase">{stat.dateLabel}</span>
        </div>
        <div className="flex items-baseline mt-2">
            <span className={`text-3xl font-black ${stat.efficiency >= 85 ? 'text-green-600' : 'text-amber-600'}`}>
                {stat.efficiency.toFixed(1)}%
            </span>
        </div>
    </div>
);

const ComparisonCard = ({ title, data }: { title: string, data: ProductionComparison }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            <div className={`flex items-center text-[10px] font-black px-2 py-1 rounded-full border ${data.trend === 'up' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                {data.diff > 0 ? '+' : ''}{data.diff}%
            </div>
        </div>
        <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-slate-800">{data.current.efficiency.toFixed(1)}%</span>
            <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase tracking-tighter">vs {data.previous.efficiency.toFixed(1)}%</span>
        </div>
    </div>
);
