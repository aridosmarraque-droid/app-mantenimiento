import React, { useState, useEffect } from 'react';
import { getWorkers, createWorker, updateWorker } from '../../services/db';
import { Worker } from '../../types';
import { UserPlus, Edit2, Save, ArrowLeft, Loader2, UserCircle, Phone, CreditCard, ToggleLeft, ToggleRight, X, Clock, ClipboardCheck } from 'lucide-react';

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
    const [scheduledHours, setScheduledHours] = useState<number>(10);
    const [requiresWorkReport, setRequiresWorkReport] = useState(true);

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
        setScheduledHours(10);
        setRequiresWorkReport(true);
    };

    const handleEdit = (w: Worker) => {
        setEditingId(w.id);
        setName(w.name);
        setDni(w.dni);
        setPhone(w.phone || '');
        setRole(w.role as any);
        setActive(w.active ?? true);
        setScheduledHours(w.scheduledHours || 10);
        setRequiresWorkReport(w.requiresWorkReport !== undefined ? w.requiresWorkReport : true);
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
                scheduledHours,
                requiresWorkReport,
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
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <Clock size={12}/> Horas Jornada Programadas
                            </label>
                            <input 
                                type="number" 
                                required 
                                min="1" 
                                max="24"
                                className="w-full p-2 border rounded shadow-sm font-bold" 
                                value={scheduledHours} 
                                onChange={e => setScheduledHours(Number(e.target.value))} 
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                        <button type="button" onClick={() => setActive(!active)} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {active ? <ToggleRight className="text-green-600 w-8 h-8" /> : <ToggleLeft className="text-slate-400 w-8 h-8" />}
                            Trabajador en Activo
                        </button>
                        <button type="button" onClick={() => setRequiresWorkReport(!requiresWorkReport)} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            {requiresWorkReport ? <ToggleRight className="text-blue-600 w-8 h-8" /> : <ToggleLeft className="text-slate-400 w-8 h-8" />}
                            Requiere Parte de Trabajo Diario
                        </button>
                    </div>

                    <button type="submit" disabled={saving} className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 shadow-lg disabled:opacity-70">
                        {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save size={18}/> : <UserPlus size={18}/>}
                        {editingId ? 'Actualizar Trabajador' : 'Registrar Trabajador'}
                    </button>
                </form>
            </div>

            {/* Listado */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700">Personal Registrado</h4>
                    <span className="text-xs text-slate-500">{workers.length} Total</span>
                </div>
                <div className="divide-y">
                    {workers.map(w => (
                        <div key={w.id} className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${w.active ? 'bg-white' : 'bg-red-50 opacity-60'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    w.role === 'admin' ? 'bg-red-100 text-red-600' : 
                                    w.role === 'cp' ? 'bg-amber-100 text-amber-600' : 
                                    w.role === 'cr' ? 'bg-teal-100 text-teal-600' : 
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                    <UserCircle size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                        {w.name}
                                        {!w.active && <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded uppercase">Baja</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                                        <span className="text-xs text-slate-500 flex items-center gap-1"><CreditCard size={12}/> {w.dni}</span>
                                        <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12}/> {w.scheduledHours}h/día</span>
                                        {w.requiresWorkReport && <span className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1"><ClipboardCheck size={10}/> Parte Req.</span>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleEdit(w)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all self-end sm:self-auto">
                                <Edit2 size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
