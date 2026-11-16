import React from 'react';
import { CostCenter, Machine, OperationLog } from '../../types';
import { toLocalDateString } from '../../services/db';
import { Fuel, Calendar } from 'lucide-react';

export interface FuelMachineRow {
    machineId: string;
    code: string;
    name: string;
    centerName: string;
    refuelingCount: number;
    dayLiters: number;
    accumulatedLiters: number;
}

export interface FuelDayRow {
    day: number;
    dateStr: string;
    liters: number;
    cumulativeLiters: number;
    refuelingCount: number;
}

export interface FuelAccumulatedSummary {
    monthLabel: string;
    startDateStr: string;
    endDateStr: string;
    displayStartDate: string;
    displayEndDate: string;
    grandTotal: number;
    dayTotal: number;
    totalRefuelings: number;
    machineRows: FuelMachineRow[];
    dailyRows: FuelDayRow[];
}

const formatDisplayDate = (iso: string): string => {
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
};

export const computeFuelAccumulatedData = (
    refuelingLogs: OperationLog[],
    machines: Machine[],
    centers: CostCenter[],
    reportDateStr: string
): FuelAccumulatedSummary => {
    const [year, month, day] = reportDateStr.split('-').map(Number);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthDate = new Date(year, month - 1, 1);
    const monthLabel = monthDate
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        .toUpperCase();

    const machineMap = new Map<string, FuelMachineRow>();
    const dayMap = new Map<number, { liters: number; count: number }>();

    let grandTotal = 0;
    let dayTotal = 0;
    let totalRefuelings = 0;

    refuelingLogs.forEach(log => {
        const liters = Number(log.fuelLitres || 0);
        if (liters <= 0) return;

        const logDateStr = toLocalDateString(log.date);
        if (logDateStr < startDateStr || logDateStr > reportDateStr) return;

        totalRefuelings += 1;
        grandTotal += liters;

        const isTargetDay = logDateStr === reportDateStr;
        if (isTargetDay) {
            dayTotal += liters;
        }

        const logDay = Number(logDateStr.split('-')[2]);
        const dEntry = dayMap.get(logDay) || { liters: 0, count: 0 };
        dEntry.liters += liters;
        dEntry.count += 1;
        dayMap.set(logDay, dEntry);

        const existing = machineMap.get(log.machineId);
        if (existing) {
            existing.accumulatedLiters += liters;
            existing.refuelingCount += 1;
            if (isTargetDay) existing.dayLiters += liters;
        } else {
            const m = machines.find(mac => mac.id === log.machineId);
            const c = centers.find(cen => cen.id === m?.costCenterId);
            machineMap.set(log.machineId, {
                machineId: log.machineId,
                code: m?.companyCode || '---',
                name: m?.name || 'Unidad desconocida',
                centerName: c?.name || 'Sin Centro',
                refuelingCount: 1,
                dayLiters: isTargetDay ? liters : 0,
                accumulatedLiters: liters
            });
        }
    });

    const machineRows = Array.from(machineMap.values()).sort((a, b) => {
        const keyA = a.code !== '---' ? a.code : a.name;
        const keyB = b.code !== '---' ? b.code : b.name;
        return keyA.localeCompare(keyB);
    });

    const dailyRows: FuelDayRow[] = [];
    let runningTotal = 0;
    for (let d = 1; d <= day; d++) {
        const info = dayMap.get(d) || { liters: 0, count: 0 };
        runningTotal += info.liters;
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dailyRows.push({
            day: d,
            dateStr: dStr,
            liters: info.liters,
            cumulativeLiters: runningTotal,
            refuelingCount: info.count
        });
    }

    return {
        monthLabel,
        startDateStr,
        endDateStr: reportDateStr,
        displayStartDate: formatDisplayDate(startDateStr),
        displayEndDate: formatDisplayDate(reportDateStr),
        grandTotal,
        dayTotal,
        totalRefuelings,
        machineRows,
        dailyRows
    };
};

interface Props {
    summary: FuelAccumulatedSummary;
}

export const FuelAccumulatedView: React.FC<Props> = ({ summary }) => {
    const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return (
        <div className="space-y-6 px-1">
            {/* CABECERA */}
            <div data-pdf-block="true" className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100">
                        <Fuel size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">
                            Consumo Acumulado de Gasoil
                        </h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase mt-1 tracking-widest">
                            ARIDOS MARRAQUE • {summary.monthLabel}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1">
                        <Calendar size={10} /> Acumulado hasta
                    </span>
                    <span className="font-bold text-sm text-slate-800">{summary.displayEndDate}</span>
                </div>
            </div>

            {/* TARJETAS RESUMEN */}
            <div data-pdf-block="true" className="grid grid-cols-3 gap-3">
                <div className="col-span-2 bg-slate-900 text-white p-4 rounded-2xl shadow-md">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Total Acumulado Mes ({summary.displayStartDate} - {summary.displayEndDate})
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-green-400">{fmt(summary.grandTotal)}</span>
                        <span className="text-sm font-bold text-slate-300 uppercase">Litros</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {summary.machineRows.length} unidades • {summary.totalRefuelings} repostajes
                    </p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Consumo Día
                    </span>
                    <span className="text-xl font-black text-slate-800 mt-1">{fmt(summary.dayTotal)} L</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">{summary.displayEndDate}</span>
                </div>
            </div>

            {/* DESGLOSE POR MÁQUINA */}
            <div data-pdf-block="true" className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        1. Acumulado por Unidad / Máquina
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Litros (L)</span>
                </div>
                {summary.machineRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                        No se han registrado repostajes en este mes hasta la fecha.
                    </div>
                ) : (
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[9px] font-black uppercase">
                                <th className="p-2.5 text-left">Unidad</th>
                                <th className="p-2.5 text-left">Centro</th>
                                <th className="p-2.5 text-center">Rep.</th>
                                <th className="p-2.5 text-right">Día</th>
                                <th className="p-2.5 text-right bg-slate-800">Acum. Mes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary.machineRows.map((row, idx) => (
                                <tr key={row.machineId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className="p-2.5">
                                        {row.code !== '---' && (
                                            <span className="text-[9px] font-black text-blue-600 block leading-none mb-0.5">
                                                [{row.code}]
                                            </span>
                                        )}
                                        <span className="font-bold text-slate-800">{row.name}</span>
                                    </td>
                                    <td className="p-2.5 text-[10px] font-bold text-slate-500 uppercase">
                                        {row.centerName}
                                    </td>
                                    <td className="p-2.5 text-center font-mono text-slate-600">
                                        {row.refuelingCount}
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-slate-600">
                                        {row.dayLiters > 0 ? `${fmt(row.dayLiters)} L` : '-'}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-black text-green-700 bg-green-50/30">
                                        {fmt(row.accumulatedLiters)} L
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs uppercase">
                                <td colSpan={3} className="p-3 text-right">TOTAL ACUMULADO</td>
                                <td className="p-3 text-right font-mono">{fmt(summary.dayTotal)} L</td>
                                <td className="p-3 text-right font-mono text-green-400">{fmt(summary.grandTotal)} L</td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            {/* EVOLUCIÓN DIARIA */}
            <div data-pdf-block="true" className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        2. Evolución Diaria del Mes (Días 1 al {summary.dailyRows.length})
                    </h4>
                </div>
                <table className="w-full border-collapse text-[11px]">
                    <thead>
                        <tr className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase border-b border-slate-200">
                            <th className="p-2 text-center">Día</th>
                            <th className="p-2 text-left">Fecha</th>
                            <th className="p-2 text-center">Repostajes</th>
                            <th className="p-2 text-right">Litros Día</th>
                            <th className="p-2 text-right">Acumulado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {summary.dailyRows.map(d => (
                            <tr key={d.day} className={d.liters > 0 ? 'bg-white' : 'bg-slate-50/40 text-slate-400'}>
                                <td className="p-1.5 text-center font-black">{d.day}</td>
                                <td className="p-1.5 font-mono">{formatDisplayDate(d.dateStr)}</td>
                                <td className="p-1.5 text-center font-mono">{d.refuelingCount > 0 ? d.refuelingCount : '-'}</td>
                                <td className={`p-1.5 text-right font-mono ${d.liters > 0 ? 'font-bold text-green-700' : ''}`}>
                                    {d.liters > 0 ? `${fmt(d.liters)} L` : '-'}
                                </td>
                                <td className="p-1.5 text-right font-mono font-bold text-slate-700">
                                    {fmt(d.cumulativeLiters)} L
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
