
import React, { useEffect, useState } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { updateCPReportAnalysis } from '../../services/db';
import { analyzeProductionReport } from '../../services/ai';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, AlertCircle, Sparkles, BrainCircuit } from 'lucide-react';
import { CPDailyReport } from '../../types';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await getProductionEfficiencyStats();
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeClick = async (report: CPDailyReport, efficiency: number) => {
        setAnalyzingId(report.id);
        try {
            const analysis = await analyzeProductionReport(
                report.comments || 'Sin comentarios registrados.',
                efficiency,
                report.date
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

    if (loading) return <div className="p-10 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-400" /></div>;
    if (!stats) return <div>Error cargando estadísticas</div>;

    // Obtener último reporte para la sección "Gerente Virtual"
    const reports = stats.monthly.current.reports;
    const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
    const latestEfficiency = stats.daily.efficiency;

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center gap-2 sticky top-0 z-10">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-amber-600" /> Informes de Producción
                </h2>
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                
                {/* Intro Card */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>Estos informes calculan la eficiencia basándose exclusivamente en las horas de <strong>Molienda</strong> vs Planificación. Se envían automáticamente a <em>aridos@marraque.es</em> según la frecuencia programada.</p>
                </div>

                {/* AI Manager Section */}
                {latestReport && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl shadow-md border border-indigo-100">
                         <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                <BrainCircuit className="w-6 h-6 text-indigo-600" /> Gerente Virtual (IA)
                            </h3>
                            {latestReport.aiAnalysis ? (
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded border border-green-200 flex items-center gap-1">
                                    <Sparkles size={12}/> Analizado
                                </span>
                            ) : (
                                <button 
                                    onClick={() => handleAnalyzeClick(latestReport, latestEfficiency)}
                                    disabled={analyzingId === latestReport.id}
                                    className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    {analyzingId === latestReport.id ? <RefreshCw className="animate-spin" size={14}/> : <Sparkles size={14} />}
                                    {analyzingId === latestReport.id ? 'Analizando...' : 'Solicitar Análisis'}
                                </button>
                            )}
                         </div>

                         <div className="text-sm text-slate-700">
                             <p className="mb-2 text-slate-500 text-xs uppercase font-bold">Último Reporte: {new Date(latestReport.date).toLocaleDateString()}</p>
                             
                             {latestReport.aiAnalysis ? (
                                 <div className="prose prose-sm prose-indigo bg-white p-4 rounded-lg border border-indigo-100">
                                     <div className="whitespace-pre-line">{latestReport.aiAnalysis}</div>
                                 </div>
                             ) : (
                                 <div className="bg-white/50 p-4 rounded-lg border border-indigo-100 italic text-slate-500 text-center">
                                     "Solicita un análisis para identificar causas raíz de baja eficiencia y obtener recomendaciones técnicas."
                                 </div>
                             )}
                         </div>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="Eficiencia Diaria" stat={stats.daily} />
                    <ComparisonCard title="Semanal" data={stats.weekly} />
                    <ComparisonCard title="Mensual" data={stats.monthly} />
                    <ComparisonCard title="Anual" data={stats.yearly} />
                </div>

                {/* Recent Comments Section */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                        <Calendar className="w-5 h-5" /> Comentarios Recientes
                    </h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {/* Combine reports from monthly view for comments list */}
                        {stats.monthly.current.reports.slice().reverse().map((r: any) => (
                            <div key={r.id} className="p-3 bg-slate-50 rounded border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-600">{new Date(r.date).toLocaleDateString()}</span>
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                        Efi: {r.millsEnd - r.millsStart}h Prod.
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 italic">"{r.comments || 'Sin comentarios'}"</p>
                                {/* Mini boton analizar si no tiene analysis */}
                                {!r.aiAnalysis && (
                                     <button 
                                        onClick={() => handleAnalyzeClick(r, 0)} // Eficiencia 0 approximation for list items
                                        disabled={analyzingId === r.id}
                                        className="mt-2 text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                                     >
                                         <Sparkles size={10} /> {analyzingId === r.id ? 'Analizando...' : 'Analizar Incidencia'}
                                     </button>
                                )}
                            </div>
                        ))}
                        {stats.monthly.current.reports.length === 0 && (
                            <p className="text-center text-slate-400 text-sm">No hay registros este mes.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, stat }: { title: string, stat: any }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start">
            <h4 className="text-sm font-medium text-slate-500 uppercase">{title}</h4>
            <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{stat.dateLabel}</span>
        </div>
        
        <div className="flex items-baseline mt-2">
            <span className={`text-3xl font-bold ${getColor(stat.efficiency)}`}>
                {stat.efficiency.toFixed(1)}%
            </span>
            <span className="ml-2 text-sm text-slate-400">Objetivo</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
            Real: <strong>{stat.totalActualHours}h</strong> / Plan: <strong>{stat.totalPlannedHours}h</strong>
        </div>
    </div>
);

const ComparisonCard = ({ title, data }: { title: string, data: ProductionComparison }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start">
            <h4 className="text-sm font-medium text-slate-500 uppercase">{title}</h4>
            <div className={`flex items-center text-xs font-bold px-2 py-1 rounded ${data.trend === 'up' ? 'bg-green-100 text-green-700' : data.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                {data.trend === 'up' ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
                {data.diff > 0 ? '+' : ''}{data.diff}%
            </div>
        </div>
        <div className="text-xs font-bold text-slate-400 mt-1 mb-1">{data.current.dateLabel}</div>
        
        <div className="flex items-baseline mt-1">
            <span className={`text-3xl font-bold ${getColor(data.current.efficiency)}`}>
                {data.current.efficiency.toFixed(1)}%
            </span>
            <span className="ml-2 text-sm text-slate-400">vs {data.previous.efficiency.toFixed(1)}%</span>
        </div>
        
        <div className="mt-2 text-xs text-slate-500 mb-2">
            Real: <strong>{data.current.totalActualHours}h</strong> / Plan: <strong>{data.current.totalPlannedHours}h</strong>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div 
                className={`h-1.5 rounded-full ${getColorBg(data.current.efficiency)}`} 
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

