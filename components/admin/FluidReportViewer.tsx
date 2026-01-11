
import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getCostCenters } from '../../services/db';
import { getMachineFluidStats, formatDecimal } from '../../services/stats';
import { generateFluidReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog } from '../../types';
import { 
    ArrowLeft, Loader2, AlertTriangle, Truck, Activity,
    Thermometer, ShieldCheck, Waves, TrendingUp, TrendingDown, Minus,
    History, BarChart2, Send
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
    const [sending, setSending] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
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

    const loadStats = useCallback(async () => {
        if (!selectedMachineId) return;
        setLoading(true);
        try {
            const data = await getMachineFluidStats(selectedMachineId);
            setStats(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedMachineId]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSendReport = async () => {
        if (!selectedMachineId || !stats) return;
        const m = machines.find(mac => mac.id === selectedMachineId);
        if (!m) return;

        if (!confirm(`¿Enviar informe técnico de fluidos de [${m.companyCode || m.name}] a aridos@marraque.es?`)) return;

        setSending(true);
        try {
            const period = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            const pdfBase64 = generateFluidReportPDF([{ machine: m, stats, aiAnalysis: '' }], period);
            
            await sendEmail(
                ['aridos@marraque.es'],
                `Informe Técnico Fluidos - ${m.companyCode || m.name} - ${period}`,
                `<p>Se adjunta el análisis técnico de consumo de fluidos (L/100h) para la unidad <strong>${m.name}</strong>.</p>`,
                pdfBase64,
                `Fluidos_${m.companyCode || 'Unidad'}_${period}.pdf`
            );
            alert("Informe enviado correctamente.");
        } catch (e) {
            alert("Error al enviar el informe.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Monitor de Fluidos</h3>
                        <p className="text-[10px] font-black text-indigo-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            Control técnico de consumo L/100h
                        </p>
                    </div>
                </div>
                {stats && (
                    <button 
                        onClick={handleSendReport}
                        disabled={sending}
                        className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg flex items-center gap-2"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                    <Truck size={12}/> Seleccionar Máquina
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
                    Procesando registros históricos...
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="grid grid-cols-1 gap-4">
                        <TrendCard title="Aceite Motor" stat={stats.motor} icon={Activity} />
                        <TrendCard title="Aceite Hidráulico" stat={stats.hydraulic} icon={Waves} />
                        <TrendCard title="Refrigerante" stat={stats.coolant} icon={Thermometer} />
                    </div>

                    {/* Histograma de Barras: Se muestra si hay al menos 1 punto de serie */}
                    <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-white/10">
                        <h4 className="text-white font-black uppercase text-[10px] tracking-widest mb-8 flex items-center gap-2">
                            <BarChart2 size={16} className="text-amber-500" /> Auditoría de Ruptura (Litros / 100 Horas)
                        </h4>
                        
                        <div className="space-y-12">
                            {['motor', 'hydraulic', 'coolant'].map(key => {
                                const s = stats[key];
                                if (s.series.length === 0) return null;
                                
                                const maxRate = Math.max(...s.series.map((p: any) => p.rate), s.baselineRate, 0.1);

                                return (
                                    <div key={key} className="space-y-3">
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${key === 'motor' ? 'bg-amber-500' : key === 'hydraulic' ? 'bg-blue-500' : 'bg-teal-500'}`}></div>
                                                Evolución {key === 'motor' ? 'Aceite Motor' : key === 'hydraulic' ? 'Aceite Hidráulico' : 'Refrigerante'}
                                            </span>
                                            {s.deviation > 25 && <span className="text-red-500 animate-pulse">ALERTA: +{s.deviation}%</span>}
                                        </div>
                                        
                                        <div className="flex items-end gap-1.5 h-36 pt-4 border-b border-white/5 pb-2">
                                            {s.series.map((point: any, idx: number) => {
                                                const heightPercent = Math.max((point.rate / maxRate) * 100, 4); // Min 4% para visibilidad
                                                return (
                                                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                                        {/* Tooltip */}
                                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-slate-900 text-[8px] font-black px-2 py-1 rounded shadow-xl z-20 pointer-events-none whitespace-nowrap">
                                                            {point.rate.toFixed(3)} L/100h
                                                        </div>
                                                        
                                                        {/* Barra */}
                                                        <div 
                                                            style={{ height: `${heightPercent}%` }}
                                                            className={`w-full rounded-t-md transition-all duration-700 ${
                                                                point.rate > s.baselineRate * 1.25 ? 'bg-red-500' : 
                                                                key === 'motor' ? 'bg-amber-500/80' : 
                                                                key === 'hydraulic' ? 'bg-blue-500/80' : 'bg-teal-500/80'
                                                            }`}
                                                        ></div>
                                                        <span className="text-[7px] text-slate-500 font-bold mt-2 rotate-45 origin-left whitespace-nowrap">{point.date}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between items-center text-[8px] font-black text-slate-500 uppercase mt-8">
                                            <span>Media Base: {s.baselineRate.toFixed(3)}</span>
                                            <span className={s.deviation > 25 ? 'text-red-500' : 'text-slate-400'}>Actual: {s.recentRate.toFixed(3)} L/100h</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b">
                            <h4 className="font-black text-slate-500 uppercase text-[10px] tracking-widest flex items-center gap-1">
                                <History size={14}/> Registros de niveles
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
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione una unidad</p>
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
                    <Minus size={14}/> Datos insuficientes
                </div>
            ) : (
                <div className="space-y-4 relative z-10">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Tasa Reciente</p>
                            <span className={`text-3xl font-black ${info.color}`}>{formatDecimal(stat.recentRate)}</span>
                            <span className="ml-1 text-[10px] font-bold text-slate-400">L/100h</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Desviación</p>
                            <span className={`text-xl font-black ${info.color}`}>
                                {stat.deviation > 0 ? '+' : ''}{formatDecimal(stat.deviation, 1)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
