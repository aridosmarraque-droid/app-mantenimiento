import React, { useState, useEffect } from 'react';
import { getWorkers, createWorker, updateWorker } from '../../services/db';
import { Worker } from '../../types';
import { UserPlus, Edit2, Save, ArrowLeft, Loader2, UserCircle, Phone, CreditCard, ToggleLeft, ToggleRight, X, Clock, FileText } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const WorkerManager: React.FC<Props> = ({ onBack }) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'worker' | 'admin' | 'cp' | 'cr'>('worker');
    const [active, setActive] = useState(true);
    const [expectedHours, setExpectedHours] = useState<number>(8);
    const [requiresReport, setRequiresReport] = useState<boolean>(true);

    useEffect(() => {
        loadWorkers();
    }, []);

    const loadWorkers = async () => {
        setLoading(true);
        try {
            const data = await getWorkers(false); // Get all, including inactive
            setWorkers(data);
        } catch (error) {
            console.error("Error loading workers", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setDni('');
        setPhone('');
        setRole('worker');
        setActive(true);
        setExpectedHours(8);
        setRequiresReport(true);
    };

    const handleEdit = (w: Worker) => {
        setEditingId(w.id);
        setName(w.name);
        setDni(w.dni);
        setPhone(w.phone || '');
        setRole(w.role as any);
        setActive(w.active ?? true);
        setExpectedHours(w.expectedHours || 0);
        setRequiresReport(w.requiresReport ?? true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: Omit<Worker, 'id'> = {
                name,
                dni,
                phone,
                role,
                active,
                expectedHours,
                requiresReport,
                positionIds: []
            };

            if (editingId) {
                await updateWorker(editingId, payload);
            } else {
                await createWorker(payload);
            }
            
            resetForm();
            await loadWorkers();
            alert("Trabajador guardado con éxito");
        } catch (error: any) {
            console.error("Error saving worker", error);
            alert("Error al guardar trabajador: " + (error.message || "Error desconocido"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold text-slate-800">Gestión de Personal</h3>
            </div>

            {/* Formulario */}
            <div className={`p-6 rounded-xl shadow-md border-2 transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                <h4 className="font-bold text-slate-700 mb-4 flex justify-between items-center">
                    {editingId ? 'Modificar Trabajador' : 'Añadir Nuevo Trabajador'}
                    {editingId && <button onClick={resetForm} className="text-xs text-slate-500 flex items-center gap-1"><X size={14}/> Cancelar</button>}
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo *</label>
                            <input required className="w-full p-2 border rounded shadow-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Juan García" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DNI *</label>
                            <input required className="w-full p-2 border rounded shadow-sm" value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678X" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                            <input className="w-full p-2 border rounded shadow-sm" value={phone} onChange={e => setPhone(e.target.value)} placeholder="600000000" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Horas Programadas (Jornada) *</label>
                            <input required type="number" step="0.5" className="w-full p-2 border rounded shadow-sm font-bold text-blue-700" value={expectedHours} onChange={e => setExpectedHours(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol / Permisos *</label>
                            <select 
                                required 
                                className="w-full p-2 border rounded shadow-sm bg-white" 
                                value={role} 
                                onChange={e => setRole(e.target.value as any)}
                            >
                                <option value="worker">Operario (Solo Mantenimiento)</option>
                                <option value="cp">Cantera Pura (Mantenimiento + Producción)</option>
                                <option value="cr">Canto Rodado (Mantenimiento + Producción)</option>
                                <option value="admin">Administrador (Acceso Total)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 pt-2 border-t mt-4 pt-4">
                        <button type="button" onClick={() => setActive(!active)} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {active ? <ToggleRight className="text-green-600 w-8 h-8" /> : <ToggleLeft className="text-slate-400 w-8 h-8" />}
                            Trabajador en Activo
                        </button>

                        <button type="button" onClick={() => setRequiresReport(!requiresReport)} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {requiresReport ? <ToggleRight className="text-blue-600 w-8 h-8" /> : <ToggleLeft className="text-slate-400 w-8 h-8" />}
                            Requiere Parte de Trabajo
                        </button>
                    </div>

                    <button type="submit" disabled={saving} className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 shadow-lg disabled:opacity-70">
                        {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save size={18}/> : <UserPlus size={18}/>}
                        {editingId ? 'Actualizar Trabajador' : 'Registrar Trabajador'}
                    </button>
                </form>
            </div>

            {/* Listado */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mx-1">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Personal Registrado</h4>
                    <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-full">{workers.length} Total</span>
                </div>
                <div className="divide-y max-h-[60vh] overflow-y-auto">
                    {workers.map(w => (
                        <div key={w.id} className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${w.active ? 'bg-white' : 'bg-red-50 opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
                                    w.role === 'admin' ? 'bg-red-100 text-red-600 border-red-200' : 
                                    w.role === 'cp' ? 'bg-amber-100 text-amber-600 border-amber-200' : 
                                    w.role === 'cr' ? 'bg-teal-100 text-teal-600 border-teal-200' : 
                                    'bg-blue-100 text-blue-600 border-blue-200'
                                }`}>
                                    <UserCircle size={24} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-slate-800 flex items-center gap-2 truncate">
                                        {w.name}
                                        {!w.active && <span className="text-[9px] bg-red-600 text-white px-1.5 rounded uppercase font-black">Baja</span>}
                                        {/* Fix: Wrap FileText in a span because Lucide icons do not support the title prop directly for tooltips. */}
                                        {w.requiresReport && <span title="Requiere Parte"><FileText size={12} className="text-blue-500" /></span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter border-r pr-3"><CreditCard size={10}/> {w.dni}</span>
                                        <span className="text-[10px] text-blue-600 font-black flex items-center gap-1 uppercase tracking-tighter border-r pr-3"><Clock size={10}/> {w.expectedHours}h</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                            w.role === 'admin' ? 'bg-red-600 text-white' : 
                                            w.role === 'cp' ? 'bg-amber-500 text-white' : 
                                            w.role === 'cr' ? 'bg-teal-600 text-white' : 
                                            'bg-slate-500 text-white'
                                        }`}>
                                            {w.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleEdit(w)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all self-end sm:self-auto border border-slate-100 shadow-sm">
                                <Edit2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
