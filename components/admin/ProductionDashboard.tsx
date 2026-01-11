
import React, { useEffect, useState, useCallback } from 'react';
import { getProductionEfficiencyStats, ProductionComparison } from '../../services/stats';
import { generateCPReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Calendar, Search, Activity, Clock, AlertCircle, Send, Loader2 } from 'lucide-react';
import { CPDailyReport } from '../../types';

interface Props {
    onBack: () => void;
}

export const ProductionDashboard: React.FC<Props> = ({ onBack }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

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

    const handleSendEmail = async () => {
        if (!stats?.daily?.reports?.length) return;
        
        if (!confirm("¿Enviar auditoría de producción de hoy a aridos@marraque.es?")) return;

        setSending(true);
        try {
            const report = stats.daily.reports[0];
            const pdfBase64 = generateCPReportPDF(report, "Sistema", stats.daily.totalPlannedHours, stats.daily.efficiency);
            
            await sendEmail(
                ['aridos@marraque.es'],
                `Auditoría de Eficiencia Producción - ${new Date(report.date).toLocaleDateString()}`,
                `<p>Se adjunta el análisis de eficiencia del día <strong>${new Date(report.date).toLocaleDateString()}</strong>.</p>
                 <p>Eficiencia real: <strong>${stats.daily.efficiency.toFixed(1)}%</strong></p>`,
                pdfBase64,
                `Auditoria_Produccion_${selectedDate}.pdf`
            );
            alert("Informe enviado.");
        } catch (e) {
            alert("Error al enviar.");
        } finally {
            setSending(false);
        }
    };

    const dailyReports = stats?.daily?.reports || [];

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-amber-600" /> Auditoría de Eficiencia
                    </h2>
                </div>
                {stats && dailyReports.length > 0 && (
                    <button 
                        onClick={handleSendEmail}
                        disabled={sending}
                        className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                )}
            </div>

            <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
                {/* Selector de Fecha */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                            <Calendar size={12}/> Fecha del Parte
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
                        <span className="font-bold uppercase text-xs tracking-widest">Analizar</span>
                    </button>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                        <Activity className="animate-pulse mb-4 text-amber-500" size={48} />
                        <p className="font-black uppercase tracking-widest text-xs">Calculando indicadores...</p>
                    </div>
                ) : stats && (
                    <>
                        {/* Resumen de Incidencias Técnicas Manuales */}
                        <div className="bg-slate-800 p-6 rounded-3xl shadow-xl border border-white/10 relative overflow-hidden">
                            <h3 className="font-black text-amber-400 flex items-center gap-2 uppercase text-[10px] tracking-widest mb-4">
                                <AlertCircle className="w-4 h-4" /> Observaciones de Planta
                            </h3>
                            <div className="space-y-4">
                                {dailyReports.length > 0 ? dailyReports.map((r: CPDailyReport) => (
                                    <div key={r.id} className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Día {new Date(r.date).toLocaleDateString()}</p>
                                        <p className="text-slate-200 text-sm italic">"{r.comments || 'Sin incidencias reportadas.'}"</p>
                                    </div>
                                )) : (
                                    <p className="text-slate-500 text-xs text-center py-4 italic">No hay reportes de producción registrados para esta fecha.</p>
                                )}
                            </div>
                        </div>

                        {/* Comparativas Temporales */}
                        <div className="grid grid-cols-1 gap-4">
                            <StatCard title="Eficiencia Diaria" stat={stats.daily} />
                            <ComparisonCard title="Semana Actual" data={stats.weekly} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ title, stat }: { title: string, stat: any }) => (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
        <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${stat.efficiency >= 85 ? 'text-green-600' : stat.efficiency >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                    {stat.efficiency.toFixed(1)}%
                </span>
            </div>
        </div>
        <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1 text-[11px] font-black text-slate-700 uppercase">
                <Activity size={12} className="text-green-500"/> {stat.totalActualHours}h Reales
            </div>
            <div className="flex items-center justify-end gap-1 text-[11px] font-black text-slate-400 uppercase">
                <Clock size={12}/> {stat.totalPlannedHours}h Plan
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
            </div>
        </div>
    );
};
