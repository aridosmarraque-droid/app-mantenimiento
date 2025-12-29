
import React, { useState, useEffect } from 'react';
import { getLastCRReport, getWorkers } from '../../services/db';
import { CRDailyReport } from '../../types';
import { Save, ArrowLeft, Loader2, Calendar, Droplets, Waves } from 'lucide-react';

interface Props {
    workerId: string;
    onSubmit: (data: Omit<CRDailyReport, 'id'>) => void;
    onBack: () => void;
}

export const DailyReportFormCR: React.FC<Props> = ({ workerId, onSubmit, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Contadores con soporte decimal
    const [washingStart, setWashingStart] = useState<number>(0);
    const [washingEnd, setWashingEnd] = useState<number | ''>('');
    
    const [triturationStart, setTriturationStart] = useState<number>(0);
    const [triturationEnd, setTriturationEnd] = useState<number | ''>('');

    const [comments, setComments] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const lastReport = await getLastCRReport();
            if (lastReport) {
                setWashingStart(lastReport.washingEnd);
                setTriturationStart(lastReport.triturationEnd);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const validate = () => {
        if (washingEnd !== '' && Number(washingEnd) < washingStart) {
            alert("Las horas finales de Lavado no pueden ser menores a las iniciales.");
            return false;
        }
        if (triturationEnd !== '' && Number(triturationEnd) < triturationStart) {
            alert("Las horas finales de Trituración no pueden ser menores a las iniciales.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || washingEnd === '' || triturationEnd === '') {
            alert("Por favor rellena todos los campos obligatorios.");
            return;
        }

        setIsSaving(true);
        onSubmit({
            date: new Date(date),
            workerId,
            washingStart,
            washingEnd: Number(washingEnd),
            triturationStart,
            triturationEnd: Number(triturationEnd),
            comments
        });
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-screen bg-slate-50">
            <div className="bg-teal-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <button type="button" onClick={onBack} className="p-1 hover:bg-teal-800 rounded">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Parte Canto Rodado</h1>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto w-full pb-20">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Calendar size={16} className="text-teal-600"/> Fecha del Parte
                    </label>
                    <input 
                        type="date" 
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-slate-50"
                    />
                </div>

                {/* Lavado */}
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-l-teal-500">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <Waves className="text-teal-500" size={20}/> Lavado
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio (Anterior)</label>
                            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 font-mono font-semibold border border-slate-200">
                                {washingStart.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-teal-700 uppercase mb-1">Fin Jornada *</label>
                            <input 
                                type="number" 
                                required
                                min={washingStart}
                                step="0.01"
                                placeholder="0.00"
                                value={washingEnd}
                                onChange={e => setWashingEnd(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full p-3 bg-white border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono font-bold text-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Trituración */}
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-l-blue-500">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <Droplets className="text-blue-500" size={20}/> Trituración
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio (Anterior)</label>
                            <div className="p-3 bg-slate-100 rounded-lg text-slate-600 font-mono font-semibold border border-slate-200">
                                {triturationStart.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Fin Jornada *</label>
                            <input 
                                type="number" 
                                required
                                min={triturationStart}
                                step="0.01"
                                placeholder="0.00"
                                value={triturationEnd}
                                onChange={e => setTriturationEnd(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full p-3 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Comentarios / Incidencias</label>
                    <textarea 
                        rows={3}
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        placeholder="Anotar paradas, limpieza de filtros, etc..."
                    />
                </div>

                <div className="mt-4">
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="w-full py-4 bg-teal-800 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-teal-900 active:transform active:scale-95 transition-all disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                        {isSaving ? "Guardando..." : "Guardar Parte"}
                    </button>
                </div>
            </div>
        </form>
    );
};
