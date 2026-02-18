import React, { useState, useEffect, useMemo } from 'react';
import { getAllMachines, getWorkers } from '../../services/db';
import { Machine, Worker } from '../../types';
import { ArrowLeft, Loader2, User, Truck, ClipboardList, Printer, ShieldCheck } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const MaintenanceResponsiblesReport: React.FC<Props> = ({ onBack }) => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [mData, wData] = await Promise.all([
                    getAllMachines(false),
                    getWorkers(false)
                ]);
                setMachines(mData);
                setWorkers(wData);
            } catch (e) {
                console.error("Error cargando responsables:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const machinesWithMaintenance = useMemo(() => {
        return machines
            .filter(m => m.maintenanceDefs && m.maintenanceDefs.length > 0)
            .sort((a, b) => (a.companyCode || a.name).localeCompare(b.companyCode || b.name));
    }, [machines]);

    const getWorkerName = (id?: string) => {
        if (!id) return "SIN ASIGNAR";
        const w = workers.find(work => work.id === id);
        return w ? w.name : "DESCONOCIDO";
    };

    if (loading) {
        return (
            <div className="py-40 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
                <p className="font-black uppercase text-xs tracking-widest">Generando listado de responsables...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    header, .no-print { display: none !important; }
                    .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; }
                    .printable-table { width: 100% !important; border-collapse: collapse !important; font-size: 10pt !important; }
                    .printable-table th, .printable-table td { border: 1px solid #ddd !important; padding: 8px !important; }
                }
            `}} />

            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm no-print">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Responsables de Mantenimiento</h3>
                        <p className="text-[10px] font-bold text-blue-600 uppercase mt-1 tracking-widest flex items-center gap-1">
                            <ShieldCheck size={10}/> Auditoría de Asignaciones Técnicas
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => window.print()}
                    className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2 text-xs font-black uppercase"
                >
                    <Printer size={18}/> <span className="hidden sm:inline">Imprimir</span>
                </button>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-slate-100 mx-1 print-container">
                <div className="hidden print:block mb-6 border-b pb-4">
                    <h2 className="text-xl font-black text-slate-900 uppercase">ARIDOS MARRAQUE - Listado de Responsables por Unidad</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Solo máquinas con plan de mantenimiento activo</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse printable-table text-left">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest print:bg-slate-100 print:text-black">
                                <th className="p-4 border-b border-slate-700 w-16">Cód.</th>
                                <th className="p-4 border-b border-slate-700">Máquina / Unidad</th>
                                <th className="p-4 border-b border-slate-700">Responsable Asignado</th>
                                <th className="p-4 border-b border-slate-700 text-center w-32">Tareas Programadas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {machinesWithMaintenance.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-mono font-bold text-blue-600 text-sm whitespace-nowrap">
                                        {m.companyCode || '---'}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-100 text-slate-400 rounded-lg no-print">
                                                <Truck size={16}/>
                                            </div>
                                            <span className="font-black text-slate-800 text-xs uppercase">{m.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 no-print">
                                                <User size={16}/>
                                            </div>
                                            <span className="uppercase text-xs">{getWorkerName(m.responsibleWorkerId)}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-black text-[10px] border border-slate-200">
                                            {m.maintenanceDefs.length} TAREAS
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {machinesWithMaintenance.length === 0 ? (
                    <div className="py-20 text-center text-slate-300">
                        <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase text-xs">No se han encontrado máquinas con planes de mantenimiento configurados</p>
                    </div>
                ) : (
                    <div className="mt-8 pt-4 border-t border-slate-100 text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Total Unidades Auditadas: {machinesWithMaintenance.length}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
