import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getFuelLogs, getCostCenters } from '../../services/db';
import { calculateFuelConsumptionFromLogs, getMachineFuelStats } from '../../services/stats';
import { generateFuelReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog, CostCenter } from '../../types';
import { 
    ArrowLeft, Fuel, Calendar, TrendingUp, Search, Loader2, 
    FileText, Send, CheckCircle2, AlertTriangle, Truck,
    BarChart3, Info, Download, Mail
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const FuelReportViewer: React.FC<Props> = ({ onBack }) => {
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

            // Filtrar estrictamente por el nombre del centro "Maquinaria Móvil"
            const mobileCenter = centers.find(c => {
                const name = c.name.toLowerCase();
                return name.includes('móvil') || name.includes('movil') || name.includes('maquinaria movil');
            });
            
            if (mobileCenter) {
                const filtered = machines.filter(m => m.costCenterId === mobileCenter.id);
                setFilteredMachines(filtered);
            } else {
                setFilteredMachines(machines.filter(m => m.companyCode));
            }
        };

        loadInitialData();
    }, []);

    const loadStats = useCallback(async () => {
        if (!selectedMachineId) return;
        setLoading(true);
        try {
            const data = await getMachineFuelStats(selectedMachineId);
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedMachineId]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleSendMonthlyReport = async () => {
        if (!confirm("Se generará el informe de Maquinaria Móvil y se enviará a aridos@marraque.es. ¿Continuar?")) return;
        setSending(true);
        try {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const periodName = lastMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            
            const consolidatedData = [];
            for (const m of filteredMachines) {
                const machineStats = await getMachineFuelStats(m.id);
                if (machineStats.yearly.logsCount > 0) {
                    consolidatedData.push({ machine: m, stats: machineStats });
                }
            }

            if (consolidatedData.length === 0) {
                alert("No hay datos de consumo para procesar.");
                setSending(false);
                return;
            }

            const pdfBase64 = generateFuelReportPDF(consolidatedData, periodName);
            const res = await sendEmail(
                ['aridos@marraque.es'], // Email corregido
                `Informe Mensual Consumos - ${periodName}`,
                `<p>Adjuntamos informe de eficiencia de la <strong>Maquinaria Móvil</strong> para ${periodName}.</p>`,
                pdfBase64,
                `Consumos_${periodName.replace(/\s+/g, '_')}.pdf`
            );

            if (res.success) alert("Informe enviado a aridos@marraque.es");
            else alert("Error en el envío. Verifique la conexión.");
        } catch (e) {
            alert("Error generando documento.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Control de Gasoil</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase mt-1 tracking-widest">Maquinaria Móvil</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1 space-y-5">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                        <Truck size={12}/> 1. Máquina (Centro de Coste Móvil)
                    </label>
                    <select 
                        value={selectedMachineId}
                        onChange={e => setSelectedMachineId(e.target.value)}
                        className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Seleccionar Unidad --</option>
                        {filteredMachines.map(m => (
                            <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <button 
                        onClick={handleSendMonthlyReport}
                        disabled={sending}
                        className="w-full bg-slate-900 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        {sending ? 'Preparando...' : 'Enviar Informe a aridos@marraque.es'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
                    <p className="font-black uppercase tracking-widest text-[10px]">Cargando todos los registros...</p>
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <BarChart3 className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
                        <h4 className="font-black uppercase text-[10px] tracking-widest opacity-80 mb-2">Consumo Actual</h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black">{stats.monthly.consumptionPerHour}</span>
                            <span className="text-xl font-bold opacity-80">L/h</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <ComparisonCard title="Consumo Mes" stat={stats.monthly} color="indigo" />
                        <ComparisonCard title="Último Trimestre" stat={stats.quarterly} color="blue" />
                        <ComparisonCard title="Acumulado Año" stat={stats.yearly} color="slate" />
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h4 className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Registros de Repostaje</h4>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {stats.logs.map((log: OperationLog) => (
                                <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{log.hoursAtExecution}h</p>
                                    </div>
                                    <div className="text-lg font-black text-green-600">+{log.fuelLitres}L</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <BarChart3 size={64} className="text-slate-300"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione una unidad móvil</p>
                </div>
            )}
        </div>
    );
};

const ComparisonCard = ({ title, stat, color }: { title: string, stat: any, color: string }) => {
    const isError = stat.logsCount < 2;
    const colorClasses: any = {
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        slate: 'text-slate-600 bg-slate-50 border-slate-100'
    };

    return (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border ${isError ? 'opacity-60 grayscale' : 'border-slate-100'}`}>
            <div className="flex justify-between items-start mb-4">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h5>
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${colorClasses[color]}`}>
                    {stat.logsCount} Suministros
                </div>
            </div>

            {isError ? (
                <div className="flex items-center gap-2 text-red-400 text-[9px] font-bold uppercase italic">
                    <AlertTriangle size={14}/> Datos insuficientes
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{stat.consumptionPerHour}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">L/h</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Consumido</p>
                            <p className="text-xs font-black text-slate-700">{stat.consumedLiters} L</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Trabajo</p>
                            <p className="text-xs font-black text-slate-700">{stat.workedHours} h</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
