import React, { useState, useEffect, useMemo } from 'react';
import { getWorkers, getAllPersonalReportsByRange, getAllMachines, getCostCenters } from '../../services/db';
import { Worker, PersonalReport, Machine, CostCenter } from '../../types';
import { ArrowLeft, Loader2, Calendar, Printer, User, Clock, Factory, Truck, FileSpreadsheet, Upload, CheckCircle2, Sigma, TableProperties } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
    onBack: () => void;
}

interface ExcelCost {
    name: string;
    salary640: number;
    ss642: number;
}

interface GroupedData {
    workerId: string;
    workerName: string;
    totalWorkerHours: number;
    salary640: number;
    ss642: number;
    isAdmon?: boolean;
    centers: {
        centerId: string;
        centerName: string;
        machines: {
            machineId: string;
            machineName: string;
            hours: number;
            ratio: number;
            lineSalary: number;
            lineSS: number;
        }[];
    }[];
}

interface SummaryUnit {
    centerCode: string;
    machineCode: string;
    totalSalary: number;
    totalSS: number;
}

// Función para normalizar nombres y evitar fallos de coincidencia
const normalizeName = (name: string) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/\s+/g, ' ')           // Quitar espacios dobles
        .trim();
};

export const WorkerHoursDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [allCenters, setAllCenters] = useState<CostCenter[]>([]);
    const [reports, setReports] = useState<PersonalReport[]>([]);
    const [excelCosts, setExcelCosts] = useState<Record<string, ExcelCost>>({});
    const [fileName, setFileName] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const [workersData, reportsData, machinesData, centersData] = await Promise.all([
                getWorkers(false),
                getAllPersonalReportsByRange(startDate, endDate),
                getAllMachines(false),
                getCostCenters()
            ]);

            setWorkers(workersData);
            setReports(reportsData);
            setAllMachines(machinesData);
            setAllCenters(centersData);
        } catch (e) {
            console.error("Error cargando datos:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                const costsMap: Record<string, ExcelCost> = {};

                // Procesamiento de columnas: C=Nombre(2), D=640(3), I(8), L(11), N(13)
                data.forEach((row, idx) => {
                    if (idx < 1) return; 
                    
                    const rawName = row[2]?.toString().trim();
                    if (!rawName || rawName === "TOTAL" || rawName === "TRABAJADOR") return;

                    const salary640 = parseFloat(row[3]) || 0;
                    const valI = parseFloat(row[8]) || 0;
                    const valL = parseFloat(row[11]) || 0;
                    const valN = parseFloat(row[13]) || 0;
                    
                    const ss642 = valI - valL - valN;

                    costsMap[normalizeName(rawName)] = {
                        name: rawName,
                        salary640,
                        ss642
                    };
                });

                setExcelCosts(costsMap);
            } catch (err) {
                alert("Error al leer el Excel.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const distribution = useMemo(() => {
        const grouped: Record<string, GroupedData> = {};
        const matchedExcelKeys = new Set<string>();

        // 1. Procesar primero los trabajadores que tienen partes registrados
        reports.forEach(r => {
            const worker = workers.find(w => w.id === r.workerId);
            const workerName = worker?.name || "Desconocido";
            const normKey = normalizeName(workerName);

            if (!grouped[r.workerId]) {
                const excelData = excelCosts[normKey];
                if (excelData) matchedExcelKeys.add(normKey);

                grouped[r.workerId] = {
                    workerId: r.workerId,
                    workerName,
                    totalWorkerHours: 0,
                    salary640: excelData?.salary640 || 0,
                    ss642: excelData?.ss642 || 0,
                    centers: []
                };
            }

            const workerGroup = grouped[r.workerId];
            workerGroup.totalWorkerHours += r.hours;

            const centerId = r.costCenterId || 'none';
            const centerName = r.costCenterName || 'Sin Centro';
            let centerGroup = workerGroup.centers.find(c => c.centerId === centerId);

            if (!centerGroup) {
                centerGroup = { centerId, centerName, machines: [] };
                workerGroup.centers.push(centerGroup);
            }

            const machineId = r.machineId || 'none';
            const machineName = r.machineName || 'General';
            let machineEntry = centerGroup.machines.find(m => m.machineId === machineId);

            if (!machineEntry) {
                machineEntry = { machineId, machineName, hours: 0, ratio: 0, lineSalary: 0, lineSS: 0 };
                centerGroup.machines.push(machineEntry);
            }

            machineEntry.hours += r.hours;
        });

        // 2. Procesar trabajadores del Excel que NO tienen partes registrados
        Object.entries(excelCosts).forEach(([normKey, data]) => {
            if (!matchedExcelKeys.has(normKey)) {
                const dbWorker = workers.find(w => normalizeName(w.name) === normKey);
                const id = dbWorker ? dbWorker.id : `admon-${normKey}`;
                
                grouped[id] = {
                    workerId: id,
                    workerName: data.name,
                    totalWorkerHours: 0,
                    salary640: data.salary640,
                    ss642: data.ss642,
                    isAdmon: true,
                    centers: [{
                        centerId: 'admon_center',
                        centerName: 'ADMON',
                        machines: [{
                            machineId: 'office',
                            machineName: 'ADMON',
                            hours: 0,
                            ratio: 1, 
                            lineSalary: data.salary640,
                            lineSS: data.ss642
                        }]
                    }]
                };
            }
        });

        // 3. Cálculo de Ratios y Reparto Final
        const finalData = Object.values(grouped).sort((a, b) => a.workerName.localeCompare(b.workerName));
        
        finalData.forEach(worker => {
            worker.centers.forEach(center => {
                center.machines.forEach(machine => {
                    if (worker.totalWorkerHours > 0) {
                        machine.ratio = Number((machine.hours / worker.totalWorkerHours).toFixed(4));
                        machine.lineSalary = Number((worker.salary640 * machine.ratio).toFixed(2));
                        machine.lineSS = Number((worker.ss642 * machine.ratio).toFixed(2));
                    }
                });
            });
        });

        return finalData;
    }, [reports, workers, excelCosts]);

    const summaryByUnit = useMemo(() => {
        const units: Record<string, SummaryUnit> = {};

        distribution.forEach(worker => {
            worker.centers.forEach(center => {
                center.machines.forEach(machine => {
                    const dbMachine = allMachines.find(m => m.id === machine.machineId);
                    
                    // Lógica ADMON: si la máquina tiene marcada adminExpenses o el trabajador es ADMON sin horas
                    const isActuallyAdmon = dbMachine?.adminExpenses || worker.isAdmon;
                    
                    const centerKey = isActuallyAdmon ? 'ADMON' : (center.centerId || 'N/A');
                    const machineKey = isActuallyAdmon ? 'ADMON' : (machine.machineId || 'N/A');
                    const aggKey = `${centerKey}-${machineKey}`;

                    if (!units[aggKey]) {
                        // Obtener códigos
                        let mCode = "GENERAL";
                        if (isActuallyAdmon) {
                            mCode = "ADMON";
                        } else if (dbMachine) {
                            mCode = dbMachine.companyCode || dbMachine.name;
                        }

                        let cCode = "N/A";
                        if (isActuallyAdmon) {
                            cCode = "ADMON";
                        } else {
                            const dbCenter = allCenters.find(c => c.id === center.centerId);
                            cCode = dbCenter ? dbCenter.name.substring(0, 10).toUpperCase() : "N/A";
                        }

                        units[aggKey] = {
                            centerCode: cCode,
                            machineCode: mCode,
                            totalSalary: 0,
                            totalSS: 0
                        };
                    }

                    units[aggKey].totalSalary += machine.lineSalary;
                    units[aggKey].totalSS += machine.lineSS;
                });
            });
        });

        return Object.values(units).sort((a, b) => a.centerCode.localeCompare(b.centerCode) || a.machineCode.localeCompare(b.machineCode));
    }, [distribution, allMachines, allCenters]);

    const grandTotals = useMemo(() => {
        return distribution.reduce((acc, w) => ({
            salary640: acc.salary640 + w.salary640,
            ss642: acc.ss642 + w.ss642
        }), { salary640: 0, ss642: 0 });
    }, [distribution]);

    const handlePrint = () => window.print();

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A3 landscape; margin: 1cm; }
                    body { background: white !important; }
                    header, .no-print { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
                    .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; }
                    .printable-table { width: 100% !important; border-collapse: collapse !important; font-size: 8pt !important; }
                    .printable-table th, .printable-table td { border: 0.1pt solid #ccc !important; padding: 4px 2px !important; }
                    .worker-row { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                    .summary-header { background-color: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; }
                }
            `}} />

            {/* HEADER NO PRINT */}
            <div className="flex flex-col gap-4 border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Horas y Costes Personal</h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                                <Clock size={10}/> Reparto de Nóminas y Seguridad Social
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
                                className="pl-10 pr-4 py-2 border rounded-xl font-bold text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 text-sm outline-none"
                            />
                        </div>
                        <button onClick={handlePrint} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2 text-xs font-black uppercase">
                            <Printer size={18}/> <span className="hidden sm:inline">Imprimir A3</span>
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col sm:flex-row items-center gap-4 transition-all hover:border-indigo-300">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><FileSpreadsheet size={24}/></div>
                    <div className="flex-1 text-center sm:text-left">
                        <h4 className="text-sm font-black text-slate-700 uppercase">Importación de Costes</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Fórmula SS: Columna I - L - N</p>
                    </div>
                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-md transition-all active:scale-95">
                        <Upload size={14}/> {fileName ? 'Cambiar Excel' : 'Subir Excel'}
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {/* TABLA 1: DETALLE POR TRABAJADOR */}
            <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container overflow-x-auto">
                <div className="mb-6 flex items-center gap-2 border-b pb-4">
                    <User className="text-blue-600" size={24} />
                    <h4 className="font-black text-slate-800 uppercase tracking-tight">I. Detalle de Reparto por Trabajador</h4>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
                        <p className="font-black uppercase text-xs tracking-widest text-center">Cruzando datos...</p>
                    </div>
                ) : distribution.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <p className="font-black uppercase text-xs">Sin datos para mostrar</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse printable-table min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                                <th className="p-3 border border-slate-700 text-left w-64">Trabajador / Centro / Máquina</th>
                                <th className="p-3 border border-slate-700 text-center w-24">Horas</th>
                                <th className="p-3 border border-slate-700 text-center w-32">Ratio</th>
                                <th className="p-3 border border-slate-700 text-center w-32 bg-slate-800">Nóminas 640 (€)</th>
                                <th className="p-3 border border-slate-700 text-center w-32 bg-slate-800">S. Sociales 642 (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {distribution.map(worker => (
                                <React.Fragment key={worker.workerId}>
                                    <tr className="worker-row bg-slate-50">
                                        <td className="p-3 border border-slate-200 font-black text-slate-900 flex items-center gap-2">
                                            <User size={14} className="text-blue-600 flex-shrink-0" /> 
                                            <span className="truncate">{worker.workerName}</span>
                                            {worker.isAdmon && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 rounded uppercase ml-auto">ADMON</span>}
                                        </td>
                                        <td className="p-3 border border-slate-200 text-center font-black text-blue-700">
                                            {worker.totalWorkerHours > 0 ? `${worker.totalWorkerHours.toFixed(1)}h` : '-'}
                                        </td>
                                        <td className="p-3 border border-slate-200 text-center font-black text-slate-400">1,0000</td>
                                        <td className="p-3 border border-slate-200 text-center font-black text-slate-800 bg-slate-100/30">
                                            {worker.salary640.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                        </td>
                                        <td className="p-3 border border-slate-200 text-center font-black text-slate-800 bg-slate-100/30">
                                            {worker.ss642.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                        </td>
                                    </tr>
                                    {worker.centers.map(center => (
                                        <React.Fragment key={center.centerId}>
                                            {center.machines.map((machine) => (
                                                <tr key={`${center.centerId}-${machine.machineId}`} className="hover:bg-slate-50/50">
                                                    <td className="p-2 pl-12 border border-slate-100 text-slate-600 flex flex-col">
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800">
                                                            <Truck size={10} className="text-slate-400 flex-shrink-0" /> {machine.machineName}
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[8px] text-slate-400 uppercase font-black ml-4">
                                                            <Factory size={8} /> {center.centerName}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border border-slate-100 text-center font-mono text-[10px] text-slate-500">
                                                        {machine.hours > 0 ? `${machine.hours.toFixed(1)}h` : '-'}
                                                    </td>
                                                    <td className="p-2 border border-slate-100 text-center font-mono text-[10px] font-bold text-slate-800">
                                                        {machine.ratio.toFixed(4)}
                                                    </td>
                                                    <td className="p-2 border border-slate-100 text-center font-mono text-[10px] font-black text-green-700 bg-green-50/10">
                                                        {machine.lineSalary.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                    </td>
                                                    <td className="p-2 border border-slate-100 text-center font-mono text-[10px] font-black text-indigo-700 bg-indigo-50/10">
                                                        {machine.lineSS.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-900 text-white font-black uppercase text-[11px]">
                                <td className="p-3 border border-slate-800 text-right pr-6" colSpan={3}>
                                    <div className="flex items-center justify-end gap-2">
                                        <Sigma size={16} className="text-amber-500"/> TOTALES ACUMULADOS
                                    </div>
                                </td>
                                <td className="p-3 border border-slate-800 text-center bg-slate-800">
                                    {grandTotals.salary640.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                </td>
                                <td className="p-3 border border-slate-800 text-center bg-slate-800">
                                    {grandTotals.ss642.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            {/* TABLA 2: RESUMEN AGRUPADO POR UNIDAD */}
            {!loading && summaryByUnit.length > 0 && (
                <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container overflow-x-auto">
                    <div className="mb-6 flex items-center gap-2 border-b pb-4">
                        <TableProperties className="text-indigo-600" size={24} />
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">II. Resumen de Costes por Centro y Máquina</h4>
                    </div>

                    <table className="w-full border-collapse printable-table min-w-[800px]">
                        <thead>
                            <tr className="bg-indigo-900 text-white text-[10px] font-black uppercase tracking-wider">
                                <th className="p-3 border border-indigo-800 text-left">Centro de Coste (Cod)</th>
                                <th className="p-3 border border-indigo-800 text-left">Máquina (Cod)</th>
                                <th className="p-3 border border-indigo-800 text-center w-40 bg-indigo-950">Suma Nóminas 640 (€)</th>
                                <th className="p-3 border border-indigo-800 text-center w-40 bg-indigo-950">Suma S. Sociales 642 (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryByUnit.map((unit, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className="p-3 border border-slate-200 font-bold text-slate-700 text-xs">
                                        <div className="flex items-center gap-2">
                                            <Factory size={12} className="text-slate-400" />
                                            {unit.centerCode}
                                        </div>
                                    </td>
                                    <td className="p-3 border border-slate-200 font-black text-slate-900 text-xs">
                                        <div className="flex items-center gap-2">
                                            <Truck size={12} className="text-indigo-500" />
                                            {unit.machineCode}
                                        </div>
                                    </td>
                                    <td className="p-3 border border-slate-200 text-center font-mono font-black text-green-700 text-xs">
                                        {unit.totalSalary.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                    </td>
                                    <td className="p-3 border border-slate-200 text-center font-mono font-black text-indigo-700 text-xs">
                                        {unit.totalSS.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white font-black uppercase text-[11px]">
                            <tr>
                                <td className="p-3 border border-slate-800 text-right pr-6" colSpan={2}>
                                    TOTALES VERIFICADOS
                                </td>
                                <td className="p-3 border border-slate-800 text-center">
                                    {summaryByUnit.reduce((acc, u) => acc + u.totalSalary, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                </td>
                                <td className="p-3 border border-slate-800 text-center">
                                    {summaryByUnit.reduce((acc, u) => acc + u.totalSS, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl no-print">
                        <p className="text-[10px] text-indigo-700 font-bold leading-relaxed italic">
                            * El resumen agrupa los costes imputados a cada unidad técnica. Las máquinas marcadas con "Gastos ADMON" en su ficha han sido consolidadas en el grupo ADMON de forma automática.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
