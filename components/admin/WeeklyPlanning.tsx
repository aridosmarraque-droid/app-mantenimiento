
import React, { useState, useEffect } from 'react';
import { getCPWeeklyPlan, saveCPWeeklyPlan } from '../../services/db';
import { CPWeeklyPlan } from '../../types';
import { ArrowLeft, Save, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    onBack: () => void;
}

export const WeeklyPlanning: React.FC<Props> = ({ onBack }) => {
    const [selectedMonday, setSelectedMonday] = useState<Date>(getNextMonday());
    const [hours, setHours] = useState({
        mon: 0, tue: 0, wed: 0, thu: 0, fri: 0
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    function getNextMonday() {
        const d = new Date();
        d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
        return d;
    }

    const formattedMonday = selectedMonday.toISOString().split('T')[0];

    useEffect(() => {
        loadPlan();
    }, [selectedMonday]);

    const loadPlan = async () => {
        setLoading(true);
        const plan = await getCPWeeklyPlan(formattedMonday);
        if (plan) {
            setHours({
                mon: plan.hoursMon,
                tue: plan.hoursTue,
                wed: plan.hoursWed,
                thu: plan.hoursThu,
                fri: plan.hoursFri
            });
        } else {
            setHours({ mon: 8, tue: 8, wed: 8, thu: 8, fri: 8 }); // Default values
        }
        setLoading(false);
    };

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedMonday);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setSelectedMonday(newDate);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const plan: CPWeeklyPlan = {
                id: '', // DB handles ID usually or Upsert
                mondayDate: formattedMonday,
                hoursMon: hours.mon,
                hoursTue: hours.tue,
                hoursWed: hours.wed,
                hoursThu: hours.thu,
                hoursFri: hours.fri
            };
            await saveCPWeeklyPlan(plan);
            setMsg('Planificación guardada');
            setTimeout(() => setMsg(''), 2000);
        } catch (e) {
            alert("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (day: keyof typeof hours, val: string) => {
        setHours(prev => ({ ...prev, [day]: Number(val) }));
    };

    // Helper to format date display for inputs
    const getDateLabel = (offset: number) => {
        const d = new Date(selectedMonday);
        d.setDate(d.getDate() + offset);
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 min-h-screen">
            <div className="bg-white p-4 shadow-sm border-b flex items-center gap-2 sticky top-0 z-10">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <CalendarDays className="text-blue-600" /> Planificación Semanal
                </h2>
            </div>

            <div className="p-4 max-w-lg mx-auto w-full space-y-6">
                {/* Week Selector */}
                <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-slate-100 rounded-full">
                        <ChevronLeft size={24} className="text-slate-600" />
                    </button>
                    <div className="text-center">
                        <p className="text-xs text-slate-500 font-bold uppercase">Semana del Lunes</p>
                        <p className="text-lg font-bold text-blue-700">{selectedMonday.toLocaleDateString('es-ES')}</p>
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-slate-100 rounded-full">
                        <ChevronRight size={24} className="text-slate-600" />
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Horas Esperadas Producción</h3>
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium capitalize w-1/2">{getDateLabel(0)}</label>
                            <input type="number" value={hours.mon} onChange={e => handleChange('mon', e.target.value)} className="w-20 p-2 border rounded text-center font-bold" />
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                            <label className="text-sm font-medium capitalize w-1/2">{getDateLabel(1)}</label>
                            <input type="number" value={hours.tue} onChange={e => handleChange('tue', e.target.value)} className="w-20 p-2 border rounded text-center font-bold" />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium capitalize w-1/2">{getDateLabel(2)}</label>
                            <input type="number" value={hours.wed} onChange={e => handleChange('wed', e.target.value)} className="w-20 p-2 border rounded text-center font-bold" />
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                            <label className="text-sm font-medium capitalize w-1/2">{getDateLabel(3)}</label>
                            <input type="number" value={hours.thu} onChange={e => handleChange('thu', e.target.value)} className="w-20 p-2 border rounded text-center font-bold" />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium capitalize w-1/2">{getDateLabel(4)}</label>
                            <input type="number" value={hours.fri} onChange={e => handleChange('fri', e.target.value)} className="w-20 p-2 border rounded text-center font-bold" />
                        </div>
                    </div>

                    <div className="pt-4 border-t mt-4 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Total: <span className="font-bold text-slate-800">{hours.mon + hours.tue + hours.wed + hours.thu + hours.fri} horas</span>
                        </div>
                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all ${msg ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Save size={18} /> {msg || (loading ? '...' : 'Guardar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
