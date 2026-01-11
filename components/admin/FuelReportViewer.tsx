
import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getFuelLogs, getCostCenters, getSubCentersByCenter } from '../../services/db';
import { calculateFuelConsumptionFromLogs, getMachineFuelStats, formatDecimal } from '../../services/stats';
import { generateFuelReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog, SubCenter } from '../../types';
import { 
    ArrowLeft, Fuel, Calendar, TrendingUp, Search, Loader2, 
    Send, Truck, BarChart3, AlertTriangle, Mail, RefreshCw, Clock, Info, LayoutGrid, ArrowUpRight
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const FuelReportViewer: React.FC<Props> = ({ onBack }) => {
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
            const data = await getMachineFuelStats(selectedMachineId);
            setStats(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedMachineId]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSendMonthlyReport = async () => {
        if (!confirm("¿Enviar informe integral de Gasoil (Semafórico) de TODA la flota a aridos@marraque.es?")) return;

        setSending(true);
        try {
            const now = new Date();
            const periodName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            
            const mobileMachines = allMachines.filter(m => m.companyCode);
            const consolidatedData = [];

            for (const m of mobileMachines) {
                const mStats = await getMachineFuelStats(m.id);
                if (mStats.yearly.logsCount > 0) {
                    consolidatedData.push({ machine: m, stats: mStats });
                }
            }

            if (consolidatedData.length === 0) {
                alert("Sin datos suficientes.");
                setSending(false);
                return;
            }

            const pdfBase64 = generateFuelReportPDF(consolidatedData, periodName);
            await sendEmail(
                ['aridos@marraque.es'],
                `Auditoría Consumo Gasoil - ${periodName}`,
                `<p>Análisis semafórico de consumo de combustible. Naranja >10%, Rojo >25% sobre media anual.</p>`,
                pdfBase64,
                `Gasoil_Auditoria_${periodName.replace(/\s+/g, '_')}.pdf`
            );

            alert("Informe integral enviado con éxito.");
        } catch (e) {
            alert("Error al generar el informe.");
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
                        <h3 className="text-xl font-bold text-slate-800 leading-none tracking-tight">Auditoría Gasoil</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase mt-1 tracking-widest">Semáforo de Consumo</p>
                    </div>
                </div>
                <button 
                    onClick={handleSendMonthlyReport}
                    disabled={sending}
                    className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
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
                        <option value="">-- Seleccionar Sección --</option>
                        {subCenters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                        <Truck size={12}/> 2. Unidad
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
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
                    Analizando promedios anuales...
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className={`p-6 rounded-2xl shadow-lg relative overflow-hidden transition-colors duration-500 ${
                        stats.fuelDeviation >= 25 ? 'bg-red-600' : 
                        stats.fuelDeviation >= 10 ? 'bg-orange-500' : 'bg-blue-600'
                    } text-white`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-black uppercase text-[10px] tracking-widest opacity-80 mb-2">Desviación vs Año</h4>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black">{stats.fuelDeviation > 0 ? '+' : ''}{stats.fuelDeviation.toFixed(1)}%</span>
                                    <ArrowUpRight size={24} className={stats.fuelDeviation > 10 ? 'animate-bounce' : 'opacity-40'} />
                                </div>
                            </div>
                            {stats.fuelDeviation >= 10 && (
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                                    <AlertTriangle size={32} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <ComparisonCard title="Consumo Mes Actual" stat={stats.monthly} isMain={true} dev={stats.fuelDeviation} />
                        <ComparisonCard title="Media Anual (Referencia)" stat={stats.yearly} isMain={false} dev={0} />
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h4 className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Suministros Registrados</h4>
                        </div>
                        <div className="divide-y max-h-80 overflow-y-auto">
                            {stats.logs.map((log: OperationLog) => (
                                <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{log.hoursAtExecution}h</p>
                                    </div>
                                    <div className="text-lg font-black text-green-600">+{formatDecimal(log.fuelLitres || 0, 1)}L</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                    <BarChart3 size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Filtre para iniciar auditoría</p>
                </div>
            )}
        </div>
    );
};

const ComparisonCard = ({ title, stat, isMain, dev }: any) => {
    const isError = stat.logsCount < 2;
    
    // Colores de borde y texto dinámicos para el "Mes Actual"
    const getStyles = () => {
        if (!isMain) return 'border-slate-100 bg-white';
        if (dev >= 25) return 'border-red-200 bg-red-50';
        if (dev >= 10) return 'border-orange-200 bg-orange-50';
        return 'border-green-100 bg-green-50';
    };

    const getTextColor = () => {
        if (!isMain) return 'text-slate-800';
        if (dev >= 25) return 'text-red-700';
        if (dev >= 10) return 'text-orange-700';
        return 'text-green-700';
    };

    return (
        <div className={`p-5 rounded-2xl shadow-sm border-2 transition-all ${getStyles()} ${isError ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start mb-3">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h5>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white border text-slate-400 uppercase shadow-sm">
                    {stat.logsCount} Puntos
                </span>
            </div>

            {isError ? (
                <div className="text-[9px] text-red-400 font-black uppercase italic flex items-center gap-1">
                    <AlertTriangle size={12}/> Historial insuficiente
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black ${getTextColor()}`}>{formatDecimal(stat.consumptionPerHour, 2)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">L/h</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200/50">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Suministrado</p>
                            <p className={`text-xs font-black ${isMain ? getTextColor() : 'text-slate-600'}`}>{formatDecimal(stat.consumedLiters, 1)} L</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Horas Trabajo</p>
                            <p className={`text-xs font-black ${isMain ? getTextColor() : 'text-slate-600'}`}>{stat.workedHours} h</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
