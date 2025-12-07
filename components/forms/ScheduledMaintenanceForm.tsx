import React, { useState, useEffect } from 'react';
import { Machine, OperationLog, ServiceProvider, MaintenanceDefinition } from '../../types';
import { getServiceProviders, getLastMaintenanceLog } from '../../services/db';
import { Save, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

interface MaintenanceStatus {
  def: MaintenanceDefinition;
  lastPerformedHours: number;
  nextDueHours: number;
  isDue: boolean;
  isOverdue: boolean;
}

export const ScheduledMaintenanceForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [statuses, setStatuses] = useState<MaintenanceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  
  // Selected for execution
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [hours, setHours] = useState<number>(machine.currentHours);
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const provs = await getServiceProviders();
        setProviders(provs);

        const calculatedStatuses: MaintenanceStatus[] = [];

        for (const def of machine.maintenanceDefs) {
            const lastLog = await getLastMaintenanceLog(machine.id, def.id);
            const lastHours = lastLog ? lastLog.hoursAtExecution : 0; // Assuming 0 if never done
            const nextDue = lastHours + def.intervalHours;
            
            // Logic:
            // Warning start: nextDue - warningHours
            // Show if currentHours >= (nextDue - warningHours)
            const warningThreshold = nextDue - def.warningHours;
            const isDue = machine.currentHours >= warningThreshold;
            const isOverdue = machine.currentHours > nextDue;

            calculatedStatuses.push({
                def,
                lastPerformedHours: lastHours,
                nextDueHours: nextDue,
                isDue,
                isOverdue
            });
        }
        setStatuses(calculatedStatuses);
        setLoading(false);
    };

    fetchData();
  }, [machine]);

  const handleRegisterClick = (defId: string) => {
    setSelectedDefId(defId);
  };

  const handleConfirm = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDefId) return;

      onSubmit({
          hoursAtExecution: Number(hours),
          repairerId: providerId,
          maintenanceDefId: selectedDefId,
          maintenanceType: 'OTHER', // Defaulting for log structure
          description: statuses.find(s => s.def.id === selectedDefId)?.def.name
      });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Calculando mantenimientos...</div>;

  if (selectedDefId) {
      const def = statuses.find(s => s.def.id === selectedDefId)?.def;
      return (
        <form onSubmit={handleConfirm} className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Registrar {def?.name}</h3>
            <p className="text-sm text-slate-500 bg-slate-100 p-2 rounded mb-4">{def?.tasks}</p>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas de Ejecución *</label>
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
                <button type="button" onClick={() => setSelectedDefId(null)} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Volver</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-purple-700">
                <Save className="w-5 h-5" /> Confirmar
                </button>
            </div>
        </form>
      );
  }

  const activeMaintenances = statuses.filter(s => s.isDue);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
       <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-purple-50 p-2 rounded-t text-purple-700">Mantenimientos Programados</h3>
       
       {activeMaintenances.length === 0 ? (
           <div className="text-center py-8 text-slate-500 flex flex-col items-center">
               <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
               <p>No hay mantenimientos pendientes para las horas actuales ({machine.currentHours}h).</p>
           </div>
       ) : (
           <div className="space-y-4">
               {activeMaintenances.map((status) => (
                   <div key={status.def.id} className={`border rounded-lg p-4 ${status.isOverdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <h4 className="font-bold text-lg text-slate-800">{status.def.name}</h4>
                               <p className="text-sm text-slate-600">{status.def.tasks}</p>
                           </div>
                           {status.isOverdue && <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><AlertTriangle size={12}/> Vencido</span>}
                       </div>
                       
                       <div className="flex justify-between items-center text-sm text-slate-500 mt-3 mb-3">
                           <span>Intervalo: {status.def.intervalHours}h</span>
                           <span>Toca a las: <strong>{status.nextDueHours}h</strong></span>
                       </div>

                       <button 
                         onClick={() => handleRegisterClick(status.def.id)}
                         className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors"
                       >
                           Registrar Ahora
                       </button>
                   </div>
               ))}
           </div>
       )}

       {/* Debug / Info list of future */}
       <div className="mt-8 pt-4 border-t border-slate-100">
           <h4 className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-1"><Clock size={14}/> Próximos Eventos</h4>
           <ul className="text-xs text-slate-400 space-y-1">
               {statuses.filter(s => !s.isDue).map(s => (
                   <li key={s.def.id} className="flex justify-between">
                       <span>{s.def.name}</span>
                       <span>Previsto: {s.nextDueHours}h (en {s.nextDueHours - machine.currentHours}h)</span>
                   </li>
               ))}
           </ul>
       </div>

       <div className="mt-4">
        <button type="button" onClick={onCancel} className="w-full py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Volver</button>
       </div>
    </div>
  );
};