import React, { useState, useEffect } from 'react';
import { Worker } from '../types';
import { getWorkers } from '../services/db';
import { Loader2, UserCircle, AlertTriangle, RefreshCcw } from 'lucide-react';

interface LoginProps {
  onLogin: (worker: Worker) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = () => {
    setLoading(true);
    getWorkers()
      .then(data => {
        setWorkers(data);
      })
      .catch(err => {
        console.error("Error cargando trabajadores:", err);
        setError("Error al cargar la lista de trabajadores.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const worker = workers.find(w => w.id === selectedWorkerId);
    
    if (!worker) {
      setError('Seleccione un trabajador');
      return;
    }

    // Auth simple: 4 primeros dígitos del DNI
    const firstFour = worker.dni ? worker.dni.substring(0, 4) : '0000';
    if (password === firstFour) {
      onLogin(worker);
    } else {
      setError('Clave incorrecta (4 primeros dígitos del DNI)');
    }
  };

  const getRoleLabel = (role: string) => {
    switch(role.toLowerCase()) {
      case 'admin': return 'Admin';
      case 'cp': return 'Cantera';
      case 'cr': return 'Rodado';
      default: return 'Operario';
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;
  }

  if (workers.length === 0) {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="bg-amber-100 p-3 rounded-full mb-4 w-16 h-16 mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No se encontraron trabajadores</h2>
                <p className="text-slate-600 mb-6 text-sm">
                    La lista de trabajadores está vacía o no se pudo conectar con la base de datos.
                </p>
                <button 
                    onClick={loadWorkers}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                    <RefreshCcw size={18} /> Reintentar Carga
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-50 p-3 rounded-full mb-4">
            <UserCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-red-600 mb-1">Aridos Marraque</h1>
          <p className="text-slate-500 font-medium">Gestión Integral</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Seleccione su nombre
            </label>
            <div className="relative">
                <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-slate-900 appearance-none"
                >
                <option value="" className="text-slate-500">-- Seleccionar Trabajador --</option>
                {workers.map(w => (
                    <option key={w.id} value={w.id} className="text-slate-900 font-medium py-2">
                        {w.name} ({getRoleLabel(w.role)})
                    </option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Clave (4 primeros dígitos DNI)
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-slate-900"
              placeholder="****"
              maxLength={4}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-md active:transform active:scale-95"
          >
            Entrar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
};
