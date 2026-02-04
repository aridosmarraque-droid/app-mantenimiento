
import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines, getAllPersonalReportsByRange } from '../../services/db';
import { Machine, PersonalReport } from '../../types';
import { ArrowLeft, Loader2, Calendar, Printer, FileText, LayoutGrid } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const CostDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [machines, setMachines] = useState<Machine[]>([]);
    const [reports, setReports] = useState<PersonalReport[]>([]);

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const [machinesData, reportsData] = await Promise.all([
                getAllMachines(false),
                getAllPersonalReportsByRange(startDate, endDate)
            ]);

            setMachines(machinesData.sort((a, b) => (a.companyCode || a.name).localeCompare(b.companyCode || b.name)));
            setReports(reportsData);
        } catch (e) {
            console.error("Error loading distribution data:", e);
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = useMemo(() => {
        if (!selectedMonth) return [];
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month, 0);
        const days = [];
        for (let i = 1; i <= date.getDate(); i++) {
            days.push(i);
        }
        return days;
    }, [selectedMonth]);

    // Matrix calculation
    const grid = useMemo(() => {
        const matrix: Record<number, Record<string, number>> = {};
        daysInMonth.forEach(day => {
            matrix[day] = {};
            machines.forEach(m => matrix[day][m.id] = 0);
        });

        reports.forEach(r => {
            const day = new Date(r.date).getDate();
            if (matrix[day] && r.machineId) {
                matrix[day][r.machineId] = (matrix[day][r.machineId] || 0) + r.hours;
            }
        });

        return matrix;
    }, [reports, machines, daysInMonth]);

    const machineTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        machines.forEach(m => {
            totals[m.id] = reports
                .filter(r => r.machineId === m.id)
                .reduce((acc, curr) => acc + curr.hours, 0);
        });
        return totals;
    }, [reports, machines]);

    const dayTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        daysInMonth.forEach(day => {
            totals[day] = reports
                .filter(r => new Date(r.date).getDate() === day)
                .reduce((acc, curr) => acc + curr.hours, 0);
        });
        return totals;
    }, [reports, daysInMonth]);

    const grandTotal = useMemo(() => {
        return reports.reduce((acc, curr) => acc + curr.hours, 0);
    }, [reports]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A3 landscape;
                        margin: 1cm;
                    }
                    body {
                        background: white !important;
                    }
                    header, .no-print {
                        display: none !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: none !important;
                    }
                    .print-container {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    .printable-table {
                        font-size: 7pt !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .printable-table th, .printable-table td {
                        border: 0.1pt solid #ccc !important;
                        padding: 2px !important;
                    }
                }
            `}} />

            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Reparto de Costes</h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <LayoutGrid size={10}/> Distribución Mensual por Máquina
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-xl font-bold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-green-500 text-sm outline-none"
                        />
                    </div>
                    <button 
                        onClick={handlePrint}
                        className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2 text-xs font-black uppercase"
                    >
                        <Printer size={18}/> <span className="hidden sm:inline">Imprimir A3</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container overflow-x-auto">
                {loading ? (
                    <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin mb-4 text-green-500" size={48} />
                        <p className="font-black uppercase text-xs tracking-widest">Calculando distribución...</p>
                    </div>
                ) : (
                    <div className="min-w-max">
                        <div className="mb-4 hidden print:block border-b pb-4">
                            <h2 className="text-2xl font-black text-slate-900 uppercase">ARIDOS MARRAQUE - Reparto de Costes de Personal</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Periodo: {new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        <table className="w-full border-collapse printable-table">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-tighter">
                                    <th className="p-2 border border-slate-700 text-left sticky left-0 bg-slate-900 z-10 w-20">Día</th>
                                    {machines.map(m => (
                                        <th key={m.id} className="p-2 border border-slate-700 text-center min-w-[50px] leading-tight">
                                            {m.companyCode ? <div className="text-[7px] opacity-70">{m.companyCode}</div> : null}
                                            <div className="rotate-0 sm:rotate-0">{m.name}</div>
                                        </th>
                                    ))}
                                    <th className="p-2 border border-slate-700 text-center bg-slate-800 w-16">Total Día</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px]">
                                {daysInMonth.map(day => (
                                    <tr key={day} className={`hover:bg-slate-50 ${day % 2 === 0 ? 'bg-slate-50/30' : ''}`}>
                                        <td className="p-2 border border-slate-200 font-black text-slate-500 sticky left-0 bg-inherit z-10">
                                            {day}
                                        </td>
                                        {machines.map(m => (
                                            <td key={m.id} className={`p-2 border border-slate-100 text-center font-mono ${grid[day][m.id] > 0 ? 'font-black text-slate-900' : 'text-slate-300'}`}>
                                                {grid[day][m.id] > 0 ? grid[day][m.id] : ''}
                                            </td>
                                        ))}
                                        <td className="p-2 border border-slate-200 text-center bg-slate-100 font-black text-slate-900">
                                            {dayTotals[day] > 0 ? dayTotals[day] : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 text-[10px] font-black uppercase">
                                <tr>
                                    <td className="p-2 border border-slate-300 bg-slate-200 sticky left-0 z-10">Total Maq.</td>
                                    {machines.map(m => (
                                        <td key={m.id} className="p-2 border border-slate-300 text-center text-blue-700 bg-blue-50/30">
                                            {machineTotals[m.id]}
                                        </td>
                                    ))}
                                    <td className="p-2 border border-slate-400 text-center bg-slate-900 text-white text-xs">
                                        {grandTotal}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-4 print:mt-10">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 no-print max-w-sm">
                                <h4 className="font-black text-slate-800 text-xs uppercase mb-2 flex items-center gap-2">
                                    <FileText size={14} className="text-blue-500" /> Información del Informe
                                </h4>
                                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                    Este reparto muestra la suma de horas registradas en los <b>Partes de Trabajo de Personal</b>. 
                                    Se recomienda imprimir este informe en formato <b>A3 Horizontal</b> para una visualización correcta de todas las columnas de maquinaria.
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Acumulado Mensual</span>
                                <span className="text-4xl font-black text-slate-900 leading-none">{grandTotal} <small className="text-sm">horas</small></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
