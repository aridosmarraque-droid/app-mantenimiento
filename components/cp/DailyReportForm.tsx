
import React, { useState, useEffect } from 'react';
import { getLastCPReport, getWorkers } from '../../services/db';
import { generateCPReportPDF } from '../../services/pdf';
import { sendEmail } from '../../services/api';
import { CPDailyReport, Worker } from '../../types';
import { Save, ArrowLeft, Loader2, Calendar, Mail } from 'lucide-react';

// ==========================================
// CONFIGURACIÓN DE CORREOS DE DESTINO
// ==========================================
// Modifica este array para cambiar quién recibe los partes.
const EMAILS_DESTINO = ['oficina@marraque.es']; 
// ==========================================

interface Props {
    workerId: string;
    onSubmit: (data: Omit<CPDailyReport, 'id'>) => void;
    onBack: () => void;
}

export const DailyReportForm: React.FC<Props> = ({ workerId, onSubmit, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [workerName, setWorkerName] = useState('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Contadores
    const [crusherStart, setCrusherStart] = useState<number>(0);
    const [crusherEnd, setCrusherEnd] = useState<number | ''>('');
    
    const [millsStart, setMillsStart] = useState<number>(0);
    const [millsEnd, setMillsEnd] = useState<number | ''>('');

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
        const cEnd = Number(crusherEnd);
        const mEnd = Number(millsEnd);

        if (cEnd < crusherStart) {
            alert("Las horas finales de Machacadora no pueden ser menores a las iniciales.");
            return false;
        }
        if (mEnd < millsStart) {
            alert("Las horas finales de Molinos no pueden ser menores a las iniciales.");
            return false;
        }
        return true;
    };

    const getDataObject = (): Omit<CPDailyReport, 'id'> => {
        return {
            date: new Date(date),
            workerId,
            crusherStart,
            crusherEnd: Number(crusherEnd),
            millsStart,
            millsEnd: Number(millsEnd),
            comments
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit(getDataObject());
    };

    const handleSaveAndSend = async () => {
        if (!validate() || crusherEnd === '' || millsEnd === '') {
            alert("Por favor rellena todos los campos obligatorios antes de enviar.");
            return;
        }

        if(!confirm(`¿Deseas guardar el parte y enviarlo por correo a ${EMAILS_DESTINO.join(', ')}?`)) return;

        setSendingEmail(true);
        const data = getDataObject();
        
        // 1. Guardar primero
        onSubmit(data);

        // 2. Generar PDF
        try {
            const pdfBase64 = generateCPReportPDF(data, workerName);
            
            // 3. Enviar Email
            const { success, error } = await sendEmail(
                EMAILS_DESTINO,
                `Parte Cantera - ${date} - ${workerName}`,
                `<p>Adjunto encontrarás el parte diario de producción de la planta de cantera pura.</p><p><strong>Fecha:</strong> ${date}</p><p><strong>Trabajador:</strong> ${workerName}</p>`,
                pdfBase64,
                `Parte_Cantera_${date}.pdf`
            );

            if (success) {
                alert("Parte guardado y enviado correctamente.");
            } else {
                alert("El parte se guardó, pero hubo un error enviando el email: " + error);
            }

        } catch (e) {
            console.error(e);
            alert("Error generando el reporte PDF.");
        } finally {
            setSendingEmail(false);
        }
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
                            <input 
                                type="number" 
                                required
                                min={crusherStart}
                                step="1"
                                placeholder="0"
                                value={crusherEnd}
                                onChange={e => setCrusherEnd(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                className="w-full p-3 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold text-lg"
                            />
                        </div>
                    </div>
                    {crusherEnd !== '' && (
                        <div className="mt-2 text-right text-xs text-amber-600 font-medium">
                            Total Producción: {Number(crusherEnd) - crusherStart} horas
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
                            <input 
                                type="number" 
                                required
                                min={millsStart}
                                step="1"
                                placeholder="0"
                                value={millsEnd}
                                onChange={e => setMillsEnd(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                                className="w-full p-3 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-lg"
                            />
                        </div>
                    </div>
                    {millsEnd !== '' && (
                        <div className="mt-2 text-right text-xs text-blue-600 font-medium">
                            Total Producción: {Number(millsEnd) - millsStart} horas
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

                <div className="flex flex-col gap-3">
                    <button 
                        type="button"
                        onClick={handleSaveAndSend}
                        disabled={sendingEmail}
                        className="w-full py-4 bg-slate-800 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-slate-900 active:transform active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {sendingEmail ? <Loader2 className="animate-spin" /> : <Mail size={24} />}
                        {sendingEmail ? "Generando y Enviando..." : "Guardar y Enviar Email"}
                    </button>
                    
                    <button 
                        type="submit" 
                        disabled={sendingEmail}
                        className="w-full py-3 bg-amber-100 text-amber-800 border-2 border-amber-200 rounded-xl font-bold text-lg flex justify-center items-center gap-2 hover:bg-amber-200"
                    >
                        <Save size={20} /> Solo Guardar
                    </button>
                </div>
            </div>
        </form>
    );
};

