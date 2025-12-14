
import React, { useState, useEffect } from 'react';
import { createCostCenter, getCostCenters, deleteCostCenter } from '../../services/db';
import { CostCenter } from '../../types';
import { Save, ArrowLeft, Loader2, Factory, Trash2 } from 'lucide-react';

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const CreateCenterForm: React.FC<Props> = ({ onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [centers, setCenters] = useState<CostCenter[]>([]);

    useEffect(() => {
        loadCenters();
    }, []);

    const loadCenters = () => {
        getCostCenters().then(setCenters);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCostCenter(name, code);
            setName('');
            setCode('');
            loadCenters();
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al crear centro");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, centerName: string) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar la cantera "${centerName}"? Esta acción no se puede deshacer.`)) return;
        
        try {
            await deleteCostCenter(id);
            alert("Centro eliminado correctamente.");
            loadCenters();
        } catch (error: any) {
            console.error(error);
            alert(error.message || "No se pudo eliminar el centro.");
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
                <div className="flex items-center gap-2 mb-4 border-b pb-2">
                    <button type="button" onClick={onBack} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">Nueva Cantera / Grupo</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Cantera / Grupo *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej. Cantera Machacadora"
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno (Opcional)</label>
                        <input
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="Ej. CP, MM, TALLER..."
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">Código corto para identificar el centro.</p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:bg-blue-700 disabled:bg-slate-400"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
                        {loading ? 'Guardando...' : 'Crear'}
                    </button>
                </form>
            </div>

            {/* Listado de Centros Existentes */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Factory className="w-4 h-4 text-slate-500"/> Canteras Existentes
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th className="px-4 py-3">Código</th>
                                <th className="px-4 py-3">Nombre</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {centers.map((center, idx) => (
                                <tr key={center.id} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-blue-600">{center.code || '-'}</td>
                                    <td className="px-4 py-3 text-slate-900">{center.name}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleDelete(center.id, center.name)}
                                            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                                            title="Eliminar Centro"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {centers.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-center text-slate-400">No hay centros registrados</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
