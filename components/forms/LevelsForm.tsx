import React, { useState } from 'react';
import { Machine, OperationLog } from '../../types';
import { Save } from 'lucide-react';

interface Props {
  machine: Machine;
  onSubmit: (data: Partial<OperationLog>) => void;
  onCancel: () => void;
}

export const LevelsForm: React.FC<Props> = ({ machine, onSubmit, onCancel }) => {
  const [hours, setHours] = useState<number | ''>(machine.currentHours || '');
  const [motorOil, setMotorOil] = useState<number | ''>('');
  const [hydraulicOil, setHydraulicOil] = useState<number | ''>('');
  const [coolant, setCoolant] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      hoursAtExecution: Number(hours),
      motorOil: Number(motorOil) || 0,
      hydraulicOil: Number(hydraulicOil) || 0,
      coolant: Number(coolant) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
      <h3 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4">Registro de Niveles</h3>
      
      {machine.requiresHours && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales Máquina *</label>
          <input
            type="number"
            required
            value={hours}
            min={machine.currentHours}
            onChange={e => setHours(Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Aceite Motor (Litros)</label>
          <input
            type="number"
            step="0.1"
            value={motorOil}
            onChange={e => setMotorOil(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Aceite Hidráulico (Litros)</label>
          <input
            type="number"
            step="0.1"
            value={hydraulicOil}
            onChange={e => setHydraulicOil(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Refrigerante (Litros)</label>
          <input
            type="number"
            step="0.1"
            value={coolant}
            onChange={e => setCoolant(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.0"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium">Cancelar</button>
        <button type="submit" className="flex-1 py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700">
          <Save className="w-5 h-5" /> Guardar
        </button>
      </div>
    </form>
  );
};
