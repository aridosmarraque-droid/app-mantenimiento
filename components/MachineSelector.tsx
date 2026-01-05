
import React, { useEffect, useState } from 'react';
import { CostCenter, SubCenter, Machine } from '../types';
import { getCostCenters, getSubCentersByCenter, getMachinesBySubCenter, calculateAndSyncMachineStatus, getMachinesByCenter } from '../services/db'; 
import { Factory, Truck, ChevronRight, Loader2, AlertCircle, LayoutGrid } from 'lucide-react';

interface MachineSelectorProps {
  onSelect: (machine: Machine, center: CostCenter) => void;
  selectedDate: Date;
  onChangeDate: (date: Date) => void;
  showInactive?: boolean;
}

export const MachineSelector: React.FC<MachineSelectorProps> = ({ onSelect, selectedDate, onChangeDate, showInactive = false }) => {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  
  const [subCenters, setSubCenters] = useState<SubCenter[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [loadingSelection, setLoadingSelection] = useState(false);

  useEffect(() => {
    getCostCenters().then(setCenters);
  }, []);

  useEffect(() => {
    if (selectedCenterId) {
      getSubCentersByCenter(selectedCenterId).then(setSubCenters);
      // Opcional: Cargar máquinas directas del centro si no hay subcentros aún
      getMachinesByCenter(selectedCenterId, !showInactive).then(setMachines);
      setSelectedSubId('');
      setSelectedMachineId('');
    } else {
      setSubCenters([]);
      setMachines([]);
    }
  }, [selectedCenterId, showInactive]);

  useEffect(() => {
    if (selectedSubId) {
      getMachinesBySubCenter(selectedSubId, !showInactive).then(setMachines);
      setSelectedMachineId('');
    }
  }, [selectedSubId, showInactive]);

  const handleContinue = async () => {
    const m = machines.find(mac => mac.id === selectedMachineId);
    const c = centers.find(cen => cen.id === selectedCenterId);
    if (m && c) {
      setLoadingSelection(true);
      try {
          const updatedMachine = await calculateAndSyncMachineStatus(m);
          onSelect(updatedMachine, c);
      } catch (error) {
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
        <label className="block text-sm font-medium text-slate-700 mb-2">Fecha de trabajo</label>
        <input type="date" value={formattedDate} onChange={(e) => onChangeDate(new Date(e.target.value))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
       </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Factory className="w-5 h-5 text-blue-600" /> Cantera / Grupo
        </h2>
        <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          <option value="">-- Seleccione Cantera --</option>
          {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedCenterId && subCenters.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" /> Instalación / Planta
          </h2>
          <select value={selectedSubId} onChange={(e) => setSelectedSubId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="">-- Seleccione Planta --</option>
            {subCenters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {(selectedCenterId || selectedSubId) && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Máquina {showInactive && <span className="text-xs font-normal text-slate-400 ml-1">(Incluye inactivas)</span>}
          </h2>
          <select value={selectedMachineId} onChange={(e) => setSelectedMachineId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="">-- Seleccione Máquina --</option>
            {machines.map(m => (
              <option key={m.id} value={m.id} className={m.active === false ? 'text-red-500' : ''}>
                {m.companyCode ? `[${m.companyCode}] ` : ''}{m.name} 
                {m.active === false ? ' (INACTIVA)' : ''}
                {m.vinculadaProduccion ? ' (Sincronizada)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <button disabled={!selectedMachineId || loadingSelection} onClick={handleContinue} className="w-full flex items-center justify-center gap-2 bg-blue-600 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all hover:bg-blue-700">
        {loadingSelection ? <Loader2 className="animate-spin" /> : <>Continuar <ChevronRight className="w-5 h-5" /></>}
      </button>
    </div>
  );
};
