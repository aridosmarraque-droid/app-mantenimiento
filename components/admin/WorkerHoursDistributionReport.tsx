import React, { useState, useEffect, useMemo } from 'react';
import { getWorkers, getAllPersonalReportsByRange, getAllMachines, getCostCenters } from '../../services/db';
import { Worker, PersonalReport, Machine, CostCenter } from '../../types';
// Fix: Added missing 'X' icon to lucide-react imports
import { ArrowLeft, Loader2, Calendar, Printer, User, Clock, Factory, Truck, FileSpreadsheet, Upload, CheckCircle2, Sigma, TableProperties, Play, Download, Eye, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
    onBack: () => void;
}

interface ExcelCost {
    name: string;
    salary640: number;
    ss642: number;
}

interface ExcelTotals {
    remuneracionesE: number;
    planPensionesF: number;
    ssTrabajadorJ: number;
    retencionesK: number;
    valI: number;
    valL: number;
    valN: number;
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

const normalizeName = (name: string) => {
    if (!name) return "";
    return name
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

export const WorkerHoursDistributionReport: React.FC<Props> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [allCenters, setAllCenters] = useState<CostCenter[]>([]);
    const [reports, setReports] = useState<PersonalReport[]>([]);
    const [excelCosts, setExcelCosts] = useState<Record<string, ExcelCost>>({});
    const [excelTotals, setExcelTotals] = useState<ExcelTotals | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    
    const [isExecuted, setIsExecuted] = useState(false);
    const [showTables, setShowTables] = useState(false);

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
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                const costsMap: Record<string, ExcelCost> = {};
                let totals: ExcelTotals | null = null;

                data.forEach((row, idx) => {
                    if (idx < 1) return; 
                    const rawName = row[2]?.toString().trim() || "";
                    const upperName = rawName.toUpperCase();

                    // Detectar fila de totales para el archivo TXT
                    if (upperName.includes("TOTAL") || upperName.includes("SUMA")) {
                        totals = {
                            remuneracionesE: parseFloat(row[4]) || 0,
                            planPensionesF: parseFloat(row[5]) || 0,
                            ssTrabajadorJ: parseFloat(row[9]) || 0,
                            retencionesK: parseFloat(row[10]) || 0,
                            valI: parseFloat(row[8]) || 0,
                            valL: parseFloat(row[11]) || 0,
                            valN: parseFloat(row[13]) || 0
                        };
                        return;
                    }

                    if (!rawName || upperName === "TRABAJADOR") return;

                    const salary640 = parseFloat(row[3]) || 0;
                    const valI = parseFloat(row[8]) || 0;
                    const valL = parseFloat(row[11]) || 0;
                    const valN = parseFloat(row[13]) || 0;
                    const ss642 = valI - valL - valN;

                    if (salary640 === 0 && valI === 0) return;

                    costsMap[normalizeName(rawName)] = { name: rawName, salary640, ss642 };
                });

                setExcelCosts(costsMap);
                setExcelTotals(totals);
                setIsExecuted(false);
            } catch (err) {
                alert("Error al leer el Excel.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const distribution = useMemo(() => {
        const grouped: Record<string, GroupedData> = {};
        const matchedExcelKeys = new Set<string>();

        reports.forEach(r => {
            const dbWorker = workers.find(w => w.id === r.workerId);
            const workerName = dbWorker?.name || "Desconocido";
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

        Object.entries(excelCosts).forEach(([normKey, data]) => {
            if (!matchedExcelKeys.has(normKey)) {
                const dbWorker = workers.find(w => normalizeName(w.name) === normKey);
                if (dbWorker && grouped[dbWorker.id]) {
                    grouped[dbWorker.id].salary640 = data.salary640;
                    grouped[dbWorker.id].ss642 = data.ss642;
                    matchedExcelKeys.add(normKey);
                    return;
                }
                const id = dbWorker ? dbWorker.id : `admon-${normKey}`;
                grouped[id] = {
                    workerId: id, workerName: data.name, totalWorkerHours: 0,
                    salary640: data.salary640, ss642: data.ss642, isAdmon: true,
                    centers: [{
                        centerId: 'admon_center', centerName: 'ADMON',
                        machines: [{ machineId: 'office', machineName: 'ADMON', hours: 0, ratio: 1, lineSalary: data.salary640, lineSS: data.ss642 }]
                    }]
                };
            }
        });

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
                    const isActuallyAdmon = dbMachine?.adminExpenses || worker.isAdmon;
                    
                    const centerKey = isActuallyAdmon ? 'ADMON' : (center.centerId || 'N/A');
                    const machineKey = isActuallyAdmon ? 'ADMON' : (machine.machineId || 'N/A');
                    const aggKey = `${centerKey}-${machineKey}`;

                    if (!units[aggKey]) {
                        let mCode = "GENERAL";
                        if (isActuallyAdmon) mCode = "ADMON";
                        else if (dbMachine) mCode = dbMachine.companyCode || dbMachine.name;

                        let cCode = "N/A";
                        if (isActuallyAdmon) cCode = "ADMON";
                        else {
                            const dbCenter = allCenters.find(c => c.id === center.centerId);
                            cCode = dbCenter ? (dbCenter.companyCode || dbCenter.name.substring(0, 10).toUpperCase()) : "N/A";
                        }

                        units[aggKey] = { centerCode: cCode, machineCode: mCode, totalSalary: 0, totalSS: 0 };
                    }
                    units[aggKey].totalSalary += machine.lineSalary;
                    units[aggKey].totalSS += machine.lineSS;
                });
            });
        });
        return Object.values(units).sort((a, b) => a.centerCode.localeCompare(b.centerCode) || a.machineCode.localeCompare(b.machineCode));
    }, [distribution, allMachines, allCenters]);

    const handleExecute = () => {
        if (!excelTotals) {
            alert("No se ha podido detectar la fila de totales en el Excel. Revise el formato.");
            return;
        }
        
        setIsExecuted(true);
        generateTxtFiles();
    };

    const downloadFile = (filename: string, content: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const generateTxtFiles = () => {
        if (!selectedMonth || !excelTotals) return;

        const [year, month] = selectedMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0);
        const dateStr = `${year}${String(month).padStart(2, '0')}${String(lastDay.getDate()).padStart(2, '0')}`;
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const monthYearStr = `${monthNames[month - 1]} ${year}`;

        // 1. JOURNALENTRIES.TXT
        let entriesContent = "RecordKey\tJdtNum\tAutoVAT\tDueDate\tMemo\tReferenceDate\tTaxDate\r\n";
        entriesContent += "RecordKey\tJdtNum\tAutoVAT\tDueDate\tMemo\tReferenceDate\tTaxDate\r\n";
        entriesContent += `1\t\ttNO\t${dateStr}\tNOMINAS ${monthYearStr}\t${dateStr}\t${dateStr}`;

        // 2. JOURNALENTRIES_LINES.TXT
        let linesContent = "RecordKey\tLineNum\tAccountCode\tNombre\tDebit\tCredit\tLineMemo\tTaxGroup\tRef1\tRef2\tCostingCode\r\n";
        linesContent += "RecordKey\tLineNum\tAccountCode\tNombre\tDebit\tCredit\tLineMemo\tTaxGroup\tRef1\tRef2\tCostingCode\r\n";

        // 640000 - Sueldos (Debe)
        summaryByUnit.forEach(unit => {
            const costingCode = unit.centerCode === "ADMON" ? "ADMON" : `${unit.centerCode}-${unit.machineCode}`;
            linesContent += `1\t\t640000\t\t${unit.totalSalary.toFixed(2)}\t0.00\tNOMINA ${monthYearStr}\t\t\t\t${costingCode}\r\n`;
        });

        // 475101 - Retenciones (Haber)
        linesContent += `1\t\t475101\t\t0.00\t${excelTotals.retencionesK.toFixed(2)}\tRETENCIONES ${monthYearStr}\t\t\t\t\r\n`;

        // 476000 - SS Trabajador (Haber)
        linesContent += `1\t\t476000\t\t0.00\t${excelTotals.ssTrabajadorJ.toFixed(2)}\tSEG. SOCIAL. TRABAJADOR ${monthYearStr}\t\t\t\t\r\n`;

        // 465000 - Remuneraciones (Haber)
        linesContent += `1\t\t465000\t\t0.00\t${excelTotals.remuneracionesE.toFixed(2)}\tREMUNERACIONES ${monthYearStr}\t\t\t\t\r\n`;

        // 642000 - SS Empresa (Debe)
        summaryByUnit.forEach(unit => {
            const costingCode = unit.centerCode === "ADMON" ? "ADMON" : `${unit.centerCode}-${unit.machineCode}`;
            linesContent += `1\t\t642000\t\t${unit.totalSS.toFixed(2)}\t0.00\tSEG. SOCIAL ${monthYearStr}\t\t\t\t${costingCode}\r\n`;
        });

        // 476000 - SS Empresa Global (Haber)
        const totalSSEmpresa = excelTotals.valI - excelTotals.valL - excelTotals.valN;
        linesContent += `1\t\t476000\t\t0.00\t${totalSSEmpresa.toFixed(2)}\tSEG. SOC. ${monthYearStr}\t\t\t\t\r\n`;

        // 466000 - Plan Pensiones (Haber)
        linesContent += `1\t\t466000\t\t0.00\t${excelTotals.planPensionesF.toFixed(2)}\tPLAN PENSIONES ${monthYearStr}\t\t\t\t\r\n`;

        downloadFile("JOURNALENTRIES.TXT", entriesContent);
        downloadFile("JOURNALENTRIES_LINES.TXT", linesContent);
    };

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A3 landscape; margin: 1cm; }
                    body { background: white !important; }
                    header, .no-print { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
                    .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; }
                    .printable-table { width: 100% !important; border-collapse: collapse !important; font-size: 7.5pt !important; }
                    .printable-table th, .printable-table td { border: 0.1pt solid #ccc !important; padding: 3px 2px !important; }
                    .worker-row { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                }
            `}} />

            <div className="flex flex-col gap-4 border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700"><ArrowLeft size={24} /></button>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Horas y Costes Personal</h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Generación de Asientos Contables TXT</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold bg-slate-50" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex items-center gap-4">
                        <FileSpreadsheet className="text-indigo-600" size={24}/>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-slate-700 uppercase truncate">1. Subir Excel de Costes</h4>
                            <p className="text-[9px] text-slate-500 font-medium">Archivo necesario para extraer totales de pasivos.</p>
                        </div>
                        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-md shrink-0">
                            <Upload size={14}/> {fileName ? 'Cambiar' : 'Subir'}
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${fileName ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'}`}>
                        <Play className={fileName ? 'text-blue-200' : ''} size={24}/>
                        <div className="flex-1">
                            <h4 className="text-sm font-black uppercase leading-none">2. Ejecutar y Generar</h4>
                            <p className={`text-[9px] font-medium mt-1 ${fileName ? 'text-blue-100' : 'text-slate-400'}`}>Calcula repartos y descarga archivos TXT.</p>
                        </div>
                        <button 
                            disabled={!fileName}
                            onClick={handleExecute}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${fileName ? 'bg-white text-blue-600 hover:bg-blue-50 active:scale-95 shadow-md' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                        >
                            Ejecutar Proceso
                        </button>
                    </div>
                </div>

                {isExecuted && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <button onClick={() => setShowTables(!showTables)} className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 border hover:bg-slate-200">
                            {showTables ? <X size={16}/> : <Eye size={16}/>}
                            {showTables ? 'Ocultar Tablas' : 'Ver Tablas / Imprimir'}
                        </button>
                        <button onClick={generateTxtFiles} className="flex-1 py-3 px-4 bg-green-100 text-green-700 border border-green-200 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-200">
                            <Download size={16}/> Re-descargar TXTs
                        </button>
                    </div>
                )}
            </div>

            {(showTables && !loading) ? (
                <>
                    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container overflow-x-auto relative">
                        <button onClick={() => window.print()} className="absolute top-6 right-6 p-2 bg-slate-900 text-white rounded-lg shadow-lg no-print hover:bg-black transition-all flex items-center gap-2 text-xs font-black uppercase">
                            <Printer size={16}/> Imprimir A3
                        </button>
                        
                        <div className="mb-6 flex items-center gap-2 border-b pb-4">
                            <User className="text-blue-600" size={24} />
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">I. Detalle de Reparto por Trabajador</h4>
                        </div>
                        <table className="w-full border-collapse printable-table min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase">
                                    <th className="p-3 border border-slate-700 text-left">Trabajador / Unidad</th>
                                    <th className="p-3 border border-slate-700 text-center">Horas</th>
                                    <th className="p-3 border border-slate-700 text-center">Ratio</th>
                                    <th className="p-3 border border-slate-700 text-center bg-slate-800">Nóminas 640 (€)</th>
                                    <th className="p-3 border border-slate-700 text-center bg-slate-800">S. Sociales 642 (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distribution.map(worker => (
                                    <React.Fragment key={worker.workerId}>
                                        <tr className="worker-row bg-slate-50">
                                            <td className="p-3 border border-slate-200 font-black text-slate-900 truncate">{worker.workerName}</td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-blue-700">{worker.totalWorkerHours}h</td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-slate-400">1,0000</td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-slate-800">{worker.salary640.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                            <td className="p-3 border border-slate-200 text-center font-black text-slate-800">{worker.ss642.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                        </tr>
                                        {worker.centers.map(center => center.machines.map(machine => (
                                            <tr key={`${center.centerId}-${machine.machineId}`} className="hover:bg-slate-50/50">
                                                <td className="p-2 pl-10 border border-slate-100 text-slate-600 text-[10px]">
                                                    <div className="font-bold">{machine.machineName}</div>
                                                    <div className="text-[8px] text-slate-400 uppercase font-black">{center.centerName}</div>
                                                </td>
                                                <td className="p-2 border border-slate-100 text-center text-[10px]">{machine.hours}h</td>
                                                <td className="p-2 border border-slate-100 text-center text-[10px]">{machine.ratio.toFixed(4)}</td>
                                                <td className="p-2 border border-slate-100 text-center text-[10px] font-black text-green-700">{machine.lineSalary.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                                <td className="p-2 border border-slate-100 text-center text-[10px] font-black text-indigo-700">{machine.lineSS.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                            </tr>
                                        )))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-auto print-container overflow-x-auto">
                        <div className="mb-6 flex items-center gap-2 border-b pb-4">
                            <TableProperties className="text-indigo-600" size={24} />
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">II. Resumen de Costes por Centro y Máquina</h4>
                        </div>
                        <table className="w-full border-collapse printable-table min-w-[800px]">
                            <thead>
                                <tr className="bg-indigo-900 text-white text-[10px] font-black uppercase">
                                    <th className="p-3 border border-indigo-800 text-left">Centro de Coste (Cod)</th>
                                    <th className="p-3 border border-indigo-800 text-left">Máquina (Cod)</th>
                                    <th className="p-3 border border-indigo-800 text-center w-40 bg-indigo-950">Suma Nóminas 640 (€)</th>
                                    <th className="p-3 border border-indigo-800 text-center w-40 bg-indigo-950">Suma S. Sociales 642 (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryByUnit.map((unit, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="p-3 border border-slate-200 font-bold text-slate-700 text-xs">{unit.centerCode}</td>
                                        <td className="p-3 border border-slate-200 font-black text-slate-900 text-xs">{unit.machineCode}</td>
                                        <td className="p-3 border border-slate-200 text-center font-mono font-black text-green-700 text-xs">{unit.totalSalary.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                        <td className="p-3 border border-slate-200 text-center font-mono font-black text-indigo-700 text-xs">{unit.totalSS.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white font-black uppercase text-[11px]">
                                <tr>
                                    <td className="p-3 border border-slate-800 text-right pr-6" colSpan={2}>TOTALES VERIFICADOS</td>
                                    <td className="p-3 border border-slate-800 text-center">{summaryByUnit.reduce((acc, u) => acc + u.totalSalary, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                    <td className="p-3 border border-slate-800 text-center">{summaryByUnit.reduce((acc, u) => acc + u.totalSS, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            ) : isExecuted && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 animate-in zoom-in-95 duration-500">
                    <CheckCircle2 size={64} className="text-green-500 mb-4" />
                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Proceso Finalizado</h4>
                    <p className="text-sm font-medium text-center max-w-sm mt-2">Los archivos de diario se han descargado. Puede revisar las tablas de reparto pulsando el botón superior.</p>
                </div>
            )}
            
            {loading && (
                <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
                    <p className="font-black uppercase text-xs tracking-widest">Calculando repartos técnicos...</p>
                </div>
            )}
        </div>
    );
};
