
import React, { useEffect, useState, useCallback } from 'react';
import { getPerformanceDashboardStats, PerformanceDashboardData, ProductionComparison } from '../../services/stats';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, Activity, Target, BarChart3, Loader2, Minus } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<PerformanceDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month, day] = selectedDate.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const data = await getPerformanceDashboardStats(dateObj);
            setStats(data);
        } catch (e) {
            console.error("Error loading performance stats:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-amber-600" /> Rendimiento de Plantas
                    </h2>
                </div>
                <button onClick={loadStats} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                {/* Selector de Fecha de Análisis */}
                <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                            <Calendar size={12}/> Analizar desde fecha:
                        </label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-slate-700 bg-slate-50"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center text-slate-300">
                        <Loader2 className="animate-spin mb-4 text-amber-500" size={48} />
                        <p className="font-black uppercase tracking-widest text-[10px]">Calculando KPIs de Trituración...</p>
                    </div>
                ) : stats && (
                    <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        
                        <PerformanceCard 
                            title="Rendimiento Hoy" 
                            data={stats.daily} 
                            color="bg-amber-500"
                            info={`Comparado con ayer (${stats.daily.previous.efficiency}%)`}
                        />

                        <PerformanceCard 
                            title="Rendimiento Semanal" 
                            data={stats.weekly} 
                            color="bg-blue-600"
                            info={`Semana actual vs anterior (${stats.weekly.previous.efficiency}%)`}
                        />

                        <PerformanceCard 
                            title="Rendimiento Mensual" 
                            data={stats.monthly} 
                            color="bg-indigo-600"
                            info={`Mes actual vs anterior (${stats.monthly.previous.efficiency}%)`}
                        />

                        <PerformanceCard 
                            title="Rendimiento Anual" 
                            data={stats.yearly} 
                            color="bg-slate-800"
                            info={`Año actual vs anterior (${stats.yearly.previous.efficiency}%)`}
                        />

                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-2">
                            <p className="text-[10px] text-amber-800 leading-relaxed italic">
                                * El rendimiento se calcula dividiendo las horas reales de **Molinos / Planta** entre las **Horas Planificadas** en el calendario de producción para Cantera Pura.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface CardProps {
    title: string;
    data: ProductionComparison;
    color: string;
    info: string;
}

const PerformanceCard: React.FC<CardProps> = ({ title, data, color, info }) => {
    const isUp = data.trend === 'up';
    const isDown = data.trend === 'down';
    const eff = data.current.efficiency;

    return (
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-xl transition-all">
            <div className="p-5 flex justify-between items-center">
                <div className="flex-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color}`}></span>
                        {title}
                    </h4>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-black ${eff >= 85 ? 'text-green-600' : eff >= 60 ? 'text-slate-800' : 'text-red-600'}`}>
                            {eff.toFixed(1)}%
                        </span>
                        
                        <div className={`flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border ${
                            isUp ? 'bg-green-50 text-green-700 border-green-100' : 
                            isDown ? 'bg-red-50 text-red-700 border-red-100' : 
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                            {isUp && <TrendingUp size={12} />}
                            {isDown && <TrendingDown size={12} />}
                            {!isUp && !isDown && <Minus size={12} />}
                            {data.diff > 0 ? '+' : ''}{data.diff}%
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">{info}</p>
                </div>

                <div className="text-right space-y-2 border-l pl-5">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Real</span>
                        <div className="flex items-center gap-1 text-slate-700 font-mono font-bold text-xs">
                             <Activity size={10} className="text-blue-500"/> {data.current.totalActualHours}h
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Plan</span>
                        <div className="flex items-center gap-1 text-slate-400 font-mono font-bold text-xs">
                             <Target size={10}/> {data.current.totalPlannedHours}h
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="h-1.5 w-full bg-slate-50 relative">
                <div 
                    className={`h-full transition-all duration-1000 ${eff >= 85 ? 'bg-green-500' : eff >= 60 ? 'bg-blue-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(eff, 100)}%` }}
                ></div>
            </div>
        </div>
    );
};
