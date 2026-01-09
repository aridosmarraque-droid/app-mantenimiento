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
  
  // Usamos claves internas para evitar errores de restricción en la DB
  const [typeKey, setTypeKey] = useState<string>('ENGRASE');
  
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');

  useEffect(() => {
    getServiceProviders().then(setProviders);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mapeo de etiquetas para la descripción
    const labels: Record<string, string> = {
        'LIMPIEZA': 'Limpieza / Soplado Filtros',
        'ENGRASE': 'Engrase General',
        'OTROS': 'Otros Mantenimientos'
    };

    onSubmit({
      hoursAtExecution: Number(hours),
      repairerId: providerId,
      maintenanceType: typeKey, // Enviamos la clave (ENGRASE, LIMPIEZA, etc.)
      description: typeKey === 'OTROS' ? description : labels[typeKey],
      materials: materials || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
      <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-amber-50 p-2 rounded-t text-amber-700">Mantenimiento General</h3>

      {machine.requiresHours && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kilómetros Actuales *</label>
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
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${typeKey === 'LIMPIEZA' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={typeKey === 'LIMPIEZA'} onChange={() => setTypeKey('LIMPIEZA')} />
                Limpieza / Soplado Filtros
            </label>
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${typeKey === 'ENGRASE' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={typeKey === 'ENGRASE'} onChange={() => setTypeKey('ENGRASE')} />
                Engrase General
            </label>
            <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${typeKey === 'OTROS' ? 'bg-amber-100 border-amber-500' : 'bg-slate-50'}`}>
                <input type="radio" name="mType" className="mr-3" checked={typeKey === 'OTROS'} onChange={() => setTypeKey('OTROS')} />
                Otros Mantenimientos
            </label>
        </div>
      </div>

      <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200 mt-2">
            {typeKey === 'OTROS' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Mantenimiento *</label>
                    <textarea
                        required
                        className="w-full p-2 border rounded"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describa el trabajo realizado..."
                    />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Materiales Usados</label>
                <textarea
                    className="w-full p-2 border rounded"
                    rows={2}
                    value={materials}
                    onChange={(e) => setMaterials(e.target.value)}
                    placeholder="Filtros, grasas, valvulina..."
                />
            </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Cancelar</button>
        <button type="submit" className="flex-1 py-3 bg-amber-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-amber-700">
          <Save className="w-5 h-5" /> Guardar
        </button>
      </div>
    </form>
  );
};
