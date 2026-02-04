
import React, { useState } from 'react';
import { Machine, OperationLog } from '../../types';
import { Save, Loader2, Fuel } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const RefuelingForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [hours, setHours] = useState<number | ''>(machine.currentHours || '');
  const [liters, setLiters] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (liters === '' || Number(liters) <= 0) {
      alert("Por favor ingrese una cantidad válida de litros.");
      return;
    }
    if (machine.requiresHours && hours !== '' && Number(hours) < machine.currentHours) {
        alert("Las horas no pueden ser inferiores a las actuales.");
        return;
    }

    setIsSaving(true);
    onSubmit({
      hoursAtExecution: Number(hours),
      fuelLitres: Number(liters),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4 bg-green-50 p-2 rounded-t text-green-700 flex items-center gap-2">
        <Fuel size={20} /> Registro de Repostaje
      </h3>
      
      {machine.requiresHours && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas/Kilómetros Actuales *</label>
          <input
            type="number"
            required
            value={hours}
            min={machine.currentHours}
            onChange={e => setHours(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 font-bold"
          />
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Mínimo requerido: {machine.currentHours}h</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Litros Suministrados *</label>
        <input
          type="number"
          step="0.1"
          required
          value={liters}
          onChange={e => setLiters(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 text-2xl font-black text-green-700"
          placeholder="0.0"
        />
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" disabled={isSaving} onClick={onCancel} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
        <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-green-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-100">
          {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} 
          {isSaving ? 'Guardando...' : 'Guardar Repostaje'}
        </button>
      </div>
    </form>
  );
};
