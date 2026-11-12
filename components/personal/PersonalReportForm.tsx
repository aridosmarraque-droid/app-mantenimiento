import React, { useState, useEffect, useMemo } from 'react';
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
    const [allCenters, setAllCenters] = useState<CostCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState('');
    
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
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
            // Obtenemos centros, máquinas (incluyendo inactivas para el historial) y reportes
            const [centersData, historyData, machinesData] = await Promise.all([
                getCostCenters(),
                getPersonalReports(workerId),
                getAllMachines(false) 
            ]);
            
            setAllCenters(centersData);
            setCenters(centersData.filter(c => c.selectableForReports !== false));
            setAllMachines(machinesData);

            // ENRIQUECIMIENTO DEL HISTORIAL:
            // Cruzamos los IDs del historial con los nombres de las máquinas y centros cargados
            const enrichedHistory = historyData.map(h => {
                const machine = machinesData.find(m => m.id === h.machineId);
                const center = centersData.find(c => c.id === h.costCenterId);
                
                return {
                    ...h,
                    machineName: machine 
                        ? `${machine.companyCode ? `[${machine.companyCode}] ` : ''}${machine.name}`
                        : 'Máquina desconocida',
                    costCenterName: center ? center.name : 'Centro desconocido'
                };
            });

            setHistory(enrichedHistory);
            
        } catch (error) {
            console.error("Error cargando datos del parte personal:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const isMobileCenter = (centerId?: string) => {
        if (!centerId) return false;
        const c = allCenters.find(center => center.id === centerId);
        if (!c) return false;
        const name = (c.name || '').toLowerCase();
        const code = (c.companyCode || '').toLowerCase();
        return name.includes('móvil') || 
               name.includes('movil') || 
               name.includes('parque móvil') || 
               name.includes('parque movil') || 
               code === 'pm' || 
               code === 'mov' || 
               code === 'mm';
    };

    const isMobileMachine = (m: Machine) => {
        if (isMobileCenter(m.costCenterId)) return true;
        if (m.transportExpenses) return true;
        const mName = (m.name || '').toLowerCase();
        return mName.includes('móvil') || mName.includes('movil');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return; 
        
        if (!selectedCenterId || !selectedMachineId || !hours) {
            alert("Por favor rellena todos los campos.");
            return;
        }

        setIsSaving(true);
        onSubmit({
            date: new Date(date),
            workerId,
            hours: Number(hours),
            costCenterId: selectedCenterId,
            machineId: selectedMachineId
        });
    };

    // Al seleccionar un centro de trabajo, las máquinas/tajo seleccionables serán:
    // 1. Las máquinas de ese centro de trabajo
    // 2. Las máquinas móviles
    // Requisito: activas (activo !== false) y marcadas como seleccionables (selectableForReports === true)
    // Las máquinas de otros centros no aparecen.
    const selectableMachines = useMemo(() => {
        if (!selectedCenterId) return [];

        return allMachines
            .filter(m => {
                // Validación: activa y con el check de seleccionable para partes
                if (m.activo === false || m.selectableForReports !== true) {
                    return false;
                }

                // Máquinas de ese centro de trabajo
                if (m.costCenterId === selectedCenterId) {
                    return true;
                }

                // Máquinas móviles
                return isMobileMachine(m);
            })
            .sort((a, b) => {
                const codeA = a.companyCode || '';
                const codeB = b.companyCode || '';
                if (codeA && codeB) return codeA.localeCompare(codeB);
                return a.name.localeCompare(b.name);
            });
    }, [selectedCenterId, allMachines, allCenters]);

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
                
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Factory size={16} className="text-green-600"/> Centro de Trabajo
                    </label>
                    <select
                        value={selectedCenterId}
                        onChange={(e) => {
                            const newCenterId = e.target.value;
                            setSelectedCenterId(newCenterId);
                            if (selectedMachineId) {
                                const currentMac = allMachines.find(m => m.id === selectedMachineId);
                                const isStillValid = currentMac && (
                                    currentMac.costCenterId === newCenterId || isMobileMachine(currentMac)
                                );
                                if (!isStillValid) {
                                    setSelectedMachineId('');
                                }
                            }
                        }}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">-- Seleccionar Centro --</option>
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.companyCode ? `[${c.companyCode}] ` : ''}{c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-green-600"/> Máquina / Tajo
                    </label>
                    <select
                        value={selectedMachineId}
                        disabled={!selectedCenterId}
                        onChange={e => setSelectedMachineId(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="">
                            {!selectedCenterId 
                                ? '-- Seleccione primero un Centro --' 
                                : selectableMachines.length === 0 
                                    ? '-- No hay máquinas disponibles --' 
                                    : '-- Seleccionar Máquina --'}
                        </option>
                        {selectableMachines.map(m => {
                             const defaultCenterName = allCenters.find(c => c.id === m.costCenterId)?.name || '';
                             return (
                                <option key={m.id} value={m.id}>
                                    {m.companyCode ? `[${m.companyCode}] ` : ''}{m.name} {defaultCenterName ? `(${defaultCenterName})` : ''}
                                </option>
                             );
                        })}
                    </select>
                    {!selectedCenterId && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 ml-1">
                            Seleccione el centro de trabajo para ver sus máquinas y la maquinaria móvil
                        </p>
                    )}
                </div>

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
                                <div className="font-bold text-slate-800">{item.machineName}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-black">{item.costCenterName}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </form>
    );
};
