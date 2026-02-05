import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines, getAllOperationLogsByRange } from '../../services/db';
import { Machine, OperationLog } from '../../types';
import { ArrowLeft, Loader2, Calendar, Printer, Fuel, LayoutGrid } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const CostDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [refuelingLogs, setRefuelingLogs] = useState<OperationLog[]>([]);

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const [machinesData, logsData] = await Promise.all([
                getAllMachines(false),
                getAllOperationLogsByRange(startDate, endDate, ['REFUELING'])
            ]);

            setAllMachines(machinesData);
            setRefuelingLogs(logsData);
        } catch (e) {
            console.error("Error loading fuel distribution data:", e);
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

    // Omit machines with NO consumption in the selected month
    const consumedMachines = useMemo(() => {
        const consumedIds = new Set(refuelingLogs.map(l => l.machineId));
        return allMachines
            .filter(m => consumedIds.has(m.id))
            .sort((a, b) => (a.companyCode || a.name).localeCompare(b.companyCode || b.name));
    }, [allMachines, refuelingLogs]);

    // Matrix calculation (Day x Machine)
    const grid = useMemo(() => {
        const matrix: Record<number, Record<string, number>> = {};
        daysInMonth.forEach(day => {
            matrix[day] = {};
            consumedMachines.forEach(m => matrix[day][m.id] = 0);
        });

        refuelingLogs.forEach(l => {
            const day = new Date(l.date).getDate();
            if (matrix[day] && consumedMachines.find(m => m.id === l.machineId)) {
                matrix[day][l.machineId] = (matrix[day][l.machineId] || 0) + (l.fuelLitres || 0);
            }
        });

        return matrix;
    }, [refuelingLogs, consumedMachines, daysInMonth]);

    const machineTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        consumedMachines.forEach(m => {
            totals[m.id] = refuelingLogs
                .filter(l => l.machineId === m.id)
                .reduce((acc, curr) => acc + (curr.fuelLitres || 0), 0);
        });
        return totals;
    }, [refuelingLogs, consumedMachines]);

    const dayTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        daysInMonth.forEach(day => {
            totals[day] = refuelingLogs
                .filter(l => new Date(l.date).getDate() === day)
                .reduce((acc, curr) => acc + (curr.fuelLitres || 0), 0);
        });
        return totals;
    }, [refuelingLogs, daysInMonth]);

    const grandTotal = useMemo(() => {
        return refuelingLogs.reduce((acc, curr) => acc + (curr.fuelLitres || 0), 0);
    }, [refuelingLogs]);

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
                        color: black !important;
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
                        font-size: 10pt !important;
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .printable-table th {
                        color: black !important;
                        border: 0.5pt solid #000 !important;
                        background: #f8fafc !important;
                        font-weight: 900 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .printable-table td {
                        border: 0.5pt solid #ccc !important;
                        padding: 4px !important;
                        color: black !important;
                    }
                    /* Día y Cantidades: Doble de tamaño y negro */
                    .day-cell {
                        font-size: 14pt !important;
                        font-weight: 900 !important;
                        color: black !important;
                        text-align: center !important;
                    }
                    .fuel-cell {
                        font-size: 14pt !important;
                        font-weight: 900 !important;
                        color: black !important;
                    }
                    .total-cell {
                        font-size: 12pt !important;
                        font-weight: 900 !important;
                        background: #f1f5f9 !important;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}} />

            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Gasoil Mensual</h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <Fuel size={10}/> Distribución Mensual por Unidad
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
                        <p className="font-black uppercase text-xs tracking-widest">Generando matriz de gasoil...</p>
                    </div>
                ) : consumedMachines.length === 0 ? (
                    <div className="py-40 text-center text-slate-400">
                        <Fuel size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase text-xs">No hay datos de consumo en este mes</p>
                    </div>
                ) : (
                    <div className="min-w-max">
                        <div className="mb-4 hidden print:block border-b pb-4">
                            <h2 className="text-2xl font-black text-slate-900 uppercase">ARIDOS MARRAQUE - Reparto Mensual de Gasoil (Litros)</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Periodo: {new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        <table className="w-full border-collapse printable-table">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-tighter print:bg-slate-100 print:text-black">
                                    <th className="p-2 border border-slate-700 text-left sticky left-0 bg-slate-900 z-10 w-20 print:bg-slate-100">Día</th>
                                    {consumedMachines.map(m => (
                                        <th key={m.id} className="p-2 border border-slate-700 text-center min-w-[60px] leading-tight">
                                            {m.companyCode ? <div className="text-[7px] opacity-70">{m.companyCode}</div> : null}
                                            <div className="whitespace-normal">{m.name}</div>
                                        </th>
                                    ))}
                                    <th className="p-2 border border-slate-700 text-center bg-slate-800 w-20 print:bg-slate-200">Total Día</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px]">
                                {daysInMonth.map(day => (
                                    <tr key={day} className={`hover:bg-slate-50 ${day % 2 === 0 ? 'bg-slate-50/30' : ''}`}>
                                        <td className="p-2 border border-slate-200 font-black text-slate-500 sticky left-0 bg-inherit z-10 day-cell">
                                            {day}
                                        </td>
                                        {consumedMachines.map(m => (
                                            <td key={m.id} className={`p-2 border border-slate-100 text-center font-mono fuel-cell ${grid[day][m.id] > 0 ? 'font-black text-green-700' : 'text-slate-200'}`}>
                                                {grid[day][m.id] > 0 ? grid[day][m.id].toFixed(1) : ''}
                                            </td>
                                        ))}
                                        <td className="p-2 border border-slate-200 text-center bg-slate-100 font-black text-slate-900 total-cell">
                                            {dayTotals[day] > 0 ? dayTotals[day].toFixed(1) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 text-[10px] font-black uppercase">
                                <tr>
                                    <td className="p-2 border border-slate-300 bg-slate-200 sticky left-0 z-10 day-cell">Total</td>
                                    {consumedMachines.map(m => (
                                        <td key={m.id} className="p-2 border border-slate-300 text-center text-blue-700 bg-blue-50/30 fuel-cell">
                                            {machineTotals[m.id].toFixed(1)}
                                        </td>
                                    ))}
                                    <td className="p-2 border border-slate-400 text-center bg-slate-900 text-white text-xs print:bg-slate-800 print:text-black total-cell">
                                        {grandTotal.toFixed(1)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-4 print:mt-10">
                            <div className="text-right flex flex-col items-end w-full">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Litros Mensual</span>
                                <span className="text-4xl font-black text-slate-900 leading-none">{grandTotal.toFixed(1)} <small className="text-sm">Litros</small></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
