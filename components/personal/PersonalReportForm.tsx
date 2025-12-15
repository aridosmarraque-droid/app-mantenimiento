
import React, { useState } from 'react';
import { PersonalReport } from '../../types';
import { Save, ArrowLeft, Loader2, Calendar, Clock, MapPin } from 'lucide-react';

interface Props {
    workerId: string;
    onSubmit: (data: Omit<PersonalReport, 'id'>) => void;
    onBack: () => void;
}

export const PersonalReportForm: React.FC<Props> = ({ workerId, onSubmit, onBack }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [hours, setHours] = useState<number | ''>('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hours || !description) {
            alert("Rellena horas y descripción.");
            return;
        }

        setIsSaving(true);
        onSubmit({
            date: new Date(date),
            workerId,
            hours: Number(hours),
            location,
            description
        });
        // Parent component handles navigation/state reset
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-screen bg-slate-50">
            <div className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
                <button type="button" onClick={onBack} className="p-1 hover:bg-slate-700 rounded">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-bold text-lg">Parte de Trabajo Personal</h1>
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto w-full">
                
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Calendar size={16} className="text-slate-600"/> Fecha
                    </label>
                    <input 
                        type="date" 
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                            <Clock size={16} /> Horas Trabajadas *
                        </label>
                        <input
                            type="number"
                            required
                            step="0.5"
                            placeholder="Ej. 8"
                            value={hours}
                            onChange={e => setHours(Number(e.target.value))}
                            className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                            <MapPin size={16} /> Ubicación / Tajo
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Cantera Principal, Taller..."
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Descripción de Tareas *</label>
                        <textarea
                            required
                            rows={4}
                            placeholder="Describe los trabajos realizados..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-full py-4 bg-slate-800 rounded-xl text-white font-bold text-lg shadow-lg flex justify-center items-center gap-2 hover:bg-slate-900 active:transform active:scale-95 transition-all"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {isSaving ? "Enviando..." : "Guardar Parte"}
                </button>
            </div>
        </form>
    );
};
