
import React, { useState, useEffect } from 'react';
import { getWorkers, getAllMachines } from '../../services/db';
import { sendTestWhatsApp } from '../../services/whatsapp';
import { Worker, Machine } from '../../types';
import { 
    ArrowLeft, MessageSquare, Send, CheckCircle2, 
    AlertCircle, Phone, User, Truck, Loader2, ShieldCheck, 
    XCircle, CreditCard, ExternalLink, Settings2, Terminal, Copy, Code
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const WhatsAppConfig: React.FC<Props> = ({ onBack }) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const [wData, mData] = await Promise.all([getWorkers(false), getAllMachines(false)]);
            setWorkers(wData);
            setMachines(mData);
            setLoading(false);
        };
        load();
    }, []);

    const handleTest = async (worker: Worker) => {
        if (!worker.phone) {
            alert("Este trabajador no tiene teléfono registrado.");
            return;
        }
        setSendingId(worker.id);
        setLastError(null);
        
        try {
            const res: any = await sendTestWhatsApp(worker.phone);
            if (res.success) {
                alert(`✅ ¡Éxito! Mensaje enviado a ${worker.name}`);
            } else {
                setLastError(res.error);
            }
        } catch (e: any) {
            setLastError(e.message);
        } finally {
            setSendingId(null);
        }
    };

    const isTokenError = lastError?.includes('Token') || lastError?.includes('parameter');

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Canal WhatsApp</h3>
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck size={10}/> Servicio UltraMsg API
                    </p>
                </div>
            </div>

            {/* Error de Token (GET parameter) */}
            {isTokenError && (
                <div className="mx-1 p-5 bg-red-50 border-2 border-red-200 rounded-2xl space-y-4">
                    <div className="flex items-start gap-3 text-red-700">
                        <AlertCircle className="flex-shrink-0" />
                        <div>
                            <p className="font-black text-sm uppercase leading-tight">Error Crítico de Formato</p>
                            <p className="text-xs mt-1">UltraMsg rechaza el token porque no está en la URL de la llamada.</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-900 rounded-xl p-4 overflow-hidden">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Solución: Edita tu función en Supabase</p>
                        <code className="text-[10px] text-blue-300 block break-all font-mono leading-relaxed">
                            https://api.ultramsg.com/ID/messages/chat?token=TU_TOKEN
                        </code>
                    </div>
                    
                    <p className="text-[10px] text-slate-600 font-medium">
                        Asegúrate de que la URL en tu Edge Function termine con <span className="font-bold">?token=...</span> y no solo envíes el token en el JSON.
                    </p>
                </div>
            )}

            {lastError && !isTokenError && (
                <div className="mx-1 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-700">
                    <AlertCircle size={20} />
                    <p className="text-xs font-bold">{lastError}</p>
                </div>
            )}

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4 mx-1">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                        <Terminal size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Estado del Puente</h4>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Activo: Supabase Edge Functions</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-1">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-2">Probar Notificaciones</h4>
                {workers.filter(w => w.phone).map(w => (
                    <div key={w.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <User size={20}/>
                            </div>
                            <div>
                                <p className="font-black text-slate-800 leading-none">{w.name}</p>
                                <p className="text-xs font-bold text-blue-600 mt-1">{w.phone}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleTest(w)}
                            disabled={sendingId === w.id}
                            className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all disabled:opacity-30"
                        >
                            {sendingId === w.id ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
