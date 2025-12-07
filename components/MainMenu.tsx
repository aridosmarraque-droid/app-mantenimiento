import React from 'react';
import { Droplet, Wrench, Hammer, Fuel, CalendarClock, ArrowLeft } from 'lucide-react';
import { OperationType } from '../types';

interface MainMenuProps {
  onSelect: (type: OperationType) => void;
  onBack: () => void;
  machineName: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect, onBack, machineName }) => {
  const menuItems = [
    { id: 'LEVELS', label: 'Niveles', icon: Droplet, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'BREAKDOWN', label: 'Averías', icon: Wrench, color: 'bg-red-50 text-red-600 border-red-200' },
    { id: 'MAINTENANCE', label: 'Mantenimiento', icon: Hammer, color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { id: 'REFUELING', label: 'Repostaje', icon: Fuel, color: 'bg-green-50 text-green-600 border-green-200' },
    { id: 'SCHEDULED', label: 'Programados', icon: CalendarClock, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Atrás
        </button>
        <span className="font-semibold text-slate-700">{machineName}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id as OperationType)}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 ${item.color}`}
            >
              <Icon className="w-10 h-10 mb-3" />
              <span className="font-bold text-lg">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
