
import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getCostCenters, getSubCentersByCenter } from '../../services/db';
import { getMachineFluidStats, formatDecimal } from '../../services/stats';
import { generateFluidReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, SubCenter } from '../../types';
import { 
    ArrowLeft, Loader2, AlertTriangle, Truck, Activity,
    Thermometer, ShieldCheck, Waves, TrendingUp, TrendingDown,
    History, Table, Send, LayoutGrid
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
    const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
    const [selectedSubId, setSelectedSubId] = useState('');
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            const [centers, machines] = await Promise.all([
                getCostCenters(),
                getAllMachines(false)
            ]);
            
            const mobileCenter = centers.find(c => c.name.toLowerCase().includes('móvil') || c.name.toLowerCase().includes('movil'));
            if (mobileCenter) {
                const subs = await getSubCentersByCenter(mobileCenter.id);
                setSubCenters(subs);
            }
            setAllMachines(machines);
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedSubId) {
            setFilteredMachines(allMachines.filter(m => m.subCenterId === selectedSubId));
            setSelectedMachineId('');
            setStats(null);
        } else {
            setFilteredMachines([]);
        }
    }, [selectedSubId, allMachines]);

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
        if (sending) return;
        if (!confirm(`¿Enviar informe integral de fluidos de TODA la flota a aridos@marraque.es?`)) return;

        setSending(true);
        try {
            const period = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            
            const mobileMachines = allMachines.filter(m => m.companyCode); // Filtro básico para maquinaria con código
            const consolidatedData = [];

            for (const m of mobileMachines) {
                const mStats = await getMachineFluidStats(m.id);
                if (mStats.motor.logsCount > 1 || mStats.hydraulic.logsCount > 1) {
                    consolidatedData.push({ machine: m, stats: mStats });
                }
            }

            if (consolidatedData.length === 0) {
                alert("No hay suficientes datos históricos para generar un informe consolidado.");
                return;
            }

            const pdfBase64 = generateFluidReportPDF(consolidatedData, period);
            
            await sendEmail(
                ['aridos@marraque.es'],
                `Informe Integral Fluidos - ${period}`,
                `<p>Se adjunta el análisis técnico de consumo de fluidos consolidado de la maquinaria.</p>`,
                pdfBase64,
                `Informe_Integral_Fluidos_${period}.pdf`
            );
            alert("Informe integral enviado correctamente.");
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
                            Análisis Técnico de Tasas L/100h
                        </p>
                    </div>
                </div>
                <button 
                    onClick={handleSendReport}
                    disabled={sending}
                    className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                    title="Enviar Informe Integral Flota"
                >
                    {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                </button>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 mx-1 space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                        <LayoutGrid size={12}/> 1. Subcentro / Sección
                    </label>
                    <select 
                        value={selectedSubId}
                        onChange={e => setSelectedSubId(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700"
                    >
                        <option value="">-- Seleccionar Planta --</option>
                        {subCenters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                        <Truck size={12}/> 2. Máquina Específica
                    </label>
                    <select 
                        disabled={!selectedSubId}
                        value={selectedMachineId}
                        onChange={e => setSelectedMachineId(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700 disabled:opacity-50"
                    >
                        <option value="">-- Seleccionar Unidad --</option>
                        {filteredMachines.map(m => (
                            <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-black uppercase tracking-widest text-[10px]">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
                    Calculando derivadas de consumo...
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="grid grid-cols-1 gap-4">
                        <TrendCard title="Aceite Motor" stat={stats.motor} icon={Activity} />
                        <TrendCard title="Aceite Hidráulico" stat={stats.hydraulic} icon={Waves} />
                        <TrendCard title="Refrigerante" stat={stats.coolant} icon={Thermometer} />
                    </div>

                    {/* Tabla de Evolución Técnica para el Ingeniero */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-900 border-b flex justify-between items-center">
                            <h4 className="font-black text-white uppercase text-[10px] tracking-widest flex items-center gap-2">
                                <Table size={14} className="text-amber-500"/> Tabla de Evolución (L/100h)
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b">
                                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Fecha</th>
                                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase">Horas</th>
                                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center">Motor</th>
                                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center">Hidr.</th>
                                        <th className="p-3 text-[9px] font-black text-slate-400 uppercase text-center">Refrig.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.history.slice(0, 8).map((log: any) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                            <td className="p-3 text-[10px] font-bold text-slate-600">{new Date(log.date).toLocaleDateString()}</td>
                                            <td className="p-3 text-[10px] font-mono font-bold text-slate-800">{log.hoursAtExecution}h</td>
                                            <td className="p-3 text-[10px] text-center">{log.motorOil ? <span className="font-black text-amber-600">{log.motorOil}L</span> : '-'}</td>
                                            <td className="p-3 text-[10px] text-center">{log.hydraulicOil ? <span className="font-black text-blue-600">{log.hydraulicOil}L</span> : '-'}</td>
                                            <td className="p-3 text-[10px] text-center">{log.coolant ? <span className="font-black text-teal-600">{log.coolant}L</span> : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-black text-slate-400 uppercase text-[9px] tracking-widest flex items-center gap-1 mb-2">
                            <History size={12}/> Interpretación Técnica
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            Los valores L/100h se calculan comparando el suministro actual con el anterior y las horas transcurridas entre ambos puntos. Una desviación positiva sostenida indica una posible fuga o consumo interno del componente.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <Activity size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione un subcentro y unidad</p>
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

            {!isError && (
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
