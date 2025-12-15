
import React, { useState, useEffect } from 'react';
import { PersonalReport, CostCenter, Machine } from '../../types';
import { getCostCenters, getAllMachines, getPersonalReports } from '../../services/db';
import { Save, ArrowLeft, Loader2, Calendar, Clock, Factory, Truck, ClipboardList } from 'lucide-react';

interface Props {
    workerId: string;
    onSubmit: (data: Omit<PersonalReport, 'id'>) => void;
    onBack: () => void;
}

export const PersonalReportForm: React.FC<Props> = ({ workerId, onSubmit, onBack }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    
    // Form State
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState('');
    
    const [allSelectableMachines, setAllSelectableMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    
    const [hours, setHours] = useState<number | ''>('');

    // History
    const [history, setHistory] = useState<PersonalReport[]>([]);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoadingData(true);
        try {
            const [centersData, historyData, machinesData] = await Promise.all([
                getCostCenters(),
                getPersonalReports(workerId),
                getAllMachines()
            ]);
            setCenters(centersData);
            setHistory(historyData);
            
            // Filtrar y Ordenar máquinas seleccionables
            const selectable = machinesData.filter(m => m.selectableForReports === true);
            selectable.sort((a, b) => {
                 const codeA = a.companyCode || '';
                 const codeB = b.companyCode || '';
                 if (codeA && codeB) return codeA.localeCompare(codeB);
                 if (codeA) return -1; 
                 if (codeB) return 1;  
                 return a.name.localeCompare(b.name);
            });
            setAllSelectableMachines(selectable);
            
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleMachineChange = (machineId: string) => {
        setSelectedMachineId(machineId);
        // Autocompletar centro
        const m = allSelectableMachines.find(mac => mac.id === machineId);
        if (m) {
            setSelectedCenterId(m.costCenterId);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCenterId || !selectedMachineId || !hours) {
            alert("Por favor rellena todos los campos.");
            return;
        }

        setIsSaving(true);
        // Submit logic
        onSubmit({
            date: new Date(date),
            workerId,
            hours: Number(hours),
            costCenterId: selectedCenterId,
            machineId: selectedMachineId
        });
    };

    if (loadingData) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-screen bg-slate-50">
            <div className="bg-green-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <button type="button" onClick={onBack} className="p-1 hover:bg-green-800 rounded">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Parte de Trabajo Personal</h1>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto w-full pb-20">
                
                {/* 1. Date */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Calendar size={16} className="text-green-600"/> Fecha
                    </label>
                    <input 
                        type="date" 
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                </div>
                
                {/* 2. Machine (Principal Selection) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-green-600"/> Máquina / Tajo
                    </label>
                    <select
                        value={selectedMachineId}
                        onChange={e => handleMachineChange(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">-- Seleccionar Máquina --</option>
                        {allSelectableMachines.map(m => {
                             // Encontrar nombre del centro para mostrarlo como grupo
                             const cName = centers.find(c => c.id === m.costCenterId)?.name || 'Sin Centro';
                             return (
                                <option key={m.id} value={m.id}>
                                    {m.companyCode ? `[${m.companyCode}] ` : ''}{m.name} ({cName})
                                </option>
                             );
                        })}
                    </select>
                </div>

                {/* 3. Center (Auto-filled but visible) */}
                <div className="bg-slate-100 p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
                        <Factory size={16} className="text-slate-400"/> Centro de Trabajo (Auto)
                    </label>
                    <select
                        value={selectedCenterId}
                        disabled // Disabled as it is auto-filled
                        className="w-full p-3 border border-slate-300 rounded-lg bg-slate-200 text-slate-600"
                    >
                        <option value="">-- Seleccione Máquina Primero --</option>
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* 4. Hours */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                     <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Clock size={16} className="text-green-600"/> Horas Trabajadas
                    </label>
                    <input
                        type="number"
                        required
                        step="0.5"
                        placeholder="Ej. 8"
                        value={hours}
                        onChange={e => setHours(Number(e.target.value))}
                        className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold text-center"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isSaving || !selectedCenterId || !selectedMachineId}
                    className="w-full py-4 bg-green-700 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-green-800 active:transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {isSaving ? "Guardando..." : "Guardar Parte"}
                </button>

                {/* History Section */}
                <div className="pt-6 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        <ClipboardList size={16}/> Últimos Registros
                    </h3>
                    <div className="space-y-3">
                        {history.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-700">{item.date.toLocaleDateString()}</span>
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">{item.hours}h</span>
                                </div>
                                <div className="text-slate-600">{item.machineName || 'Máquina desconocida'}</div>
                                <div className="text-xs text-slate-400">{item.costCenterName}</div>
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-center text-slate-400 text-sm italic">Sin registros recientes.</p>}
                    </div>
                </div>

            </div>
        </form>
    );
};

