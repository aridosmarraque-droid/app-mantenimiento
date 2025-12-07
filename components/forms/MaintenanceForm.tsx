import React, { useState, useEffect } from 'react';
import { Machine, OperationLog, ServiceProvider } from '../../types';
import { getServiceProviders } from '../../services/db';
import { Save } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const MaintenanceForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [hours, setHours] = useState<number | ''>(machine.currentHours || '');
  const [providerId, setProviderId] = useState('');
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [type, setType] = useState<'CLEANING' | 'GREASING' | 'OTHER'>('GREASING');
  
  // For 'Other'
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');

  useEffect(() => {
    getServiceProviders().then(setProviders);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      hoursAtExecution: Number(hours),
      repairerId: providerId,
      maintenanceType: type,
      description: type === 'OTHER' ? description : undefined,
      materials: type === 'OTHER' ? materials : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
      <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-amber-50 p-2 rounded-t text-amber-700">Mantenimiento General</h3>

      {machine.requiresHours && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales Máquina *</label>
          <input
            type="number"
            required
            min={machine.currentHours}
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Quién realiza? *</label>
        <select
          required
          value={providerId}
          onChange={e => setProviderId(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="">-- Seleccionar --</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">Tipo de trabajo *</label>
        <div className="flex flex-col gap-2">
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${type === 'CLEANING' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={type === 'CLEANING'} onChange={() => setType('CLEANING')} />
                Limpieza / Soplado Filtros
            </label>
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${type === 'GREASING' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={type === 'GREASING'} onChange={() => setType('GREASING')} />
                Engrase General
            </label>
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${type === 'OTHER' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={type === 'OTHER'} onChange={() => setType('OTHER')} />
                Otros Mantenimientos
            </label>
        </div>
      </div>

      {type === 'OTHER' && (
        <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200 mt-2">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Mantenimiento *</label>
                <textarea
                    required
                    className="w-full p-2 border rounded"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Materiales Usados</label>
                <textarea
                    className="w-full p-2 border rounded"
                    rows={2}
                    value={materials}
                    onChange={(e) => setMaterials(e.target.value)}
                />
            </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Cancelar</button>
        <button type="submit" className="flex-1 py-3 bg-amber-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-amber-700">
          <Save className="w-5 h-5" /> Guardar
        </button>
      </div>
    </form>
  );
};