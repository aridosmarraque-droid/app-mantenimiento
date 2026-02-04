import React, { useState, useEffect } from 'react';
import { getCPWeeklyPlan, saveCPWeeklyPlan, toLocalDateString } from '../../services/db';
import { CPWeeklyPlan } from '../../types';
// Fix: Added missing CheckCircle2 import from lucide-react
import { ArrowLeft, Save, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

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
        d.setHours(0, 0, 0, 0); // Resetear tiempo para evitar saltos de día por zona horaria
        const day = d.getDay();
        const diff = (1 + 7 - day) % 7;
        d.setDate(d.getDate() + diff);
        return d;
    }

    const formattedMonday = toLocalDateString(selectedMonday);

    useEffect(() => {
        console.log(`[WeeklyPlanning] Iniciando carga para la fecha: ${formattedMonday}`);
        loadPlan();
    }, [formattedMonday]);

    const loadPlan = async () => {
        setLoading(true);
        try {
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
                setHours({ mon: 8, tue: 8, wed: 8, thu: 8, fri: 8 }); // Valores por defecto
            }
        } catch (e) {
            console.error("[WeeklyPlanning] Error crítico al cargar planificación:", e);
        } finally {
            setLoading(false);
        }
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
                id: '', // Supabase maneja el ID o el upsert por fecha
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
            console.error("[WeeklyPlanning] Error crítico al guardar planificación:", e);
            alert("Error al guardar planificación. Revise la consola del navegador para más detalles técnicos.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (day: keyof typeof hours, val: string) => {
        setHours(prev => ({ ...prev, [day]: Number(val) }));
    };

    // Helper para mostrar el nombre del día y número
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
                {/* Selector de Semana */}
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
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2 uppercase text-xs tracking-widest">Horas Esperadas Producción (Molinos)</h3>
                    
                    <div className="space-y-3">
                        {(['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day, idx) => (
                            <div key={day} className={`flex items-center justify-between ${idx % 2 !== 0 ? 'bg-slate-50' : ''} p-2 rounded-lg`}>
                                <label className="text-sm font-medium capitalize text-slate-600">{getDateLabel(idx)}</label>
                                <input 
                                    type="number" 
                                    value={hours[day]} 
                                    onChange={e => handleChange(day, e.target.value)} 
                                    className="w-20 p-2 border rounded-xl text-center font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t mt-4 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-400 uppercase">
                            Total Semana: <span className="text-slate-800 font-black ml-1">{hours.mon + hours.tue + hours.wed + hours.thu + hours.fri}h</span>
                        </div>
                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest text-white transition-all shadow-lg ${msg ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'}`}
                        >
                            {msg ? <CheckCircle2 size={16}/> : <Save size={16} />} 
                            {msg || (loading ? 'Guardando...' : 'Guardar Plan')}
                        </button>
                    </div>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                    <CalendarDays className="text-amber-500 shrink-0" size={20}/>
                    <p className="text-[10px] text-amber-800 leading-relaxed italic">
                        Configure las horas teóricas de funcionamiento de la planta para esta semana. Este dato se usará para calcular el porcentaje de rendimiento diario en los cuadros de mando de administración.
                    </p>
                </div>
            </div>
        </div>
    );
};
