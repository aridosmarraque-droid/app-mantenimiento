
import React, { useState, useEffect } from 'react';
import { Machine, OperationLog, ServiceProvider, MaintenanceDefinition, Worker } from '../../types';
import { getServiceProviders, getWorkers } from '../../services/db';
import { sendWhatsAppMessage, formatMaintenanceAlert } from '../../services/whatsapp';
import { Save, AlertTriangle, CheckCircle, Clock, Calendar, MessageSquare, Send, Loader2 } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const ScheduledMaintenanceForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [pendingList, setPendingList] = useState<MaintenanceDefinition[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  
  // Selected for execution
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(machine.currentHours);
  const [providerId, setProviderId] = useState('');
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getServiceProviders().then(setProviders);
    getWorkers(false).then(setWorkers);
    
    // Filtrar por pendiente
    const pending = machine.maintenanceDefs.filter(def => def.pending);
    setPendingList(pending);

  }, [machine]);

  const handleRegisterClick = (defId: string) => {
    setSelectedDefId(defId);
  };

  const handleSendWhatsApp = async (def: MaintenanceDefinition) => {
      const responsible = workers.find(w => w.id === machine.responsibleWorkerId);
      if (!responsible || !responsible.phone) {
          alert("La máquina no tiene un responsable con teléfono asignado.");
          return;
      }

      setSendingWhatsapp(def.id!);
      const message = formatMaintenanceAlert(responsible, machine, def);
      const res = await sendWhatsAppMessage(responsible.phone, message);
      
      if (res.success) alert(`WhatsApp enviado a ${responsible.name}`);
      else alert("Error al enviar WhatsApp.");
      setSendingWhatsapp(null);
  };

  const handleConfirm = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDefId) return;
      
      setIsSubmitting(true); // Bloqueo inmediato de doble clic
      const def = machine.maintenanceDefs.find(d => d.id === selectedDefId);

      onSubmit({
          hoursAtExecution: Number(hours),
          repairerId: providerId,
          maintenanceDefId: selectedDefId,
          maintenanceType: 'OTHER', 
          description: def?.name
      });
  };

  if (selectedDefId) {
      const def = machine.maintenanceDefs.find(d => d.id === selectedDefId);
      return (
        <form onSubmit={handleConfirm} className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Registrar {def?.name}</h3>
            <p className="text-sm text-slate-500 bg-slate-100 p-2 rounded mb-4">{def?.tasks}</p>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kilómetros al ejecutar *</label>
                <input
                    type="number"
                    required
                    min={machine.currentHours}
                    value={hours}
                    onChange={e => setHours(Number(e.target.value))}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quién lo realiza? *</label>
                <select
                    required
                    value={providerId}
                    onChange={e => setProviderId(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                    <option value="">-- Seleccionar --</option>
                    {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" disabled={isSubmitting} onClick={() => setSelectedDefId(null)} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Volver</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-purple-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-purple-700 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} 
                {isSubmitting ? 'Registrando...' : 'Confirmar'}
                </button>
            </div>
        </form>
      );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
       <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-purple-50 p-2 rounded-t text-purple-700">Mantenimientos Programados</h3>
       
       {pendingList.length === 0 ? (
           <div className="text-center py-8 text-slate-500 flex flex-col items-center">
               <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
               <p>No hay mantenimientos pendientes.</p>
           </div>
       ) : (
           <div className="space-y-4">
               {pendingList.map((def) => {
                   
                   let statusText = "";
                   let isOverdue = false;

                   if (def.maintenanceType === 'DATE') {
                       const d = def.nextDate?.toLocaleDateString() || 'N/A';
                       statusText = `Fecha prevista: ${d}`;
                       isOverdue = true; 
                   } else {
                        const remaining = def.remainingHours ?? 0;
                        isOverdue = remaining < 0;
                        statusText = isOverdue ? `Pasado por ${Math.abs(remaining)}h` : `Restan: ${remaining}h`;
                   }

                   return (
                   <div key={def.id} className={`border rounded-xl p-4 border-amber-300 bg-amber-50 relative overflow-hidden`}>
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <h4 className="font-bold text-lg text-slate-800 leading-tight">{def.name}</h4>
                               <p className="text-xs text-slate-600 mt-1">{def.tasks}</p>
                           </div>
                           <span className="bg-amber-200 text-amber-800 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 uppercase tracking-tighter"><AlertTriangle size={12}/> Pendiente</span>
                       </div>
                       
                       <div className="flex justify-between items-center text-sm text-slate-500 mt-4 mb-4">
                           <span className="text-xs font-bold uppercase tracking-tight">{def.maintenanceType === 'DATE' ? 'Calendario' : `Intervalo: ${def.intervalHours}h`}</span>
                           <span className={isOverdue ? "text-red-600 font-black" : "text-slate-700 font-black"}>
                               {statusText}
                           </span>
                       </div>

                       <div className="flex gap-2">
                           <button 
                             onClick={() => handleRegisterClick(def.id!)}
                             className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-sm"
                           >
                               Registrar Parte
                           </button>
                           <button 
                             onClick={() => handleSendWhatsApp(def)}
                             disabled={sendingWhatsapp === def.id}
                             className="w-14 bg-green-500 text-white flex items-center justify-center rounded-xl hover:bg-green-600 transition-all shadow-sm disabled:opacity-50"
                             title="Notificar por WhatsApp"
                           >
                               {sendingWhatsapp === def.id ? <Loader2 className="animate-spin" size={20}/> : <MessageSquare size={20}/>}
                           </button>
                       </div>
                   </div>
                   );
                })}
           </div>
       )}

       <div className="mt-8 pt-4 border-t border-slate-100">
           <h4 className="text-xs font-black text-slate-400 mb-2 flex items-center gap-1 uppercase tracking-widest"><Clock size={14}/> Calendario Próximos Eventos</h4>
           <ul className="text-[10px] text-slate-400 space-y-1">
               {machine.maintenanceDefs.filter(d => !d.pending).map(d => {
                   let info = "";
                   if (d.maintenanceType === 'DATE') {
                       info = d.nextDate ? new Date(d.nextDate).toLocaleDateString() : '-';
                   } else {
                       info = `Restan: ${d.remainingHours ?? '?'}h`;
                   }
                   return (
                   <li key={d.id} className="flex justify-between p-1 hover:bg-slate-50 rounded">
                       <span className="font-bold">{d.name}</span>
                       <span className="font-mono">{info}</span>
                   </li>
                   );
               })}
           </ul>
       </div>

       <div className="mt-4">
        <button type="button" onClick={onCancel} className="w-full py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Volver al Menú</button>
       </div>
    </div>
  );
};
