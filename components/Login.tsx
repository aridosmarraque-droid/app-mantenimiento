import React, { useState, useEffect } from 'react';
import { Worker } from '../types';
import { getWorkers } from '../services/db';
import { Loader2, UserCircle } from 'lucide-react';

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
    getWorkers().then(data => {
      setWorkers(data);
      setLoading(false);
    });
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const worker = workers.find(w => w.id === selectedWorkerId);
    
    if (!worker) {
      setError('Seleccione un trabajador');
      return;
    }

    const firstFour = worker.dni.substring(0, 4);
    if (password === firstFour) {
      onLogin(worker);
    } else {
      setError('Clave incorrecta (4 primeros dígitos del DNI)');
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-50 p-3 rounded-full mb-4">
            <UserCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-red-600 mb-1">Aridos Marraque</h1>
          <p className="text-slate-500 font-medium">Gestión de Mantenimiento</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Trabajador
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">-- Seleccionar --</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
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
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="****"
              maxLength={4}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
};
