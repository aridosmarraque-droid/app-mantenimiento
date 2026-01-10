
import React, { useState, useEffect, useCallback } from 'react';
// Fixed import: getMachineFuelStats is exported from services/stats, not services/db
import { getAllMachines, getFuelLogs } from '../../services/db';
import { calculateFuelConsumptionFromLogs, getMachineFuelStats } from '../../services/stats';
import { generateFuelReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog } from '../../types';
import { 
    ArrowLeft, Fuel, Calendar, TrendingUp, Search, Loader2, 
    FileText, Send, CheckCircle2, AlertTriangle, Truck,
    BarChart3, Info, Download, Mail
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const FuelReportViewer: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        getAllMachines(false).then(setMachines);
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
        if (!confirm("Se generará un informe consolidado de todas las máquinas y se enviará por email. ¿Continuar?")) return;
        setSending(true);
        try {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const periodName = lastMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            
            // Recopilar datos de todas las máquinas
            const consolidatedData = [];
            for (const m of machines) {
                const machineStats = await getMachineFuelStats(m.id);
                if (machineStats.monthly.logsCount > 1 || machineStats.quarterly.logsCount > 1) {
                    consolidatedData.push({ machine: m, stats: machineStats });
                }
            }

            if (consolidatedData.length === 0) {
                alert("No hay suficientes datos de repostaje para generar el informe.");
                return;
            }

            const pdfBase64 = generateFuelReportPDF(consolidatedData, periodName);
            const res = await sendEmail(
                ['administracion@aridosmarraque.com'],
                `Informe de Consumos Gasoil - ${periodName}`,
                `<p>Adjuntamos el informe consolidado de consumos de gasoil correspondiente a ${periodName}.</p>`,
                pdfBase64,
                `Informe_Gasoil_${periodName.replace(' ', '_')}.pdf`
            );

            if (res.success) alert("Informe enviado correctamente.");
            else alert("Error al enviar el email.");
        } catch (e) {
            alert("Error al generar el informe.");
        } finally {
            setSending(false);
        }
    };

    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? (m.companyCode ? `[${m.companyCode}] ${m.name}` : m.name) : "Máquina";
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Informe de Consumos</h3>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1 space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                        <Truck size={12}/> 1. Consulta Online por Máquina
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

                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                        <Mail size={12}/> 2. Acciones Administrativas
                    </label>
                    <button 
                        onClick={handleSendMonthlyReport}
                        disabled={sending}
                        className="w-full bg-slate-900 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        {sending ? 'Generando...' : 'Enviar Informe Mensual a Gerencia'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
                    <p className="font-black uppercase tracking-widest text-xs">Calculando indicadores...</p>
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <BarChart3 className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
                        <h4 className="font-black uppercase text-[10px] tracking-widest opacity-80 mb-2">Análisis de Eficiencia</h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black">{stats.monthly.consumptionPerHour}</span>
                            <span className="text-xl font-bold opacity-80">L/h</span>
                        </div>
                        <p className="text-xs font-bold mt-1 opacity-70 italic">Consumo medio este mes</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <ComparisonCard title="Consumo Mes Actual" stat={stats.monthly} color="indigo" />
                        <ComparisonCard title="Último Trimestre" stat={stats.quarterly} color="blue" />
                        <ComparisonCard title="Acumulado Año" stat={stats.yearly} color="slate" />
                    </div>

                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h4 className="font-black text-slate-600 uppercase text-[10px] tracking-widest">Historial de Repostajes (Año)</h4>
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{stats.logs.length}</span>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto custom-scrollbar">
                            {stats.logs.map((log: OperationLog) => (
                                <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="font-mono font-bold text-slate-700 text-sm">{log.hoursAtExecution} H / Kms</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-green-600">+{log.fuelLitres} L</div>
                                        <div className="text-[8px] font-bold text-slate-300 uppercase">Suministrado</div>
                                    </div>
                                </div>
                            ))}
                            {stats.logs.length === 0 && (
                                <div className="py-10 text-center text-slate-400 text-xs italic">No hay repostajes registrados.</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-800 font-medium leading-relaxed uppercase">
                            <strong>Nota Metodológica:</strong> El cálculo L/h se realiza descontando los litros del último repostaje, ya que se consideran stock disponible para el siguiente periodo, dividiendo los litros consumidos por la diferencia de horas entre el primer y último registro del periodo seleccionado.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                    <div className="bg-slate-200 p-8 rounded-full">
                        <BarChart3 size={64}/>
                    </div>
                    <p className="font-black uppercase tracking-widest text-xs">Seleccione una máquina para ver el informe</p>
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
                    {stat.logsCount} Repostajes
                </div>
            </div>

            {isError ? (
                <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase italic">
                    <AlertTriangle size={14}/> Datos insuficientes para cálculo medio
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{stat.consumptionPerHour}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">L/h Medio</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Consumido</p>
                            <p className="text-sm font-black text-slate-700">{stat.consumedLiters} L</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Horas Tajo</p>
                            <p className="text-sm font-black text-slate-700">{stat.workedHours} h</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
