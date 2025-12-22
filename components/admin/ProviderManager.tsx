
import React, { useState, useEffect } from 'react';
import { getServiceProviders, createServiceProvider, updateServiceProvider, deleteServiceProvider } from '../../services/db';
import { ServiceProvider } from '../../types';
import { Save, ArrowLeft, Loader2, Truck, Trash2, Edit2, Plus, X } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const ProviderManager: React.FC<Props> = ({ onBack }) => {
    const [providers, setProviders] = useState<ServiceProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        setLoading(true);
        const data = await getServiceProviders();
        setProviders(data);
        setLoading(false);
    };

    const resetForm = () => {
        setEditingId(null);
        setName('');
    };

    const handleEdit = (p: ServiceProvider) => {
        setEditingId(p.id);
        setName(p.name);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar este proveedor? Esto no afectará a los registros históricos pero no aparecerá en los nuevos partes.")) return;
        try {
            await deleteServiceProvider(id);
            loadProviders();
        } catch (e) {
            alert("Error al eliminar proveedor");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setSaving(true);
        try {
            if (editingId) {
                await updateServiceProvider(editingId, name);
            } else {
                await createServiceProvider(name);
            }
            resetForm();
            loadProviders();
        } catch (error) {
            alert("Error al guardar proveedor");
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
                <h3 className="text-xl font-bold text-slate-800">Gestión de Proveedores</h3>
            </div>

            {/* Formulario */}
            <div className={`p-6 rounded-xl shadow-md border-2 transition-all ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                <h4 className="font-bold text-slate-700 mb-4 flex justify-between items-center">
                    {editingId ? 'Modificar Proveedor' : 'Añadir Nuevo Proveedor'}
                    {editingId && <button onClick={resetForm} className="text-xs text-slate-500 flex items-center gap-1"><X size={14}/> Cancelar</button>}
                </h4>
                
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <input 
                        required 
                        className="flex-1 p-3 border rounded-lg shadow-sm" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="Nombre de la empresa (Ej. Volvo Service)" 
                    />
                    <button type="submit" disabled={saving || !name} className="py-3 px-6 bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 shadow-lg disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save size={18}/> : <Plus size={18}/>}
                        {editingId ? 'Actualizar' : 'Añadir'}
                    </button>
                </form>
            </div>

            {/* Listado */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-4 border-b bg-slate-50">
                    <h4 className="font-bold text-slate-700">Lista de Proveedores</h4>
                </div>
                <div className="divide-y">
                    {providers.map(p => (
                        <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center">
                                    <Truck size={18} />
                                </div>
                                <span className="font-medium text-slate-700">{p.name}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(p)} className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded hover:bg-blue-50">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 transition-all rounded hover:bg-red-50">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {providers.length === 0 && <p className="p-10 text-center text-slate-400 italic">No hay proveedores registrados.</p>}
                </div>
            </div>
        </div>
    );
};
