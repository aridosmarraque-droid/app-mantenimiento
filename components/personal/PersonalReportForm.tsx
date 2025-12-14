
import React, { useState, useEffect } from 'react';
import { getCostCenters, getMachinesByCenter, savePersonalWorkReport } from '../../services/db';
import { CostCenter, Machine } from '../../types';
import { ArrowLeft, Save, Factory, Truck, Clock } from 'lucide-react';

interface Props {
    workerId: string;
    onBack: () => void;
    onSuccess: () => void;
}

export const PersonalReportForm: React.FC<Props> = ({ workerId, onBack, onSuccess }) => {
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [selectedCenterId, setSelectedCenterId] = useState('');
    
    const [machines, setMachines] = useState<Machine[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState('');
    
    const [hours, setHours] = useState('');
    const [comments, setComments] = useState('');
    
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getCostCenters().then(setCenters);
    }, []);

    useEffect(() => {
        if (selectedCenterId) {
            getMachinesByCenter(selectedCenterId).then(data => {
                // Filtramos solo las máquinas que tienen el check "isForWorkReport"
                const filtered = data.filter(m => m.isForWorkReport);
                setMachines(filtered);
                setSelectedMachineId('');
            });
        } else {
            setMachines([]);
        }
    }, [selectedCenterId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await savePersonalWorkReport({
                date: new Date(),
                workerId,
                machineId: selectedMachineId,
                hours: Number(hours),
                comments
            });
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al guardar el parte.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="bg-green-600 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <button type="button" onClick={onBack} className="p-1 hover:bg-green-700 rounded">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Nuevo Parte Trabajo</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-6 max-w-lg mx-auto w-full">
                
                {/* Center Selector */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Factory className="w-5 h-5 text-green-600" />
                        Centro de Trabajo
                    </h2>
                    <select
                        required
                        value={selectedCenterId}
                        onChange={(e) => setSelectedCenterId(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">-- Seleccione Centro --</option>
                        {centers.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} {c.code ? `(${c.code})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Machine Selector */}
                {selectedCenterId && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-green-600" />
                            Máquina / Puesto
                        </h2>
                        {machines.length === 0 ? (
                            <p className="text-sm text-slate-500 italic p-2 bg-slate-50 rounded">No hay máquinas disponibles para partes en este centro.</p>
                        ) : (
                            <select
                                required
                                value={selectedMachineId}
                                onChange={(e) => setSelectedMachineId(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">-- Seleccione Máquina --</option>
                                {machines.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} {m.companyCode ? `(${m.companyCode})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {/* Hours Input */}
                {selectedMachineId && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-green-600" />
                            Horas Trabajadas
                        </h2>
                        <input
                            type="number"
                            required
                            step="0.5"
                            min="0.5"
                            placeholder="Ej. 8"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            className="w-full p-4 text-2xl font-bold text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        
                        <label className="block text-sm font-medium text-slate-700 mb-2">Comentarios (Opcional)</label>
                        <textarea
                            rows={2}
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Descripción breve..."
                        />
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={!selectedMachineId || !hours || loading}
                    className="w-full py-4 bg-green-600 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <Save size={24} /> {loading ? 'Guardando...' : 'Registrar Parte'}
                </button>
            </form>
        </div>
    );
};
