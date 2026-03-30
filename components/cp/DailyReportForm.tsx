
import React, { useState, useEffect } from 'react';
import { getLastCPReport, getWorkers } from '../../services/db';
import { CPDailyReport } from '../../types';
import { Save, ArrowLeft, Loader2, Calendar } from 'lucide-react';

interface Props {
    workerId: string;
    onSubmit: (data: Omit<CPDailyReport, 'id'>) => void;
    onBack: () => void;
}

export const DailyReportForm: React.FC<Props> = ({ workerId, onSubmit, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [workerName, setWorkerName] = useState('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Contadores
    const [crusherStart, setCrusherStart] = useState<number>(0);
    const [crusherEndHours, setCrusherEndHours] = useState<number | ''>('');
    const [crusherEndMinutes, setCrusherEndMinutes] = useState<number | ''>('');
    
    const [millsStart, setMillsStart] = useState<number>(0);
    const [millsEndHours, setMillsEndHours] = useState<number | ''>('');
    const [millsEndMinutes, setMillsEndMinutes] = useState<number | ''>('');

    const [comments, setComments] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [lastReport, workers] = await Promise.all([
                getLastCPReport(),
                getWorkers()
            ]);
            
            const w = workers.find(w => w.id === workerId);
            if (w) setWorkerName(w.name);

            if (lastReport) {
                // Las horas de inicio son las horas finales del último reporte
                setCrusherStart(lastReport.crusherEnd);
                setMillsStart(lastReport.millsEnd);
            } else {
                // Primera vez o sin datos
                setCrusherStart(0);
                setMillsStart(0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const validate = () => {
        const cEnd = Number(crusherEndHours) + (Number(crusherEndMinutes) || 0) / 60;
        const mEnd = Number(millsEndHours) + (Number(millsEndMinutes) || 0) / 60;

        if (cEnd < crusherStart) {
            alert("Las horas finales de Machacadora no pueden ser menores a las iniciales.");
            return false;
        }
        if (mEnd < millsStart) {
            alert("Las horas finales de Molinos no pueden ser menores a las iniciales.");
            return false;
        }
        if (Number(crusherEndMinutes) >= 60 || Number(millsEndMinutes) >= 60) {
            alert("Los minutos deben ser menores a 60.");
            return false;
        }
        return true;
    };

    const getDataObject = (): Omit<CPDailyReport, 'id'> => {
        const cEnd = Math.round((Number(crusherEndHours) + (Number(crusherEndMinutes) || 0) / 60) * 100) / 100;
        const mEnd = Math.round((Number(millsEndHours) + (Number(millsEndMinutes) || 0) / 60) * 100) / 100;
        return {
            date: new Date(date),
            workerId,
            crusherStart,
            crusherEnd: cEnd,
            millsStart,
            millsEnd: mEnd,
            comments
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || crusherEndHours === '' || millsEndHours === '') {
            alert("Por favor rellena todos los campos obligatorios.");
            return;
        }

        setIsSaving(true);
        // onSubmit en App.tsx manejará el envío de email
        onSubmit(getDataObject());
        // No seteamos isSaving a false aquí porque el padre desmontará el componente o mostrará éxito
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-amber-600" /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-screen bg-slate-50">
            {/* Header Form */}
            <div className="bg-amber-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <button type="button" onClick={onBack} className="p-1 hover:bg-amber-700 rounded">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Parte Diario Cantera</h1>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto w-full pb-20">
                {/* Date Selection */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Calendar size={16} className="text-amber-600"/> Fecha del Parte
                    </label>
                    <input 
                        type="date" 
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    />
                </div>

                {/* Machacadora Section */}
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-l-amber-500">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Machacadora</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio (Anterior)</label>
                            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 font-mono font-semibold border border-slate-200">
                                {crusherStart}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-amber-700 uppercase mb-1">Fin Jornada *</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-0.5">Horas</label>
                                    <input 
                                        type="number" 
                                        required
                                        min={Math.floor(crusherStart)}
                                        placeholder="0"
                                        value={crusherEndHours}
                                        onChange={e => setCrusherEndHours(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                        className="w-full p-3 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold text-lg"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-0.5">Minutos</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max="59"
                                        placeholder="0"
                                        value={crusherEndMinutes}
                                        onChange={e => setCrusherEndMinutes(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                        className="w-full p-3 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold text-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {crusherEndHours !== '' && (
                        <div className="mt-2 text-right text-xs text-amber-600 font-medium">
                            Total Producción: {(Math.round((Number(crusherEndHours) + (Number(crusherEndMinutes) || 0) / 60) * 100) / 100 - crusherStart).toFixed(2)} horas
                        </div>
                    )}
                </div>

                {/* Molinos Section */}
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-l-blue-500">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Molinos</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio (Anterior)</label>
                            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 font-mono font-semibold border border-slate-200">
                                {millsStart}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Fin Jornada *</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-0.5">Horas</label>
                                    <input 
                                        type="number" 
                                        required
                                        min={Math.floor(millsStart)}
                                        placeholder="0"
                                        value={millsEndHours}
                                        onChange={e => setMillsEndHours(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                        className="w-full p-3 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-0.5">Minutos</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max="59"
                                        placeholder="0"
                                        value={millsEndMinutes}
                                        onChange={e => setMillsEndMinutes(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                        className="w-full p-3 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {millsEndHours !== '' && (
                        <div className="mt-2 text-right text-xs text-blue-600 font-medium">
                            Total Producción: {(Math.round((Number(millsEndHours) + (Number(millsEndMinutes) || 0) / 60) * 100) / 100 - millsStart).toFixed(2)} horas
                        </div>
                    )}
                </div>

                {/* Comments */}
                <div className="bg-white p-4 rounded-xl shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Comentarios / Incidencias</label>
                    <textarea 
                        rows={3}
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        placeholder="Anotar paradas, averías leves, etc..."
                    />
                </div>

                <div className="mt-4">
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="w-full py-4 bg-slate-800 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-slate-900 active:transform active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                        {isSaving ? "Guardando y Enviando..." : "Guardar y Enviar Email"}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-2">
                        Se enviará una copia en PDF por correo electrónico inmediatamente.
                    </p>
                </div>
            </div>
        </form>
    );
};
