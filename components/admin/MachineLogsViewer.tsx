
import React, { useState, useEffect } from 'react';
import { getAllMachines, getMachineLogs, getWorkers, getServiceProviders, getCostCenters } from '../../services/db';
import { Machine, OperationLog, OperationType, Worker, ServiceProvider, CostCenter } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, FileText, Download, Droplet, Wrench, Hammer, Fuel, CalendarClock, Factory, Truck } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const MachineLogsViewer: React.FC<Props> = ({ onBack }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [providers, setProviders] = useState<ServiceProvider[]>([]);
    
    // Filters
    const [selectedCenterId, setSelectedCenterId] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<OperationType[]>([]);

    // Results
    const [logs, setLogs] = useState<OperationLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    useEffect(() => {
        getCostCenters().then(setCenters);
        getAllMachines().then(setMachines);
        getWorkers().then(setWorkers);
        getServiceProviders().then(setProviders);
    }, []);

    // Filtered machines list based on selected center
    const filteredMachines = selectedCenterId 
        ? machines.filter(m => m.costCenterId === selectedCenterId)
        : [];

    const handleSearch = async () => {
        if (!selectedMachineId) return;
        setLoading(true);
        setHasSearched(true);
        
        try {
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;
            const data = await getMachineLogs(selectedMachineId, start, end, selectedTypes);
            setLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleType = (type: OperationType) => {
        if (selectedTypes.includes(type)) {
            setSelectedTypes(selectedTypes.filter(t => t !== type));
        } else {
            setSelectedTypes([...selectedTypes, type]);
        }
    };

    const getWorkerName = (id: string) => workers.find(w => w.id === id)?.name || id;
    const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || 'N/A';

    const renderLogDetails = (log: OperationLog) => {
        switch (log.type) {
            case 'LEVELS':
                return (
                    <div className="text-sm">
                        {log.motorOil ? <div>Aceite Motor: {log.motorOil} L</div> : null}
                        {log.hydraulicOil ? <div>Aceite Hidr.: {log.hydraulicOil} L</div> : null}
                        {log.coolant ? <div>Refrigerante: {log.coolant} L</div> : null}
                    </div>
                );
            case 'BREAKDOWN':
                return (
                    <div className="text-sm">
                        <div className="font-semibold text-red-700">Avería: {log.breakdownCause}</div>
                        <div className="text-slate-600">Solución: {log.breakdownSolution}</div>
                        <div className="text-xs text-slate-500 italic">Repara: {getProviderName(log.repairerId || '')}</div>
                    </div>
                );
            case 'MAINTENANCE':
                return (
                    <div className="text-sm">
                        <div className="font-semibold">{log.maintenanceType === 'CLEANING' ? 'Limpieza' : log.maintenanceType === 'GREASING' ? 'Engrase' : 'Mecánica General'}</div>
                        {log.description && <div>{log.description}</div>}
                        {log.materials && <div className="text-xs text-slate-500">Materiales: {log.materials}</div>}
                        <div className="text-xs text-slate-500 italic">Realiza: {getProviderName(log.repairerId || '')}</div>
                    </div>
                );
            case 'SCHEDULED':
                return (
                    <div className="text-sm">
                         <div className="font-semibold text-purple-700">{log.description || 'Mantenimiento Programado'}</div>
                         <div className="text-xs text-slate-500 italic">Realiza: {getProviderName(log.repairerId || '')}</div>
                    </div>
                );
            case 'REFUELING':
                return (
                    <div className="text-sm font-semibold text-green-700">
                        {log.fuelLitres ? `${log.fuelLitres} Litros` : 'Sin litros registrados'}
                    </div>
                );
            default: return null;
        }
    };

    const typeConfig = {
        'LEVELS': { label: 'Niveles', icon: Droplet, color: 'text-blue-600 bg-blue-50 border-blue-200' },
        'BREAKDOWN': { label: 'Averías', icon: Wrench, color: 'text-red-600 bg-red-50 border-red-200' },
        'MAINTENANCE': { label: 'Mantenimiento', icon: Hammer, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        'REFUELING': { label: 'Repostaje', icon: Fuel, color: 'text-green-600 bg-green-50 border-green-200' },
        'SCHEDULED': { label: 'Programado', icon: CalendarClock, color: 'text-purple-600 bg-purple-50 border-purple-200' }
    };

    return (
        <div className="space-y-4 pb-10">
             <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Registros por Máquina</h3>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                {/* Selector de Centro */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Factory size={14} /> 1. Centro de Coste
                    </label>
                    <select 
                        value={selectedCenterId}
                        onChange={e => {
                            setSelectedCenterId(e.target.value);
                            setSelectedMachineId(''); // Reset machine when center changes
                        }}
                        className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Seleccionar Centro --</option>
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Selector de Máquina (Filtrado) */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Truck size={14} /> 2. Máquina
                    </label>
                    <select 
                        disabled={!selectedCenterId}
                        value={selectedMachineId}
                        onChange={e => setSelectedMachineId(e.target.value)}
                        className={`w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-opacity ${!selectedCenterId ? 'opacity-50 cursor-not-allowed' : 'bg-white'}`}
                    >
                        <option value="">{selectedCenterId ? '-- Seleccionar Máquina --' : '-- Primero seleccione centro --'}</option>
                        {filteredMachines.map(m => (
                            <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Desde</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hasta</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipos de Operación</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(Object.keys(typeConfig) as OperationType[]).map(type => (
                            <label key={type} className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedTypes.includes(type) ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedTypes.includes(type)}
                                    onChange={() => toggleType(type)}
                                    className="hidden"
                                />
                                <span className={`w-3 h-3 rounded-full border ${selectedTypes.includes(type) ? 'bg-green-400 border-green-400' : 'border-slate-400'}`}></span>
                                <span className="text-[10px] font-bold uppercase">{typeConfig[type].label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleSearch}
                    disabled={!selectedMachineId || loading}
                    className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                >
                    <Search size={18} /> {loading ? 'Buscando...' : 'Ver Registros'}
                </button>
            </div>

            {/* Results */}
            {hasSearched && (
                <div className="bg-white p-4 rounded-xl shadow-md min-h-[200px]">
                    <h4 className="font-bold text-slate-700 border-b pb-2 mb-4 flex justify-between items-center">
                        Resultados
                        <span className="text-xs font-normal text-slate-500">{logs.length} registros encontrados</span>
                    </h4>

                    {logs.length === 0 ? (
                        <div className="text-center text-slate-500 py-10">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p className="italic">No se encontraron registros para esta selección.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map(log => {
                                const conf = typeConfig[log.type] || { label: 'Otro', icon: FileText, color: 'text-slate-500 bg-slate-100' };
                                const Icon = conf.icon;
                                return (
                                    <div key={log.id} className="flex gap-4 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${conf.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-slate-800 text-sm">{conf.label}</span>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                    {log.date.toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mb-1">
                                                {getWorkerName(log.workerId)} | <span className="font-mono text-slate-700">{log.hoursAtExecution}h</span>
                                            </div>
                                            <div className="mt-1 bg-slate-50 p-2 rounded text-slate-700 border border-slate-100">
                                                {renderLogDetails(log)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
