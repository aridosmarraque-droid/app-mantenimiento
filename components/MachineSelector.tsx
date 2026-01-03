
import React, { useEffect, useState } from 'react';
import { CostCenter, Machine } from '../types';
import { getCostCenters, getMachinesByCenter, calculateAndSyncMachineStatus } from '../services/db'; 
import { Factory, Truck, ChevronRight, Loader2 } from 'lucide-react';

interface MachineSelectorProps {
  onSelect: (machine: Machine, center: CostCenter) => void;
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
}

export const MachineSelector: React.FC<MachineSelectorProps> = ({ onSelect, selectedDate, onChangeDate }) => {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [loadingSelection, setLoadingSelection] = useState(false);

  useEffect(() => {
    getCostCenters().then(setCenters);
  }, []);

  useEffect(() => {
    if (selectedCenterId) {
      // Cargamos solo las máquinas activas para evitar errores de selección
      getMachinesByCenter(selectedCenterId, true).then(data => {
          data.sort((a, b) => {
             const codeA = a.companyCode || '';
             const codeB = b.companyCode || '';
             if (codeA && codeB) return codeA.localeCompare(codeB);
             if (codeA) return -1; 
             if (codeB) return 1;  
             return a.name.localeCompare(b.name);
          });
          setMachines(data);
      });
      setSelectedMachineId('');
    } else {
      setMachines([]);
    }
  }, [selectedCenterId]);

  const handleContinue = async () => {
    const m = machines.find(mac => mac.id === selectedMachineId);
    const c = centers.find(cen => cen.id === selectedCenterId);
    
    if (m && c) {
      setLoadingSelection(true);
      try {
          const updatedMachine = await calculateAndSyncMachineStatus(m);
          onSelect(updatedMachine, c);
      } catch (error) {
          console.error("Error syncing machine status", error);
          onSelect(m, c); 
      } finally {
          setLoadingSelection(false);
      }
    }
  };

  const formattedDate = selectedDate.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Fecha de trabajo
        </label>
        <input 
          type="date" 
          value={formattedDate}
          onChange={(e) => onChangeDate(new Date(e.target.value))}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
       </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Factory className="w-5 h-5 text-blue-600" />
          Cantera / Grupo
        </h2>
        <select
          value={selectedCenterId}
          onChange={(e) => setSelectedCenterId(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
        >
          <option value="">-- Seleccione Cantera --</option>
          {centers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {selectedCenterId && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Máquina
          </h2>
          <select
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
          >
            <option value="">-- Seleccione Máquina --</option>
            {machines.map(m => (
              <option key={m.id} value={m.id}>
                {m.companyCode ? `[${m.companyCode}] ` : ''}{m.name} {m.adminExpenses ? '(Gastos Admin)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        disabled={!selectedMachineId || !selectedCenterId || loadingSelection}
        onClick={handleContinue}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all hover:bg-blue-700"
      >
        {loadingSelection ? <Loader2 className="animate-spin" /> : <>Continuar <ChevronRight className="w-5 h-5" /></>}
      </button>
    </div>
  );
};
