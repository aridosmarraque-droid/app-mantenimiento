
import React, { useState, useEffect, useMemo } from 'react';
import { getWorkers, getAllPersonalReportsByRange } from '../../services/db';
import { Worker, PersonalReport } from '../../types';
import { ArrowLeft, Loader2, Calendar, Printer, User, Clock, Factory, Truck } from 'lucide-react';

interface Props {
    onBack: () => void;
}

interface GroupedData {
    workerId: string;
    workerName: string;
    totalWorkerHours: number;
    centers: {
        centerId: string;
        centerName: string;
        machines: {
            machineId: string;
            machineName: string;
            hours: number;
            ratio: number;
        }[];
    }[];
}

export const WorkerHoursDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [workers, setWorkers] = useState<Worker[]>([]);
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

            const [workersData, reportsData] = await Promise.all([
                getWorkers(false),
                getAllPersonalReportsByRange(startDate, endDate)
            ]);

            setWorkers(workersData);
            setReports(reportsData);
        } catch (e) {
            console.error("Error loading worker hours data:", e);
        } finally {
            setLoading(false);
        }
    };

    const distribution = useMemo(() => {
        const grouped: Record<string, GroupedData> = {};

        // 1. Agrupar por trabajador
        reports.forEach(r => {
            const worker = workers.find(w => w.id === r.workerId);
            const workerName = worker?.name || "Desconocido";

            if (!grouped[r.workerId]) {
                grouped[r.workerId] = {
                    workerId: r.workerId,
                    workerName,
                    totalWorkerHours: 0,
                    centers: []
                };
            }

            const workerGroup = grouped[r.workerId];
            workerGroup.totalWorkerHours += r.hours;

            // 2. Agrupar por Centro
            const centerId = r.costCenterId || 'none';
            const centerName = r.costCenterName || 'Sin Centro';
            let centerGroup = workerGroup.centers.find(c => c.centerId === centerId);

            if (!centerGroup) {
                centerGroup = { centerId, centerName, machines: [] };
                workerGroup.centers.push(centerGroup);
            }

            // 3. Agrupar por Máquina
            const machineId = r.machineId || 'none';
            const machineName = r.machineName || 'General';
            let machineEntry = centerGroup.machines.find(m => m.machineId === machineId);

            if (!machineEntry) {
                machineEntry = { machineId, machineName, hours: 0, ratio: 0 };
                centerGroup.machines.push(machineEntry);
            }

            machineEntry.hours += r.hours;
        });

        // 4. Calcular Ratios (tanto por uno)
        const finalData = Object.values(grouped).sort((a, b) => a.workerName.localeCompare(b.workerName));
        
        finalData.forEach(worker => {
            worker.centers.forEach(center => {
                center.machines.forEach(machine => {
                    machine.ratio = worker.totalWorkerHours > 0 
                        ? Number((machine.hours / worker.totalWorkerHours).toFixed(4)) 
                        : 0;
                });
            });
        });

        return finalData;
    }, [reports, workers]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
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
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 9pt !important;
                    }
                    .printable-table th, .printable-table td {
                        border: 0.1pt solid #ccc !important;
                        padding: 6px 4px !important;
                    }
                    .worker-row {
                        background-color: #f8fafc !important;
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
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Horas por Trabajador</h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <Clock size={10}/> Coeficientes de Reparto Mensual
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
                        <Printer size={18}/> <span className="hidden sm:inline">Imprimir</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container">
                {loading ? (
                    <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin mb-4 text-green-500" size={48} />
                        <p className="font-black uppercase text-xs tracking-widest">Calculando repartos...</p>
                    </div>
                ) : distribution.length === 0 ? (
                    <div className="py-40 text-center text-slate-400">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase text-xs">No hay datos de trabajo en este mes</p>
                    </div>
                ) : (
                    <div>
                        <div className="mb-6 hidden print:block border-b-2 border-slate-900 pb-4">
                            <h2 className="text-2xl font-black text-slate-900 uppercase">ARIDOS MARRAQUE - Coeficientes Reparto Personal</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Periodo: {new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        <table className="w-full border-collapse printable-table">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                                    <th className="p-3 border border-slate-700 text-left">Trabajador / Centro / Máquina</th>
                                    <th className="p-3 border border-slate-700 text-center w-24">Horas</th>
                                    <th className="p-3 border border-slate-700 text-center w-32">Coeficiente (Ratio)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distribution.map(worker => (
                                    <React.Fragment key={worker.workerId}>
                                        {/* Fila del Trabajador (Totalizador) */}
                                        <tr className="worker-row bg-slate-50">
                                            <td className="p-3 border border-slate-200 font-black text-slate-900 flex items-center gap-2">
                                                <User size={14} className="text-blue-600" /> {worker.workerName}
                                            </td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-blue-700 bg-blue-50/30">
                                                {worker.totalWorkerHours.toFixed(1)}
                                            </td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-slate-400">
                                                1,0000
                                            </td>
                                        </tr>
                                        {/* Desglose por Centro y Máquina */}
                                        {worker.centers.map(center => (
                                            <React.Fragment key={center.centerId}>
                                                {center.machines.map((machine, mIdx) => (
                                                    <tr key={`${center.centerId}-${machine.machineId}`} className="hover:bg-slate-50/50">
                                                        <td className="p-2 pl-10 border border-slate-100 text-slate-600 flex flex-col">
                                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-800">
                                                                <Truck size={12} className="text-slate-400" /> {machine.machineName}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase font-black ml-5">
                                                                <Factory size={10} /> {center.centerName}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 border border-slate-100 text-center font-mono text-xs text-slate-600">
                                                            {machine.hours.toFixed(1)}
                                                        </td>
                                                        <td className="p-2 border border-slate-100 text-center font-mono text-sm font-black text-green-700 bg-green-50/10">
                                                            {machine.ratio.toFixed(4)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-8 border-t pt-6 no-print">
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <h4 className="font-black text-blue-800 text-xs uppercase mb-2">Información de Cálculo</h4>
                                <p className="text-[10px] text-blue-600 leading-relaxed italic">
                                    Este listado agrupa todas las horas de los <b>Partes de Trabajo Personales</b> del mes. 
                                    El coeficiente se obtiene dividiendo las horas imputadas a una máquina entre el total de horas que el trabajador ha registrado ese mes.
                                    Utilice estos valores para repartir el coste salarial mensual del operario entre los distintos centros y activos.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

