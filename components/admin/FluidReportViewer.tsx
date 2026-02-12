import React, { useState, useEffect, useCallback } from 'react';
import { getFleetFluidStats, formatDecimal } from '../../services/stats';
import { generateFluidReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { 
    ArrowLeft, Loader2, Truck, Activity,
    Thermometer, Waves, Table, Send, Calendar,
    Droplets, Info, Printer
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const FluidReportViewer: React.FC<Props> = ({ onBack }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [fleetData, setFleetData] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getFleetFluidStats(selectedMonth);
            setFleetData(data);
        } catch (e) {
            console.error("Error cargando informe de fluidos:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSendReport = async () => {
        if (sending) return;
        const [year, month] = selectedMonth.split('-').map(Number);
        const dateObj = new Date(year, month - 1, 1);
        const periodName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        if (!confirm(`¿Enviar informe de fluidos del mes de ${periodName} a aridos@marraque.es?`)) return;

        setSending(true);
        try {
            const pdfBase64 = generateFluidReportPDF(fleetData, periodName);
            await sendEmail(
                ['aridos@marraque.es'],
                `Informe Fluidos Flota - ${periodName}`,
                `<p>Se adjunta el desglose detallado de consumos de fluidos por unidad para el periodo ${periodName}.</p>`,
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
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Monitor Fluidos</h3>
                        <p className="text-[10px] font-black text-indigo-600 uppercase mt-1 tracking-widest">Tasas Técnicas L/100h</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-xl font-bold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-indigo-500 text-sm outline-none"
                        />
                    </div>
                    <button 
                        onClick={handleSendReport}
                        disabled={sending || loading}
                        className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all disabled:opacity-30 shadow-lg"
                        title="Enviar Informe Flota"
                    >
                        {sending ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={48} />
                    <p className="font-black uppercase text-[10px] tracking-widest">Compilando registros de flota...</p>
                </div>
            ) : fleetData.length === 0 ? (
                <div className="py-40 text-center text-slate-300">
                    <Table size={64} className="mx-auto mb-4 opacity-20"/>
                    <p className="font-black uppercase tracking-widest text-xs">Sin registros de niveles en el periodo seleccionado</p>
                </div>
            ) : (
                <div className="space-y-8 px-1">
                    {fleetData.map(({ machine, fluidRecords }, mIdx) => (
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
                                />
                                <FluidTable 
                                    title="Aceite Hidráulico" 
                                    icon={<Waves size={14}/>} 
                                    color="text-teal-600" 
                                    records={fluidRecords.hydraulic} 
                                />
                                <FluidTable 
                                    title="Refrigerante" 
                                    icon={<Thermometer size={14}/>} 
                                    color="text-red-600" 
                                    records={fluidRecords.coolant} 
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mx-1 bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3 no-print">
                <Info className="text-amber-600 shrink-0" size={18}/>
                <p className="text-[10px] text-amber-800 leading-relaxed italic">
                    La tasa <b>L/100h</b> se calcula respecto al registro inmediato anterior de la unidad dentro del mes seleccionado.
                </p>
            </div>
        </div>
    );
};

const FluidTable = ({ title, icon, color, records }: any) => {
    if (!records || records.length === 0) return null;

    return (
        <div className="space-y-2">
            <h5 className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${color}`}>
                {icon} {title}
            </h5>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                        <tr className="bg-slate-50 border-b font-black text-slate-400 uppercase">
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
                                        <span className="font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                            {formatDecimal(r.rate, 2)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 italic">Primer reg.</span>
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
