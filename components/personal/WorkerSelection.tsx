
import React from 'react';
import { Hammer, ClipboardList } from 'lucide-react';

interface Props {
    onSelectMachines: () => void;
    onSelectPersonalReport: () => void;
    onLogout: () => void;
    workerName: string;
}

export const WorkerSelection: React.FC<Props> = ({ onSelectMachines, onSelectPersonalReport, onLogout, workerName }) => {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col items-center justify-center py-6 gap-6">
                <h2 className="text-xl font-bold text-slate-800 text-center mb-2">¿Qué deseas realizar hoy?</h2>
                
                <button 
                    onClick={onSelectMachines}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-white border-2 border-blue-200 rounded-xl shadow-md hover:bg-blue-50 hover:border-blue-300 transition-all group"
                >
                    <Hammer className="w-16 h-16 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold text-slate-700">Mantenimiento Maquinaria</span>
                    <span className="text-sm text-slate-500 mt-2">Niveles, Averías, Repostajes...</span>
                </button>

                <button 
                    onClick={onSelectPersonalReport}
                    className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-xl shadow-md hover:bg-slate-50 hover:border-slate-300 transition-all group"
                >
                    <ClipboardList className="w-16 h-16 text-slate-600 mb-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-bold text-slate-700">Parte Trabajo Personal</span>
                    <span className="text-sm text-slate-500 mt-2">Reporte de horas y trabajos realizados</span>
                </button>
            </div>
        </div>
    );
};

