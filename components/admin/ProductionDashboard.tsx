import React, { useEffect, useState, useCallback } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { updateCPReportAnalysis } from '../../services/db';
import { analyzeProductionReport } from '../../services/ai';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, AlertCircle, Sparkles, BrainCircuit, Search } from 'lucide-react';
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
            const dateObj = new Date(selectedDate);
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
        setAnalyzingId(report.id);
        try {
            const analysis = await analyzeProductionReport(
                report.comments || 'Sin comentarios registrados.',
                efficiency,
                new Date(report.date)
            );
            await updateCPReportAnalysis(report.id, analysis);
            
            // Recargar datos para mostrar el nuevo análisis
            await loadStats();
        } catch (error) {
            alert("Error al analizar con IA");
        } finally {
            setAnalyzingId(null);
        }
    };

    // Obtener último reporte del día seleccionado para la sección "Gerente Virtual"
    const dailyReports = stats?.daily?.reports || [];
    const latestReport = dailyReports.length > 0 ? dailyReports[0] : null;
    const latestEfficiency = stats?.daily?.efficiency || 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center gap-2 sticky top-0 z-10">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-amber-600" /> Panel de Eficiencia IA
                </h2>
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                
                {/* Selector de Fecha */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                            <Calendar size={12}/> Fecha del Informe
                        </label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)} 
                                className="w-full p-3 pl-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-700 bg-slate-50"
                            />
                        </div>
                    </div>
                    <button 
                        onClick={loadStats}
                        disabled={loading}
                        className="w-full sm:w-auto bg-amber-600 text-white px-6 py-3 rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} 
                        <span className="font-bold">Consultar</span>
                    </button>
                </div>

                {/* Intro Card */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>Cálculo de eficiencia basado en horas de <strong>Molienda</strong> vs Planificación teórica. Los informes se sincronizan con <em>aridos@marraque.es</em>.</p>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <RefreshCw className="animate-spin mb-4 text-amber-500" size={40} />
                        <p className="font-black uppercase tracking-widest text-xs">Calculando Eficiencia...</p>
                    </div>
                ) : (
                    <>
                        {/* Gerente Virtual Section */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-md border border-indigo-100">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-black text-indigo-900 flex items-center gap-2 uppercase text-xs tracking-widest">
                                    <BrainCircuit className="w-6 h-6 text-indigo-600" /> Gerente Virtual (IA)
                                </h3>
                                {latestReport ? (
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
                                ) : null}
                            </div>

                            <div className="text-sm text-slate-700">
                                {latestReport ? (
                                    <>
                                        <p className="mb-3 text-slate-500 text-[10px] uppercase font-black">Partes de: {new Date(selectedDate).toLocaleDateString()}</p>
                                        {latestReport.aiAnalysis ? (
                                            <div className="prose prose-sm prose-indigo bg-white p-4 rounded-xl border border-indigo-100 shadow-inner">
                                                <div className="whitespace-pre-line text-xs font-medium leading-relaxed">{latestReport.aiAnalysis}</div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/50 p-6 rounded-xl border border-indigo-100 italic text-slate-400 text-center text-xs">
                                                "Sin análisis generado para este día. Solicita un análisis para obtener conclusiones técnicas."
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-white/50 p-6 rounded-xl border border-dashed border-slate-200 text-slate-400 text-center text-xs font-bold uppercase">
                                        No hay reportes registrados para la fecha seleccionada.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatCard title="Eficiencia del Día" stat={stats.daily} />
                            <ComparisonCard title="Eficiencia Semanal" data={stats.weekly} />
                            <ComparisonCard title="Eficiencia Mensual" data={stats.monthly} />
                            <ComparisonCard title="Eficiencia Anual" data={stats.yearly} />
                        </div>

                        {/* Recent Comments Section */}
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
                            <h3 className="font-black text-slate-800 mb-4 border-b pb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
                                <Calendar className="w-5 h-5 text-amber-500" /> Incidencias del Periodo
                            </h3>
                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                {stats.monthly.current.reports.slice().reverse().map((r: any) => (
                                    <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-amber-200 transition-all">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(r.date).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-black bg-white text-slate-600 px-2 py-1 rounded-full border border-slate-200">
                                                {r.millsEnd - r.millsStart}h Molienda
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 italic leading-relaxed">"{r.comments || 'Sin comentarios registrados.'}"</p>
                                        {!r.aiAnalysis && (
                                            <button 
                                                onClick={() => handleAnalyzeClick(r, 0)}
                                                disabled={analyzingId === r.id}
                                                className="mt-3 text-[10px] font-black text-indigo-600 uppercase hover:underline flex items-center gap-1"
                                            >
                                                <Sparkles size={12} /> {analyzingId === r.id ? 'Procesando...' : 'Analizar esta incidencia'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {stats.monthly.current.reports.length === 0 && (
                                    <div className="py-10 text-center flex flex-col items-center gap-2 opacity-40">
                                        <TrendingDown size={32}/>
                                        <p className="text-xs font-black uppercase">Sin registros en este mes</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ title, stat }: { title: string, stat: any }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-200 transition-all">
        <div className="flex justify-between items-start">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-full text-slate-500 uppercase">{stat.dateLabel}</span>
        </div>
        
        <div className="flex items-baseline mt-2">
            <span className={`text-3xl font-black ${getColor(stat.efficiency)}`}>
                {stat.efficiency.toFixed(1)}%
            </span>
            <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Eficiencia</span>
        </div>
        <div className="mt-3 text-[10px] font-bold text-slate-500 flex justify-between uppercase">
            <span>Real: <strong>{stat.totalActualHours}h</strong></span>
            <span className="text-slate-300">/</span>
            <span>Plan: <strong>{stat.totalPlannedHours}h</strong></span>
        </div>
    </div>
);

const ComparisonCard = ({ title, data }: { title: string, data: ProductionComparison }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-200 transition-all">
        <div className="flex justify-between items-start">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            <div className={`flex items-center text-[10px] font-black px-2 py-1 rounded-full border ${data.trend === 'up' ? 'bg-green-50 text-green-700 border-green-100' : data.trend === 'down' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                {data.trend === 'up' ? <TrendingUp size={12} className="mr-1"/> : data.trend === 'down' ? <TrendingDown size={12} className="mr-1"/> : null}
                {data.diff > 0 ? '+' : ''}{data.diff}%
            </div>
        </div>
        <div className="text-[10px] font-black text-amber-600/60 mt-1 mb-1 uppercase">{data.current.dateLabel}</div>
        
        <div className="flex items-baseline mt-1">
            <span className={`text-3xl font-black ${getColor(data.current.efficiency)}`}>
                {data.current.efficiency.toFixed(1)}%
            </span>
            <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase tracking-tighter">vs {data.previous.efficiency.toFixed(1)}% prev.</span>
        </div>
        
        <div className="mt-3 text-[10px] font-bold text-slate-500 mb-3 flex justify-between uppercase">
            <span>Real: <strong>{data.current.totalActualHours}h</strong></span>
            <span>Plan: <strong>{data.current.totalPlannedHours}h</strong></span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div 
                className={`h-1.5 rounded-full transition-all duration-1000 ${getColorBg(data.current.efficiency)}`} 
                style={{ width: `${Math.min(data.current.efficiency, 100)}%` }}
            ></div>
        </div>
    </div>
);

const getColor = (eff: number) => {
    if (eff >= 90) return 'text-green-600';
    if (eff >= 75) return 'text-amber-600';
    return 'text-red-600';
};

const getColorBg = (eff: number) => {
    if (eff >= 90) return 'bg-green-600';
    if (eff >= 75) return 'bg-amber-600';
    return 'bg-red-600';
};
