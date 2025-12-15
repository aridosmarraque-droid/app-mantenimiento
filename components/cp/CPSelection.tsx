
import React from 'react';
import { Hammer, Mountain, ClipboardList } from 'lucide-react';

interface Props {
    onSelectMaintenance: () => void;
    onSelectProduction: () => void;
    onSelectPersonalReport: () => void;
    onLogout: () => void;
    workerName: string;
}

export const CPSelection: React.FC<Props> = ({ onSelectMaintenance, onSelectProduction, onSelectPersonalReport, onLogout, workerName }) => {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-6">
                <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">¿Qué deseas realizar hoy?</h2>
                
                <button 
                    onClick={onSelectMaintenance}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-6 bg-white border-2 border-blue-200 rounded-xl shadow-md hover:bg-blue-50 hover:border-blue-300 transition-all group"
                >
                    <Hammer className="w-12 h-12 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-bold text-slate-700">Mantenimiento Maquinaria</span>
                    <span className="text-xs text-slate-500">Niveles, Averías, Repostajes...</span>
                </button>

                <button 
                    onClick={onSelectProduction}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-6 bg-white border-2 border-amber-200 rounded-xl shadow-md hover:bg-amber-50 hover:border-amber-300 transition-all group"
                >
                    <Mountain className="w-12 h-12 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-bold text-slate-700">Parte Cantera Pura</span>
                    <span className="text-xs text-slate-500">Horas Producción</span>
                </button>

                <button 
                    onClick={onSelectPersonalReport}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-6 bg-white border-2 border-green-200 rounded-xl shadow-md hover:bg-green-50 hover:border-green-300 transition-all group"
                >
                    <ClipboardList className="w-12 h-12 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-bold text-slate-700">Parte de Trabajo Personal</span>
                    <span className="text-xs text-slate-500">Horas trabajadas por máquina</span>
                </button>
            </div>
        </div>
    );
}
