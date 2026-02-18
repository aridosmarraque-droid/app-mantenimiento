import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFleetFluidStats, formatDecimal } from '../../services/stats';
import { generateFluidReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { 
    ArrowLeft, Loader2, Truck, Activity,
    Thermometer, Waves, Table, Send, Calendar,
    Droplets, Info, Filter, X
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const FluidReportViewer: React.FC<Props> = ({ onBack }) => {
    // Estado para múltiples meses seleccionados
    const [selectedMonths, setSelectedMonths] = useState<string[]>([new Date().toISOString().substring(0, 7)]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [fleetData, setFleetData] = useState<any[]>([]);

    // Generar lista de los últimos 24 meses para el selector
    const availableMonths = useMemo(() => {
        const months = [];
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toISOString().substring(0, 7));
        }
        return months;
    }, []);

    const toggleMonth = (m: string) => {
        setSelectedMonths(prev => {
            if (prev.includes(m)) {
                if (prev.length === 1) return prev; // Mantener al menos uno
                return prev.filter(x => x !== m).sort();
            }
            return [...prev, m].sort();
        });
    };

    const periodName = useMemo(() => {
        if (selectedMonths.length === 0) return "SIN PERIODO";
        if (selectedMonths.length === 1) {
            const [year, month] = selectedMonths[0].split('-').map(Number);
            const dateObj = new Date(year, month - 1, 1);
            return dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        }
        const sorted = [...selectedMonths].sort();
        const [yStart, mStart] = sorted[0].split('-').map(Number);
        const [yEnd, mEnd] = sorted[sorted.length - 1].split('-').map(Number);
        
        const startLabel = new Date(yStart, mStart - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase();
        const endLabel = new Date(yEnd, mEnd - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase();
        
        return `${startLabel} - ${endLabel}`;
    }, [selectedMonths]);

    const loadData = useCallback(async () => {
        if (selectedMonths.length === 0) return;
        setLoading(true);
        try {
            const data = await getFleetFluidStats(selectedMonths);
            setFleetData(data);
        } catch (e) {
            console.error("Error cargando informe de fluidos:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedMonths]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSendReport = async () => {
        if (sending || fleetData.length === 0) return;

        if (!confirm(`¿Enviar informe de fluidos del periodo ${periodName} a aridos@marraque.es?`)) return;

        setSending(true);
        try {
            const pdfBase64 = generateFluidReportPDF(fleetData, periodName);
            await sendEmail(
                ['aridos@marraque.es'],
                `Informe Fluidos Flota - ${periodName}`,
                `<p>Se adjunta el desglose detallado de consumos de fluidos por unidad para el periodo analizado: <b>${periodName}</b>.</p>`,
                pdfBase64,
                `Informe_Fluidos_${periodName.replace(/\s+/g, '_')}.pdf`
            );
            alert("Informe enviado con éxito.");
        } catch (e) {
            alert("Error al generar o enviar el informe.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Cabecera */}
            <div className="flex flex-col border-b bg-white shadow-sm sticky top-0 z-10">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Monitor Fluidos</h3>
                            <p className="text-[10px] font-black text-indigo-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                                <Activity size={10}/> {periodName}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleSendReport}
                        disabled={sending || loading || fleetData.length === 0}
                        className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                        title="Enviar Informe Flota"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                </div>

                {/* Selector Dinámico de Meses (Slicer) */}
                <div className="px-4 pb-4 overflow-x-auto">
                    <div className="flex items-center gap-2 pb-1">
                        <Filter size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seleccionar meses para visión a largo plazo:</span>
                    </div>
                    <div className="flex gap-2 min-w-max pr-4">
                        {availableMonths.map(m => {
                            const isSelected = selectedMonths.includes(m);
                            const [year, month] = m.split('-').map(Number);
                            const label = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }).toUpperCase();
                            
                            return (
                                <button
                                    key={m}
                                    onClick={() => toggleMonth(m)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border-2 ${
                                        isSelected 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
                    <p className="font-black uppercase text-[10px] tracking-widest">Analizando periodo extendido...</p>
                </div>
            ) : fleetData.length === 0 ? (
                <div className="py-40 text-center text-slate-300">
                    <Table size={64} className="mx-auto mb-4 opacity-20"/>
                    <p className="font-black uppercase tracking-widest text-xs">Sin registros de niveles en el periodo seleccionado</p>
                </div>
            ) : (
                <div className="space-y-8 px-1">
                    {fleetData.map(({ machine, fluidRecords, averages }, mIdx) => (
                        <div key={machine.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                            {/* Cabecera Máquina */}
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/10 rounded-lg">
                                        <Truck size={20} className="text-indigo-400"/>
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-sm tracking-tight">
                                            {machine.companyCode ? `[${machine.companyCode}] ` : ''}{machine.name}
                                        </h4>
                                    </div>
                                </div>
                            </div>

                            {/* Desglose por Fluido */}
                            <div className="p-4 space-y-6">
                                <FluidTable 
                                    title="Aceite Motor" 
                                    icon={<Activity size={14}/>} 
                                    color="text-blue-600" 
                                    records={fluidRecords.motor} 
                                    avgRate={averages.motor}
                                />
                                <FluidTable 
                                    title="Aceite Hidráulico" 
                                    icon={<Waves size={14}/>} 
                                    color="text-teal-600" 
                                    records={fluidRecords.hydraulic} 
                                    avgRate={averages.hydraulic}
                                />
                                <FluidTable 
                                    title="Refrigerante" 
                                    icon={<Thermometer size={14}/>} 
                                    color="text-red-600" 
                                    records={fluidRecords.coolant} 
                                    avgRate={averages.coolant}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mx-1 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 no-print">
                <Info className="text-blue-600 shrink-0" size={18}/>
                <p className="text-[10px] text-blue-800 leading-relaxed italic">
                    <b>Análisis a Largo Plazo:</b> La tasa <b>L/100h</b> se calcula entre cada registro consecutivo. El "Promedio Serie" representa el comportamiento técnico global en todo el periodo seleccionado.
                </p>
            </div>
        </div>
    );
};

const FluidTable = ({ title, icon, color, records, avgRate }: any) => {
    if (!records || records.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                <h5 className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${color}`}>
                    {icon} {title}
                </h5>
                {avgRate !== null && (
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Promedio Serie:</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md bg-white border border-slate-200 ${color}`}>
                            {formatDecimal(avgRate, 2)} <small className="text-[8px]">L/100h</small>
                        </span>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                        <tr className="bg-slate-100/50 border-b font-black text-slate-400 uppercase">
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Horas</th>
                            <th className="p-2 text-center">Litros (L)</th>
                            <th className="p-2 text-center">Consumo (L/100h)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {records.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2 font-bold text-slate-600">{r.date}</td>
                                <td className="p-2 font-mono text-slate-700">{r.hours}h</td>
                                <td className="p-2 text-center font-black text-slate-800">{formatDecimal(r.amount, 1)} L</td>
                                <td className="p-2 text-center">
                                    {r.rate !== null ? (
                                        <span className={`font-black px-1.5 py-0.5 rounded-full ${r.rate > (avgRate * 1.2) ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {formatDecimal(r.rate, 2)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 italic">Base serie</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
