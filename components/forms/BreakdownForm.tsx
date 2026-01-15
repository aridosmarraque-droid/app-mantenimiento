
import React, { useState, useEffect } from 'react';
import { Machine, OperationLog, ServiceProvider } from '../../types';
import { getServiceProviders } from '../../services/db';
import { Save, Loader2 } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const BreakdownForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [hours, setHours] = useState<number | ''>(machine.currentHours || '');
  const [cause, setCause] = useState('');
  const [solution, setSolution] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getServiceProviders().then(setProviders);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true); // Bloqueo inmediato
    onSubmit({
      hoursAtExecution: Number(hours),
      breakdownCause: cause,
      breakdownSolution: solution,
      repairerId: providerId,
      maintenanceType: undefined 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
      <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-red-50 p-2 rounded-t text-red-700">Registro de Avería</h3>

      {machine.requiresHours && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kilómetros Actuales *</label>
          <input
            type="number"
            required
            min={machine.currentHours}
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Causa de la avería *</label>
        <textarea
          required
          rows={3}
          value={cause}
          onChange={e => setCause(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Solución aplicada *</label>
        <textarea
          required
          rows={3}
          value={solution}
          onChange={e => setSolution(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
        ></textarea>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Quién repara? *</label>
        <select
          required
          value={providerId}
          onChange={e => setProviderId(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
        >
          <option value="">-- Seleccionar Empresa --</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" disabled={isSaving} onClick={onCancel} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Cancelar</button>
        <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-red-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-red-700 disabled:opacity-50">
          {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Registrando...' : 'Registrar Avería'}
        </button>
      </div>
    </form>
  );
};
