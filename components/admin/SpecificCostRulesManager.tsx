import React, { useState, useEffect } from 'react';
import { getSpecificCostRules, createSpecificCostRule, deleteSpecificCostRule, updateSpecificCostRule, getAllMachines, getCostCenters } from '../../services/db';
import { SpecificCostRule, Machine, CostCenter } from '../../types';
import { ArrowLeft, Save, Trash2, Plus, Percent, Loader2, Edit2, X } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const SpecificCostRulesManager: React.FC<Props> = ({ onBack }) => {
    const [rules, setRules] = useState<SpecificCostRule[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [centers, setCenters] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
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

    const resetForm = () => {
        setEditingId(null);
        setSourceMachineId('');
        setTargetCenterId('');
        setTargetMachineId('');
        setPercentage('');
    };

    const handleAddOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceMachineId || !targetCenterId || !percentage) return;

        // Validar que el total para esa máquina no pase de 100
        const machineRules = rules.filter(r => r.machineOriginId === sourceMachineId && r.id !== editingId);
        const currentTotal = machineRules.reduce((acc, r) => acc + r.percentage, 0);
        
        if (currentTotal + Number(percentage) > 100) {
            alert(`Error: La máquina ya tiene asignado un ${currentTotal}%. No puedes superar el 100%.`);
            return;
        }

        try {
            const payload: Omit<SpecificCostRule, 'id'> = {
                machineOriginId: sourceMachineId,
                targetCenterId,
                targetMachineId: targetMachineId || null,
                percentage: Number(percentage)
            };

            if (editingId) {
                await updateSpecificCostRule(editingId, payload);
                alert("Regla actualizada.");
            } else {
                await createSpecificCostRule(payload);
                alert("Regla creada.");
            }
            
            resetForm();
            loadData();
        } catch (e) {
            alert("Error al guardar regla.");
        }
    };

    const handleEdit = (rule: SpecificCostRule) => {
        setEditingId(rule.id);
        setSourceMachineId(rule.machineOriginId);
        setTargetCenterId(rule.targetCenterId);
        setTargetMachineId(rule.targetMachineId || '');
        setPercentage(rule.percentage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta regla?")) return;
        await deleteSpecificCostRule(id);
        loadData();
    };

    const getMachineDisplay = (id: string) => {
        const m = machines.find(m => m.id === id);
        if (!m) return id;
        return m.companyCode ? `[${m.companyCode}] ${m.name}` : m.name;
    };

    const getCenterName = (id: string) => centers.find(c => c.id === id)?.name || id;

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft /></button>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Reglas de Costes Específicos</h3>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Maquinaria sin partes de trabajo</p>
                </div>
            </div>

            <form onSubmit={handleAddOrUpdate} className={`p-6 rounded-2xl shadow-md border-2 mx-1 space-y-4 transition-all ${editingId ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                        {editingId ? <Edit2 size={16} className="text-indigo-600"/> : <Plus size={16} className="text-green-600"/>}
                        {editingId ? 'Modificando Regla' : 'Crear Nueva Regla'}
                    </h4>
                    {editingId && (
                        <button type="button" onClick={resetForm} className="text-[10px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1 uppercase">
                            <X size={14}/> Cancelar
                        </button>
                    )}
                </div>
                
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
                            <option value="">-- Por defecto: Código Origen --</option>
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

                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg">
                    <Save size={18}/> {editingId ? 'Guardar Cambios' : 'Registrar Regla'}
                </button>
            </form>

            <div className="space-y-3 px-1">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-2">Configuraciones Existentes</h4>
                {rules.map(rule => (
                    <div key={rule.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-indigo-100 transition-all">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-black text-slate-800 text-xs uppercase">{getMachineDisplay(rule.machineOriginId)}</span>
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[9px]">{rule.percentage}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                <span className="text-blue-500">Imputa a:</span> {getCenterName(rule.targetCenterId)} 
                                <span className="text-slate-300">/</span>
                                {rule.targetMachineId ? getMachineDisplay(rule.targetMachineId) : <span className="italic text-slate-300">Auto (Código Origen)</span>}
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEdit(rule)} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">
                                <Edit2 size={20}/>
                            </button>
                            <button onClick={() => handleDelete(rule.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-xl">
                                <Trash2 size={20}/>
                            </button>
                        </div>
                    </div>
                ))}
                {!loading && rules.length === 0 && (
                    <div className="p-10 text-center text-slate-400 italic text-sm">No hay reglas configuradas.</div>
                )}
            </div>
        </div>
    );
};
