import React, { useState, useEffect } from 'react';
import { getWorkers, createWorker, updateWorker } from '../../services/db';
import { Worker, WorkerRole } from '../../types';
import { UserPlus, Edit2, Save, ArrowLeft, Loader2, UserCircle, Phone, CreditCard, ToggleLeft, ToggleRight, X, Clock, FileText } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const WorkerManager: React.FC<Props> = ({ onBack }) => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [activeTab, setActiveTab] = useState<'personal' | 'role' | 'status'>('personal');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<WorkerRole>('worker');
    // Fix: state renamed to 'activo' to match Worker interface
    const [activo, setActivo] = useState(true);
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
        setActivo(true);
        setExpectedHours(8);
        setRequiresReport(true);
        setActiveTab('personal');
    };

    const handleEdit = (w: Worker) => {
        setEditingId(w.id);
        setName(w.name);
        setDni(w.dni);
        setPhone(w.phone || '');
        setRole(w.role as any);
        // Fix: using w.activo instead of w.active
        setActivo(w.activo ?? true);
        setExpectedHours(w.expectedHours || 0);
        setRequiresReport(w.requiresReport ?? true);
        setActiveTab('personal');
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
                // Fix: property named 'activo' to match Omit<Worker, 'id'>
                activo,
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

            {/* Formulario con Pestañas */}
            <div className={`rounded-xl shadow-md border-2 overflow-hidden transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                <div className="p-4 border-b flex justify-between items-center bg-white">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        {editingId ? <Edit2 size={16} className="text-blue-600"/> : <UserPlus size={16} className="text-slate-600"/>}
                        {editingId ? 'Modificar Trabajador' : 'Añadir Nuevo Trabajador'}
                    </h4>
                    {editingId && <button onClick={resetForm} className="text-xs text-slate-500 flex items-center gap-1 hover:text-red-500 transition-colors"><X size={14}/> Cancelar</button>}
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b bg-slate-50/50">
                    <button 
                        type="button"
                        onClick={() => setActiveTab('personal')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'personal' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Datos Personales
                    </button>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('role')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'role' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Rol / Permisos
                    </button>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'status' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Estado
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-left duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Nombre Completo *</label>
                                <input required className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Juan García" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">DNI *</label>
                                <input required className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700" value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678X" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Teléfono</label>
                                <input className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700" value={phone} onChange={e => setPhone(e.target.value)} placeholder="600000000" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'role' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-left duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1">Rol / Permisos *</label>
                                <select 
                                    required 
                                    className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-slate-700" 
                                    value={role} 
                                    onChange={e => setRole(e.target.value as any)}
                                >
                                    <option value="worker">Operario (Solo Mantenimiento)</option>
                                    <option value="cp">Cantera Pura (Mantenimiento + Producción)</option>
                                    <option value="cr">Canto Rodado (Mantenimiento + Producción)</option>
                                    <option value="reparador">Reparador / Taller</option>
                                    <option value="prevencion">Técnico Prevención (PRL)</option>
                                    <option value="ingeniero">Ingeniero (PRL + Ingeniería)</option>
                                    <option value="admin">Administrador (Acceso Total)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 ml-1 flex items-center gap-1"><Clock size={12}/> Horas Programadas (Jornada) *</label>
                                <input required type="number" step="0.5" className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none font-bold text-blue-700" value={expectedHours} onChange={e => setExpectedHours(Number(e.target.value))} />
                            </div>
                            <div className="md:col-span-2">
                                <button type="button" onClick={() => setRequiresReport(!requiresReport)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-blue-200 transition-all w-full text-left">
                                    {requiresReport ? <ToggleRight className="text-blue-600 w-10 h-10" /> : <ToggleLeft className="text-slate-400 w-10 h-10" />}
                                    <div>
                                        <p className="text-xs font-black text-slate-700 uppercase">Requiere Parte de Trabajo</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Habilita el formulario de reporte diario para este trabajador</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'status' && (
                        <div className="animate-in slide-in-from-left duration-300">
                            <button type="button" onClick={() => setActivo(!activo)} className={`flex items-center gap-4 p-6 rounded-3xl border-2 transition-all w-full text-left ${activo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                {activo ? <ToggleRight className="text-green-600 w-12 h-12" /> : <ToggleLeft className="text-red-400 w-12 h-12" />}
                                <div>
                                    <p className={`text-sm font-black uppercase ${activo ? 'text-green-800' : 'text-red-800'}`}>
                                        {activo ? 'Trabajador en Activo' : 'Trabajador de Baja'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">
                                        {activo ? 'El trabajador puede acceder al sistema y registrar datos' : 'El trabajador no podrá iniciar sesión'}
                                    </p>
                                </div>
                            </button>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        {activeTab !== 'status' ? (
                            <button 
                                type="button" 
                                onClick={() => setActiveTab(activeTab === 'personal' ? 'role' : 'status')}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Siguiente Paso
                            </button>
                        ) : (
                            <button type="submit" disabled={saving} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-100 disabled:opacity-70 transition-all">
                                {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save size={18}/> : <UserPlus size={18}/>}
                                {editingId ? 'Actualizar Trabajador' : 'Registrar Trabajador'}
                            </button>
                        )}
                    </div>
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
                        // Fix: changed w.active to w.activo
                        <div key={w.id} className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${w.activo ? 'bg-white' : 'bg-red-50 opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
                                    w.role === 'admin' ? 'bg-red-100 text-red-600 border-red-200' : 
                                    w.role === 'cp' ? 'bg-amber-100 text-amber-600 border-amber-200' : 
                                    w.role === 'cr' ? 'bg-teal-100 text-teal-600 border-teal-200' : 
                                    w.role === 'ingeniero' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                    w.role === 'prevencion' ? 'bg-purple-100 text-purple-600 border-purple-200' :
                                    w.role === 'reparador' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                    'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                    <UserCircle size={24} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-slate-800 flex items-center gap-2 truncate">
                                        {w.name}
                                        {/* Fix: changed w.active to w.activo */}
                                        {!w.activo && <span className="text-[9px] bg-red-600 text-white px-1.5 rounded uppercase font-black">Baja</span>}
                                        {w.requiresReport && <span title="Requiere Parte"><FileText size={12} className="text-blue-500" /></span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter border-r pr-3"><CreditCard size={10}/> {w.dni}</span>
                                        <span className="text-[10px] text-blue-600 font-black flex items-center gap-1 uppercase tracking-tighter border-r pr-3"><Clock size={10}/> {w.expectedHours}h</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                            w.role === 'admin' ? 'bg-red-600 text-white' : 
                                            w.role === 'cp' ? 'bg-amber-500 text-white' : 
                                            w.role === 'cr' ? 'bg-teal-600 text-white' : 
                                            w.role === 'ingeniero' ? 'bg-blue-600 text-white' :
                                            w.role === 'prevencion' ? 'bg-purple-600 text-white' :
                                            w.role === 'reparador' ? 'bg-orange-500 text-white' :
                                            'bg-slate-500 text-white'
                                        }`}>
                                            {w.role === 'admin' ? 'Admin' : 
                                             w.role === 'cp' ? 'Cantera Pura' : 
                                             w.role === 'cr' ? 'Canto Rodado' : 
                                             w.role === 'ingeniero' ? 'Ingeniero' : 
                                             w.role === 'prevencion' ? 'Prevención' : 
                                             w.role === 'reparador' ? 'Reparador' : 
                                             'Operario'}
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
