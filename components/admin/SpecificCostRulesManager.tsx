
import React, { useState, useEffect } from 'react';
import { getSpecificCostRules, createSpecificCostRule, deleteSpecificCostRule, getAllMachines, getCostCenters } from '../../services/db';
import { SpecificCostRule, Machine, CostCenter } from '../../types';
import { ArrowLeft, Save, Trash2, Plus, Percent, Factory, Truck, Loader2, AlertCircle } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const SpecificCostRulesManager: React.FC<Props> = ({ onBack }) => {
    const [rules, setRules] = useState<SpecificCostRule[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [sourceMachineId, setSourceMachineId] = useState('');
    const [targetCenterId, setTargetCenterId] = useState('');
    const [targetMachineId, setTargetMachineId] = useState('');
    const [percentage, setPercentage] = useState<number | ''>('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rulesData, machinesData, centersData] = await Promise.all([
                getSpecificCostRules(),
                getAllMachines(false),
                getCostCenters()
            ]);
            setRules(rulesData);
            setMachines(machinesData);
            setCenters(centersData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceMachineId || !targetCenterId || !percentage) return;

        // Validar que el total para esa máquina no pase de 100
        const machineRules = rules.filter(r => r.machineOriginId === sourceMachineId);
        const currentTotal = machineRules.reduce((acc, r) => acc + r.percentage, 0);
        
        if (currentTotal + Number(percentage) > 100) {
            alert(`Error: La máquina ya tiene asignado un ${currentTotal}%. No puedes superar el 100%.`);
            return;
        }

        try {
            await createSpecificCostRule({
                machineOriginId: sourceMachineId,
                targetCenterId,
                targetMachineId: targetMachineId || undefined,
                percentage: Number(percentage)
            });
            setPercentage('');
            loadData();
        } catch (e) {
            alert("Error al guardar regla.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta regla?")) return;
        await deleteSpecificCostRule(id);
        loadData();
    };

    const getMachineName = (id: string) => {
        const m = machines.find(m => m.id === id);
        return m ? `${m.companyCode ? `[${m.companyCode}] ` : ''}${m.name}` : id;
    };

    const getCenterName = (id: string) => centers.find(c => c.id === id)?.name || id;

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft /></button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Costes Específicos</h3>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Maquinaria sin partes de trabajo</p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 mx-1 space-y-4">
                <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                    <Plus size={16} className="text-green-600"/> Crear Nueva Regla
                </h4>
                
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">1. Máquina que consume (Origen)</label>
                    <select value={sourceMachineId} onChange={e => setSourceMachineId(e.target.value)} required className="w-full p-3 border rounded-xl font-bold bg-slate-50">
                        <option value="">-- Seleccionar --</option>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.companyCode ? `[${m.companyCode}] ` : ''}{m.name}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">2. Centro de Coste Destino</label>
                        <select value={targetCenterId} onChange={e => setTargetCenterId(e.target.value)} required className="w-full p-3 border rounded-xl font-bold bg-slate-50">
                            <option value="">-- Seleccionar --</option>
                            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">3. Máquina Destino (Opcional)</label>
                        <select value={targetMachineId} onChange={e => setTargetMachineId(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-slate-50">
                            <option value="">-- General / Sin asignar --</option>
                            {machines.filter(m => m.costCenterId === targetCenterId).map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">4. Porcentaje del Gasto (%)</label>
                    <div className="relative">
                        <Percent className="absolute left-3 top-3.5 text-slate-400" size={16}/>
                        <input type="number" required min="1" max="100" value={percentage} onChange={e => setPercentage(Number(e.target.value))} className="w-full p-3 pl-10 border rounded-xl font-black text-lg" placeholder="50"/>
                    </div>
                </div>

                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <Save size={18}/> Guardar Regla
                </button>
            </form>

            <div className="space-y-3 px-1">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-2">Configuraciones Existentes</h4>
                {rules.map(rule => (
                    <div key={rule.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-black text-slate-800 text-xs uppercase">{getMachineName(rule.machineOriginId)}</span>
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[9px]">{rule.percentage}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                <span className="text-blue-500">Imputa a:</span> {getCenterName(rule.targetCenterId)} 
                                {rule.targetMachineId && <span className="text-slate-300">/</span>}
                                {rule.targetMachineId && getMachineName(rule.targetMachineId)}
                            </div>
                        </div>
                        <button onClick={() => handleDelete(rule.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={20}/>
                        </button>
                    </div>
                ))}
                {rules.length === 0 && (
                    <div className="p-10 text-center text-slate-400 italic text-sm">No hay reglas configuradas.</div>
                )}
            </div>
        </div>
    );
};
