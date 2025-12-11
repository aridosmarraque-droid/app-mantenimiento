
import React from 'react';
import { Hammer, Mountain, LogOut } from 'lucide-react';

interface Props {
    onSelectMaintenance: () => void;
    onSelectProduction: () => void;
    onLogout: () => void;
    workerName: string;
}

export const CPSelection: React.FC<Props> = ({ onSelectMaintenance, onSelectProduction, onLogout, workerName }) => {
    return (
        <div className="flex flex-col min-h-screen bg-slate-100">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-lg">
                <div>
                    <h1 className="font-bold text-lg text-amber-500">Cantera Pura</h1>
                    <p className="text-xs text-slate-300">Hola, {workerName}</p>
                </div>
                <button onClick={onLogout} className="text-slate-300 hover:text-white">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">¿Qué deseas realizar hoy?</h2>
                
                <button 
                    onClick={onSelectMaintenance}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-white border-2 border-blue-200 rounded-xl shadow-md hover:bg-blue-50 hover:border-blue-300 transition-all group"
                >
                    <Hammer className="w-16 h-16 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold text-slate-700">Registrar Mantenimiento</span>
                    <span className="text-sm text-slate-500 mt-2">Niveles, Averías, Repostajes...</span>
                </button>

                <button 
                    onClick={onSelectProduction}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-white border-2 border-amber-200 rounded-xl shadow-md hover:bg-amber-50 hover:border-amber-300 transition-all group"
                >
                    <Mountain className="w-16 h-16 text-amber-600 mb-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold text-slate-700">Parte Cantera Pura</span>
                    <span className="text-sm text-slate-500 mt-2">Horas Producción (Machacadora/Molinos)</span>
                </button>
            </div>
        </div>
    );
}
