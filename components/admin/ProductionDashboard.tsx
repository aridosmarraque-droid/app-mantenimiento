
import React, { useEffect, useState } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, Minus } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="p-10 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-400" /></div>;
    if (!stats) return <div>Error cargando estadísticas</div>;

    // Get last 5 comments from all reports (using monthly current reports as source)
    const recentReports = stats.monthly.current.reports
        .slice()
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center gap-2 sticky top-0 z-10">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-amber-600" /> Producción (Molinos)
                </h2>
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="Eficiencia Último Parte" stat={stats.daily} />
                    <ComparisonCard title="Semanal (Acumulado)" data={stats.weekly} />
                    <ComparisonCard title="Mensual (Acumulado)" data={stats.monthly} />
                    <ComparisonCard title="Anual (Acumulado)" data={stats.yearly} />
                </div>

                {/* Recent Comments Section */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                        <Calendar className="w-5 h-5" /> Últimos Comentarios
                    </h3>
                    <div className="space-y-4">
                        {recentReports.map((r: any) => (
                            <div key={r.id} className="p-3 bg-slate-50 rounded border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-600">{new Date(r.date).toLocaleDateString()}</span>
                                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                        Molinos: {r.millsEnd - r.millsStart}h
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 italic">"{r.comments || 'Sin comentarios'}"</p>
                            </div>
                        ))}
                        {recentReports.length === 0 && (
                            <p className="text-center text-slate-400 text-sm">No hay registros recientes.</p>
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
            Real (Molinos): <strong>{stat.totalActualHours}h</strong> / Plan: <strong>{stat.totalPlannedHours}h</strong>
        </div>
    </div>
);

const ComparisonCard = ({ title, data }: { title: string, data: ProductionComparison }) => {
    // Lógica para determinar color e icono basado en +-5%
    const getBadgeStyle = (diff: number) => {
        if (diff > 5) return { color: 'bg-green-100 text-green-700', Icon: TrendingUp };
        if (diff < -5) return { color: 'bg-red-100 text-red-700', Icon: TrendingDown };
        
        // Rango neutro (-5 a 5) -> Naranja
        let Icon = Minus;
        if (diff > 0) Icon = TrendingUp;
        if (diff < 0) Icon = TrendingDown;
        
        return { color: 'bg-orange-100 text-orange-700', Icon };
    };

    const { color, Icon } = getBadgeStyle(data.diff);

    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-slate-500 uppercase">{title}</h4>
                <div className={`flex items-center text-xs font-bold px-2 py-1 rounded ${color}`}>
                    <Icon size={14} className="mr-1"/>
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
                Real (Molinos): <strong>{data.current.totalActualHours}h</strong> / Plan: <strong>{data.current.totalPlannedHours}h</strong>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div 
                    className={`h-1.5 rounded-full ${getColorBg(data.current.efficiency)}`} 
                    style={{ width: `${Math.min(data.current.efficiency, 100)}%` }}
                ></div>
            </div>
        </div>
    );
};

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
