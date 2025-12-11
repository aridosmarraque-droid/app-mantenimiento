
import React from 'react';
import { Hammer, Mountain } from 'lucide-react';

interface Props {
    onSelectOperation: () => void;
    onSelectCP: () => void;
}

export const CPSelection: React.FC<Props> = ({ onSelectOperation, onSelectCP }) => {
    return (
        <div className="flex flex-col gap-6 p-6 h-full justify-center">
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">¿Qué deseas realizar hoy?</h2>
            
            <button 
                onClick={onSelectOperation}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-blue-200 rounded-xl shadow-md hover:bg-blue-50 hover:border-blue-300 transition-all group"
            >
                <Hammer className="w-16 h-16 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                <span className="text-xl font-bold text-slate-700">Registrar Mantenimiento</span>
                <span className="text-sm text-slate-500 mt-2">Niveles, Averías, Repostajes...</span>
            </button>

            <button 
                onClick={onSelectCP}
                className="flex flex-col items-center justify-center p-8 bg-white border-2 border-amber-200 rounded-xl shadow-md hover:bg-amber-50 hover:border-amber-300 transition-all group"
            >
                <Mountain className="w-16 h-16 text-amber-600 mb-4 group-hover:scale-110 transition-transform" />
                <span className="text-xl font-bold text-slate-700">Parte Cantera Pura</span>
                <span className="text-sm text-slate-500 mt-2">Producción, Molinos, Machacadora...</span>
            </button>
        </div>
    );
}
