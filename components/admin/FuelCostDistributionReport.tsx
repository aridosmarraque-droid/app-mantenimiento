
import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines, getCostCenters, getAllOperationLogsByRange, getAllPersonalReportsByRange, getSpecificCostRules } from '../../services/db';
import { Machine, CostCenter, OperationLog, PersonalReport, SpecificCostRule } from '../../types';
import { ArrowLeft, Loader2, Calendar, Printer, Fuel, Sigma, TableProperties, Download, AlertCircle, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
    onBack: () => void;
}

interface SummaryRow {
    centerCode: string;
    centerName: string;
    machineName: string;
    liters: number;
}

export const FuelCostDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [machines, setMachines] = useState<Machine[]>([]);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [fuelLogs, setFuelLogs] = useState<OperationLog[]>([]);
    const [laborReports, setLaborReports] = useState<PersonalReport[]>([]);
    const [specificRules, setSpecificRules] = useState<SpecificCostRule[]>([]);

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const [m, c, fl, lr, sr] = await Promise.all([
                getAllMachines(false),
                getCostCenters(),
                getAllOperationLogsByRange(startDate, endDate, ['REFUELING']),
                getAllPersonalReportsByRange(startDate, endDate),
                getSpecificCostRules()
            ]);

            setMachines(m);
            setCenters(c);
            setFuelLogs(fl);
            setLaborReports(lr);
            setSpecificRules(sr);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const distribution = useMemo(() => {
        const units: Record<string, SummaryRow> = {};

        // 1. Obtener litros totales consumidos por cada máquina en el mes
        const machineLiters: Record<string, number> = {};
        fuelLogs.forEach(log => {
            machineLiters[log.machineId] = (machineLiters[log.machineId] || 0) + (log.fuelLitres || 0);
        });

        // 2. Procesar cada máquina que consumió gasoil
        Object.entries(machineLiters).forEach(([machineId, totalLiters]) => {
            const rules = specificRules.filter(r => r.machineOriginId === machineId);
            const machine = machines.find(m => m.id === machineId);
            const machineName = machine ? machine.name : 'Desconocida';

            if (rules.length > 0) {
                // REPARTO POR REGLA ESPECÍFICA (GRUPOS, ETC)
                rules.forEach(rule => {
                    const center = centers.find(c => c.id === rule.targetCenterId);
                    const cCode = center?.companyCode || 'N/A';
                    const cName = center?.name || 'N/A';
                    const targetMachine = machines.find(m => m.id === rule.targetMachineId);
                    const tMachineName = targetMachine ? targetMachine.name : 'General';
                    
                    const key = `${cCode}-${tMachineName}`;
                    if (!units[key]) {
                        units[key] = { centerCode: cCode, centerName: cName, machineName: tMachineName, liters: 0 };
                    }
                    units[key].liters += totalLiters * (rule.percentage / 100);
                });
            } else {
                // REPARTO POR RATIO DE PARTES DE TRABAJO (RESTO MAQUINARIA)
                const reports = laborReports.filter(r => r.machineId === machineId);
                const totalHours = reports.reduce((acc, r) => acc + r.hours, 0);

                if (totalHours > 0) {
                    const centerRatios: Record<string, number> = {};
                    reports.forEach(r => {
                        const cKey = r.costCenterId || 'none';
                        centerRatios[cKey] = (centerRatios[cKey] || 0) + r.hours;
                    });

                    Object.entries(centerRatios).forEach(([centerId, hours]) => {
                        const ratio = hours / totalHours;
                        const center = centers.find(c => c.id === centerId);
                        const cCode = center?.companyCode || 'N/A';
                        const cName = center?.name || 'N/A';
                        
                        const key = `${cCode}-${machineName}`;
                        if (!units[key]) {
                            units[key] = { centerCode: cCode, centerName: cName, machineName: machineName, liters: 0 };
                        }
                        units[key].liters += totalLiters * ratio;
                    });
                } else {
                    // Si no tiene reglas ni partes, lo asignamos a su centro por defecto
                    const cId = machine?.costCenterId || 'none';
                    const center = centers.find(c => c.id === cId);
                    const cCode = center?.companyCode || 'N/A';
                    const cName = center?.name || 'N/A';
                    const key = `${cCode}-${machineName}`;
                    
                    if (!units[key]) {
                        units[key] = { centerCode: cCode, centerName: cName, machineName: machineName, liters: 0 };
                    }
                    units[key].liters += totalLiters;
                }
            }
        });

        return Object.values(units).sort((a, b) => a.centerCode.localeCompare(b.centerCode) || a.machineName.localeCompare(b.machineName));
    }, [fuelLogs, laborReports, specificRules, machines, centers]);

    const totalLiters = useMemo(() => distribution.reduce((acc, r) => acc + r.liters, 0), [distribution]);

    const handleExport = () => {
        const data = distribution.map(r => ({
            "Centro Cod.": r.centerCode,
            "Centro": r.centerName,
            "Máquina": r.machineName,
            "Litros Gasoil": r.liters.toFixed(2)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reparto Gasoil");
        XLSX.writeFile(wb, `Reparto_Gasoil_${selectedMonth}.xlsx`);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4 portrait; margin: 1cm; }
                    header, .no-print { display: none !important; }
                    .printable-table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; }
                    .printable-table th, .printable-table td { border: 0.1pt solid #ccc !important; padding: 6px !important; }
                }
            `}} />

            <div className="flex flex-col gap-4 border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700"><ArrowLeft size={24} /></button>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Reparto Consumo Gasoil</h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Cálculo por Ratios y Reglas Específicas</p>
                        </div>
                    </div>
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold bg-slate-50" />
                </div>
                
                <div className="flex gap-2">
                    <button onClick={handleExport} className="flex-1 py-3 px-4 bg-green-100 text-green-700 border border-green-200 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-200">
                        <Download size={16}/> Exportar Excel
                    </button>
                    <button onClick={() => window.print()} className="flex-1 py-3 px-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-black">
                        <Printer size={16}/> Imprimir PDF
                    </button>
                </div>
            </div>

            <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-auto max-w-4xl">
                <div className="mb-6 flex items-center gap-2 border-b pb-4">
                    <TableProperties className="text-indigo-600" size={24} />
                    <h4 className="font-black text-slate-800 uppercase tracking-tight">Consolidado Mensual de Litros</h4>
                </div>

                <table className="w-full border-collapse printable-table">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                            <th className="p-3 border border-slate-700 text-left">Centro de Coste (Cod)</th>
                            <th className="p-3 border border-slate-700 text-left">Unidad de Trabajo</th>
                            <th className="p-3 border border-slate-700 text-center bg-slate-800 w-32">Litros (L)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {distribution.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="p-3 border border-slate-200 font-bold text-slate-700 text-xs">
                                    <div className="flex flex-col">
                                        <span>{row.centerCode}</span>
                                        <span className="text-[8px] text-slate-400 font-normal">{row.centerName}</span>
                                    </div>
                                </td>
                                <td className="p-3 border border-slate-200 font-black text-slate-900 text-xs uppercase">{row.machineName}</td>
                                <td className="p-3 border border-slate-200 text-center font-mono font-black text-blue-700 text-sm">
                                    {row.liters.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-black uppercase text-xs">
                        <tr>
                            <td className="p-4 border border-slate-800 text-right pr-6" colSpan={2}>TOTAL GASOIL MES</td>
                            <td className="p-4 border border-slate-800 text-center">{totalLiters.toLocaleString('de-DE', { minimumFractionDigits: 2 })} L</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3 no-print">
                    <AlertCircle className="text-blue-600 flex-shrink-0" size={20}/>
                    <p className="text-[10px] text-blue-800 leading-relaxed italic">
                        <b>Lógica de Reparto:</b> Primero se aplican las reglas fijas (Costes Específicos). Para el resto de máquinas, el consumo total registrado se divide proporcionalmente entre los centros donde la unidad reportó horas en sus partes de trabajo mensuales.
                    </p>
                </div>
            </div>
        </div>
    );
};
