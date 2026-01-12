
import React, { useState, useEffect } from 'react';
import { getWorkers, getAllMachines } from '../../services/db';
import { sendTestWhatsApp } from '../../services/whatsapp';
import { Worker, Machine } from '../../types';
import { 
    ArrowLeft, MessageSquare, Send, CheckCircle2, 
    AlertCircle, Phone, User, Truck, Loader2, ShieldCheck, XCircle
} from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const WhatsAppConfig: React.FC<Props> = ({ onBack }) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

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
        try {
            const res = await sendTestWhatsApp(worker.phone);
            if (res.success) {
                alert(`✅ ¡Éxito! Mensaje enviado a ${worker.name}`);
            } else {
                alert(`❌ Error del servicio: ${res.error}`);
            }
        } catch (e: any) {
            alert(`❌ Error crítico: ${e.message}`);
        } finally {
            setSendingId(null);
        }
    };

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
                        <ShieldCheck size={10}/> Servicio UltraMsg Activo
                    </p>
                </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4 mx-1">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/20 text-green-400 rounded-xl">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Estado del Sistema</h4>
                        <p className="text-xs text-slate-400">Las alertas utilizan Supabase Edge Functions como puente seguro para evitar bloqueos de navegador (CORS).</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-1">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-2">Verificación de Responsables</h4>
                {workers.filter(w => w.phone).map(w => {
                    const assignedMachines = machines.filter(m => m.responsibleWorkerId === w.id);
                    return (
                        <div key={w.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                        <User size={20}/>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800 leading-none">{w.name}</p>
                                        <p className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1">
                                            <Phone size={10}/> {w.phone}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleTest(w)}
                                    disabled={sendingId === w.id}
                                    className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all border border-green-100 shadow-sm"
                                    title="Enviar Mensaje de Prueba"
                                >
                                    {sendingId === w.id ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                                </button>
                            </div>

                            {assignedMachines.length > 0 && (
                                <div className="pt-2 border-t border-slate-50">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-tighter">Unidades bajo su responsabilidad:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {assignedMachines.map(m => (
                                            <span key={m.id} className="text-[9px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border flex items-center gap-1">
                                                <Truck size={8}/> {m.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
