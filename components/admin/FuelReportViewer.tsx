import React, { useState, useEffect, useCallback } from 'react';
import { getAllMachines, getFuelLogs, getCostCenters } from '../../services/db';
import { calculateFuelConsumptionFromLogs, getMachineFuelStats, formatDecimal } from '../../services/stats';
import { generateFuelReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { Machine, OperationLog } from '../../types';
import { 
    ArrowLeft, Fuel, Calendar, TrendingUp, Search, Loader2, 
    Send, Truck, BarChart3, AlertTriangle, Mail, RefreshCw, Clock, Info
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
    const [isLastDay, setIsLastDay] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            const [centers, machines] = await Promise.all([
                getCostCenters(),
                getAllMachines(false)
            ]);

            const mobileCenter = centers.find(c => {
                const name = c.name.toLowerCase();
                return name.includes('móvil') || name.includes('movil');
            });
            
            setFilteredMachines(mobileCenter 
                ? machines.filter(m => m.costCenterId === mobileCenter.id)
                : machines.filter(m => m.companyCode)
            );

            // Verificar si es el último día del mes
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            if (tomorrow.getDate() === 1) setIsLastDay(true);
        };
        loadInitialData();
    }, []);

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

    const handleSendMonthlyReport = async (isForced: boolean = false) => {
        const confirmMsg = isForced 
            ? "FORZAR ENVÍO: Se enviará el informe de toda la Maquinaria Móvil a aridos@marraque.es ahora mismo. ¿Confirmar?"
            : "Se enviará el informe mensual consolidado de Gasoil a aridos@marraque.es. ¿Continuar?";
        
        if (!confirm(confirmMsg)) return;

        setSending(true);
        try {
            const now = new Date();
            const periodName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            
            const consolidatedData = [];
            for (const m of filteredMachines) {
                const mStats = await getMachineFuelStats(m.id);
                if (mStats.yearly.logsCount > 0) {
                    consolidatedData.push({ machine: m, stats: mStats });
                }
            }

            if (consolidatedData.length === 0) {
                alert("Sin datos de suministros para generar el informe.");
                setSending(false);
                return;
            }

            const pdfBase64 = generateFuelReportPDF(consolidatedData, periodName);
            const res = await sendEmail(
                ['aridos@marraque.es'],
                `Informe Mensual Gasoil - ${periodName}${isForced ? ' (ENVÍO FORZADO)' : ''}`,
                `<p>Informe consolidado de consumos de la <strong>Maquinaria Móvil</strong> correspondiente a ${periodName}.</p>`,
                pdfBase64,
                `Gasoil_Consol_Marraque_${periodName.replace(/\s+/g, '_')}.pdf`
            );

            if (res.success) alert("Informe enviado con éxito.");
            else alert("Error en el servidor de correo.");
        } catch (e) {
            alert("Error en el proceso de generación.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 leading-none">Control Gasoil</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase mt-1 tracking-widest">Maquinaria Móvil</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isLastDay && (
                         <div className="hidden sm:flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 rounded-lg border border-amber-100">
                            <Clock size={10}/> CIERRE MES DISPONIBLE
                         </div>
                    )}
                    <button 
                        onClick={() => handleSendMonthlyReport(true)}
                        disabled={sending || filteredMachines.length === 0}
                        className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                        title="Forzar Envío Cierre Mensual"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1 space-y-5">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                        <Truck size={12}/> Seleccionar Máquina Móvil
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

                {isLastDay && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                        {/* Fix: Added missing Info icon import from lucide-react */}
                        <Info size={20} className="text-amber-600 flex-shrink-0 mt-1"/>
                        <div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-tighter">Último día del mes detectado</p>
                            <p className="text-[10px] text-amber-600">Recuerde que el informe se enviará automáticamente a las 23:00. Use el botón superior si desea forzar el cierre ahora.</p>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-black uppercase tracking-widest text-[10px]">
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={40} />
                    Analizando repostajes...
                </div>
            ) : stats ? (
                <div className="space-y-6 px-1">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
                        <h4 className="font-black uppercase text-[10px] tracking-widest opacity-80 mb-2">Consumo Promedio Mes</h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black">{formatDecimal(stats.monthly.consumptionPerHour, 2)}</span>
                            <span className="text-xl font-bold opacity-80">L/h</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <ComparisonCard title="Mes Actual" stat={stats.monthly} />
                        <ComparisonCard title="Acumulado Trimestre" stat={stats.quarterly} />
                        <ComparisonCard title="Histórico Anual" stat={stats.yearly} />
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
                <div className="py-20 text-center opacity-30">
                    <BarChart3 size={64} className="mx-auto text-slate-300 mb-4"/>
                    <p className="font-black uppercase tracking-widest text-[10px]">Seleccione una unidad para ver eficiencia</p>
                </div>
            )}
        </div>
    );
};

const ComparisonCard = ({ title, stat }: any) => {
    const isError = stat.logsCount < 2;
    return (
        <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 ${isError ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start mb-3">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h5>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-50 border text-slate-400 uppercase">
                    {stat.logsCount} Registros
                </span>
            </div>

            {isError ? (
                <div className="text-[9px] text-red-400 font-black uppercase italic flex items-center gap-1">
                    <AlertTriangle size={12}/> Datos Insuficientes
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{formatDecimal(stat.consumptionPerHour, 2)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">L/h</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Litros</p>
                            <p className="text-xs font-black text-slate-600">{formatDecimal(stat.consumedLiters, 1)} L</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Trabajo</p>
                            <p className="text-xs font-black text-slate-600">{stat.workedHours} h</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
