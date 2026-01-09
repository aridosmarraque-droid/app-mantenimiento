
import React, { useState, useEffect } from 'react';
import { Machine, OperationLog, ServiceProvider, MaintenanceDefinition } from '../../types';
import { getServiceProviders } from '../../services/db';
import { Save, AlertTriangle, CheckCircle, Clock, Calendar, Truck } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const ScheduledMaintenanceForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [pendingList, setPendingList] = useState<MaintenanceDefinition[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  
  // Selected for execution
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(machine.currentHours);
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    getServiceProviders().then(setProviders);
    
    // Mantenimientos que requieren acción inmediata (Preaviso o Vencidos)
    const pending = machine.maintenanceDefs.filter(def => def.pending);
    setPendingList(pending);

  }, [machine]);

  const handleRegisterClick = (defId: string) => {
    setSelectedDefId(defId);
  };

  const handleConfirm = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDefId) return;
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
            <div className="flex items-center gap-3 border-b pb-4 mb-4">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Truck size={24}/></div>
                <div>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">Registrar {def?.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{machine.name}</p>
                </div>
            </div>
            
            <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl italic">"{def?.tasks}"</p>

            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Horas de la Máquina al ejecutar *</label>
                <input
                    type="number"
                    required
                    min={machine.currentHours}
                    value={hours}
                    onChange={e => setHours(Number(e.target.value))}
                    className="w-full p-4 border-2 border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 font-black text-lg"
                />
            </div>
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Responsable / Taller *</label>
                <select
                    required
                    value={providerId}
                    onChange={e => setProviderId(e.target.value)}
                    className="w-full p-4 border-2 border-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 font-bold bg-white"
                >
                    <option value="">-- Seleccionar --</option>
                    {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-3 mt-6 pt-4">
                <button type="button" onClick={() => setSelectedDefId(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Volver</button>
                <button type="submit" className="flex-1 py-4 bg-purple-600 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-purple-100 flex justify-center items-center gap-2 hover:bg-purple-700 transition-all">
                <Save size={18} /> Confirmar Cierre
                </button>
            </div>
        </form>
      );
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-100">
       <div className="flex justify-between items-center border-b pb-4 mb-4">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                <Calendar className="text-purple-600" /> Programados
            </h3>
            {pendingList.length > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">{pendingList.length} AVISOS</span>}
       </div>
       
       {pendingList.length === 0 ? (
           <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-4">
               <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner">
                    <CheckCircle size={40} />
               </div>
               <div>
                   <p className="font-black text-slate-800 uppercase text-xs tracking-widest">Todo al día</p>
                   <p className="text-[11px] mt-1 font-bold">No hay mantenimientos en preaviso ni vencidos.</p>
               </div>
           </div>
       ) : (
           <div className="space-y-4">
               {pendingList.map((def) => {
                   let statusText = "";
                   let isOverdue = false;
                   let nextMilestone = 0;

                   if (def.maintenanceType === 'DATE') {
                       const d = def.nextDate?.toLocaleDateString() || 'N/A';
                       statusText = `Fecha prevista: ${d}`;
                       isOverdue = true; 
                   } else {
                        const remaining = def.remainingHours ?? 0;
                        isOverdue = remaining <= 0;
                        nextMilestone = machine.currentHours + remaining;
                        statusText = isOverdue 
                            ? `Vencido hace ${Math.abs(remaining)}h` 
                            : `Faltan ${remaining}h`;
                   }

                   return (
                   <div key={def.id} className={`border-2 rounded-2xl p-5 transition-all ${isOverdue ? 'border-red-100 bg-red-50/30' : 'border-amber-100 bg-amber-50/30'}`}>
                       <div className="flex justify-between items-start mb-3">
                           <div>
                               <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{def.name}</h4>
                               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Próximo hito: <span className="text-slate-600">{nextMilestone}h</span></p>
                           </div>
                           <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase border ${isOverdue ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                {isOverdue ? 'VENCIDO' : 'PREAVISO'}
                           </span>
                       </div>
                       
                       <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed italic">"{def.tasks}"</p>

                       <div className="flex justify-between items-center mb-4 p-3 bg-white/80 rounded-xl border border-white">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estado actual</span>
                           <span className={`text-xs font-black ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                               {statusText}
                           </span>
                       </div>

                       <button 
                         onClick={() => handleRegisterClick(def.id!)}
                         className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${isOverdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-900 text-white hover:bg-black'}`}
                       >
                           Registrar Tarea Ahora
                       </button>
                   </div>
                   );
                })}
           </div>
       )}

       <div className="mt-8 pt-6 border-t border-slate-100">
           <h4 className="text-[10px] font-black text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
               <Clock size={14} className="text-slate-300"/> Calendario Futuro
           </h4>
           <div className="space-y-2">
               {machine.maintenanceDefs.filter(d => !d.pending).map(d => {
                   let info = "";
                   let nextMilestone = 0;
                   if (d.maintenanceType === 'DATE') {
                       info = d.nextDate?.toLocaleDateString() || '-';
                   } else {
                       const rem = d.remainingHours ?? 0;
                       nextMilestone = machine.currentHours + rem;
                       info = `${rem}h restantes`;
                   }
                   return (
                   <div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-colors group">
                       <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{d.name}</span>
                       <div className="text-right">
                           <p className="text-[10px] font-black text-slate-800">{nextMilestone}h</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{info}</p>
                       </div>
                   </div>
                   );
               })}
           </div>
       </div>

       <div className="mt-6">
            <button type="button" onClick={onCancel} className="w-full py-3 text-slate-400 text-xs font-black uppercase tracking-widest">Cerrar</button>
       </div>
    </div>
  );
};
