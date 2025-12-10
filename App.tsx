
import React, { useState } from 'react';
import { Worker, Machine, CostCenter, OperationType, OperationLog } from './types';
import { Login } from './components/Login';
import { MachineSelector } from './components/MachineSelector';
import { MainMenu } from './components/MainMenu';
import { LevelsForm } from './components/forms/LevelsForm';
import { BreakdownForm } from './components/forms/BreakdownForm';
import { MaintenanceForm } from './components/forms/MaintenanceForm';
import { ScheduledMaintenanceForm } from './components/forms/ScheduledMaintenanceForm';
import { CreateCenterForm } from './components/admin/CreateCenterForm';
import { CreateMachineForm } from './components/admin/CreateMachineForm';
import { EditMachineForm } from './components/admin/EditMachineForm'; // Importar
import { saveOperationLog } from './services/db';
import { isConfigured } from './services/client';
import { LayoutDashboard, CheckCircle2, DatabaseZap, Menu, X, PlusCircle, Factory, Truck, Settings } from 'lucide-react';

enum ViewState {
  LOGIN,
  CONTEXT_SELECTION,
  ACTION_MENU,
  FORM,
  ADMIN_CREATE_CENTER,
  ADMIN_CREATE_MACHINE,
  ADMIN_SELECT_MACHINE_TO_EDIT, // Nuevo estado
  ADMIN_EDIT_MACHINE // Nuevo estado
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOGIN);
  const [currentUser, setCurrentUser] = useState<Worker | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [selectedContext, setSelectedContext] = useState<{ machine: Machine, center: CostCenter } | null>(null);
  const [machineToEdit, setMachineToEdit] = useState<Machine | null>(null); // Estado para la máquina a editar
  const [selectedAction, setSelectedAction] = useState<OperationType | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogin = (worker: Worker) => {
    setCurrentUser(worker);
    setViewState(ViewState.CONTEXT_SELECTION);
  };

  const handleContextSelect = (machine: Machine, center: CostCenter) => {
    setSelectedContext({ machine, center });
    setViewState(ViewState.ACTION_MENU);
  };

  // Handler para seleccionar máquina a editar
  const handleEditSelection = (machine: Machine, center: CostCenter) => {
      setMachineToEdit(machine);
      setViewState(ViewState.ADMIN_EDIT_MACHINE);
  }

  const handleActionSelect = (type: OperationType) => {
    setSelectedAction(type);
    setViewState(ViewState.FORM);
  };

  const handleAdminNavigate = (view: ViewState) => {
      setViewState(view);
      setIsMenuOpen(false);
  };

  const handleFormSubmit = async (data: Partial<OperationLog>) => {
    if (!currentUser || !selectedContext || !selectedAction) return;

    try {
      const logData: Omit<OperationLog, 'id'> = {
        date: selectedDate,
        workerId: currentUser.id,
        machineId: selectedContext.machine.id,
        type: selectedAction,
        hoursAtExecution: data.hoursAtExecution || selectedContext.machine.currentHours, // Fallback
        ...data,
      };

      await saveOperationLog(logData);
      
      if (logData.hoursAtExecution && logData.hoursAtExecution > selectedContext.machine.currentHours) {
        selectedContext.machine.currentHours = logData.hoursAtExecution;
      }

      setSuccessMsg('Operación registrada correctamente');
      setTimeout(() => {
        setSuccessMsg('');
        setViewState(ViewState.ACTION_MENU);
        setSelectedAction(null);
      }, 2000);

    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminSuccess = (msg: string) => {
      setSuccessMsg(msg);
      setTimeout(() => {
          setSuccessMsg('');
          setViewState(ViewState.CONTEXT_SELECTION);
      }, 1500);
  };

  const renderContent = () => {
    if (viewState === ViewState.LOGIN) {
      return (
        <div className="flex flex-col min-h-screen">
            {!isConfigured && (
                <div className="bg-amber-100 text-amber-800 text-xs text-center p-2 border-b border-amber-200 font-medium flex items-center justify-center gap-2">
                    <DatabaseZap size={14}/> Modo Demo: Base de datos simulada
                </div>
            )}
            <Login onLogin={handleLogin} />
        </div>
      );
    }

    // Wrapped in Layout
    return (
      <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 shadow-xl overflow-hidden min-h-screen relative">
        {/* Header */}
        <header className="bg-slate-800 text-white shadow-lg sticky top-0 z-20">
          {!isConfigured && (
             <div className="bg-amber-500 text-white text-[10px] text-center p-1 font-bold">
                MODO DEMO (Sin conexión DB)
             </div>
          )}
          <div className="p-4 flex justify-between items-center relative">
            <h1 className="font-bold text-lg flex items-center gap-2 text-red-500">
              <LayoutDashboard className="w-5 h-5" />
              Aridos Marraque
            </h1>
            <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-300">Usuario</p>
                    <p className="text-sm font-semibold">{currentUser?.name}</p>
                </div>
                {currentUser?.role === 'admin' && (
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-slate-700 rounded transition-colors">
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                )}
            </div>
          </div>
          
          {/* Admin Menu Dropdown */}
          {isMenuOpen && (
              <div className="absolute top-full right-0 w-64 bg-white shadow-2xl rounded-bl-xl overflow-hidden border-l border-b border-slate-200 z-30 animate-in slide-in-from-top-5">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administración</p>
                  </div>
                  <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CREATE_CENTER)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 border-b border-slate-50 transition-colors">
                      <Factory className="w-5 h-5 text-blue-500" />
                      Nueva Cantera / Grupo
                  </button>
                  <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CREATE_MACHINE)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 border-b border-slate-50 transition-colors">
                      <Truck className="w-5 h-5 text-blue-500" />
                      Nueva Máquina
                  </button>
                   <button onClick={() => handleAdminNavigate(ViewState.ADMIN_SELECT_MACHINE_TO_EDIT)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 transition-colors">
                      <Settings className="w-5 h-5 text-blue-500" />
                      Modificar Máquina
                  </button>
                  <div className="p-4 border-t border-slate-100 mt-2">
                       <button onClick={() => setViewState(ViewState.LOGIN)} className="text-red-500 text-sm font-medium w-full text-left">Cerrar Sesión</button>
                  </div>
              </div>
          )}
        </header>
        
        {/* Overlay when menu is open */}
        {isMenuOpen && <div className="fixed inset-0 bg-black/20 z-10" onClick={() => setIsMenuOpen(false)}></div>}

        {/* Main Content */}
        <main className="flex-1 p-4 overflow-y-auto">
          {successMsg ? (
            <div className="flex flex-col items-center justify-center h-full text-green-600 animate-fade-in">
              <CheckCircle2 className="w-20 h-20 mb-4" />
              <h2 className="text-2xl font-bold text-center">{successMsg}</h2>
            </div>
          ) : (
            <>
              {/* Flujo Normal: Selección de Contexto */}
              {viewState === ViewState.CONTEXT_SELECTION && (
                <MachineSelector 
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  onSelect={handleContextSelect} 
                />
              )}

              {/* Flujo Admin: Selección de Máquina a Editar */}
              {viewState === ViewState.ADMIN_SELECT_MACHINE_TO_EDIT && (
                  <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center mb-4">
                          <p className="text-blue-800 font-bold">Modo Administrador: Selecciona la máquina a modificar</p>
                      </div>
                      <MachineSelector 
                        selectedDate={new Date()} // Fecha irrelevante para editar
                        onChangeDate={() => {}} 
                        onSelect={handleEditSelection}
                      />
                      <button onClick={() => setViewState(ViewState.CONTEXT_SELECTION)} className="w-full py-3 text-slate-500 font-medium">Cancelar</button>
                  </div>
              )}

              {viewState === ViewState.ADMIN_CREATE_CENTER && (
                  <CreateCenterForm 
                    onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                    onSuccess={() => handleAdminSuccess('Cantera creada correctamente')}
                  />
              )}

              {viewState === ViewState.ADMIN_CREATE_MACHINE && (
                  <CreateMachineForm 
                    onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                    onSuccess={() => handleAdminSuccess('Máquina creada correctamente')}
                  />
              )}

              {viewState === ViewState.ADMIN_EDIT_MACHINE && machineToEdit && (
                  <EditMachineForm 
                    machine={machineToEdit}
                    onBack={() => setViewState(ViewState.ADMIN_SELECT_MACHINE_TO_EDIT)}
                    onSuccess={() => handleAdminSuccess('Máquina actualizada correctamente')}
                  />
              )}

              {viewState === ViewState.ACTION_MENU && selectedContext && (
                <MainMenu 
                  machineName={selectedContext.machine.name}
                  onSelect={handleActionSelect} 
                  onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                />
              )}

              {viewState === ViewState.FORM && selectedContext && selectedAction && (
                <div className="animate-in slide-in-from-right duration-300">
                  {selectedAction === 'LEVELS' && (
                    <LevelsForm 
                      machine={selectedContext.machine} 
                      onSubmit={handleFormSubmit}
                      onCancel={() => setViewState(ViewState.ACTION_MENU)}
                    />
                  )}
                  {selectedAction === 'BREAKDOWN' && (
                    <BreakdownForm 
                      machine={selectedContext.machine} 
                      onSubmit={handleFormSubmit}
                      onCancel={() => setViewState(ViewState.ACTION_MENU)}
                    />
                  )}
                  {selectedAction === 'MAINTENANCE' && (
                    <MaintenanceForm 
                      machine={selectedContext.machine} 
                      onSubmit={handleFormSubmit}
                      onCancel={() => setViewState(ViewState.ACTION_MENU)}
                    />
                  )}
                  {selectedAction === 'SCHEDULED' && (
                    <ScheduledMaintenanceForm 
                      machine={selectedContext.machine} 
                      onSubmit={handleFormSubmit}
                      onCancel={() => setViewState(ViewState.ACTION_MENU)}
                    />
                  )}
                  {selectedAction === 'REFUELING' && (
                    <div className="bg-white p-6 rounded-xl shadow-md text-center">
                        <h3 className="text-lg font-bold mb-4">Registro de Repostaje</h3>
                         <form onSubmit={(e) => {
                             e.preventDefault();
                             // @ts-ignore
                             const h = Number(e.target.hours.value);
                             // @ts-ignore
                             const l = Number(e.target.litres.value);
                             handleFormSubmit({ hoursAtExecution: h, fuelLitres: l });
                         }} className="space-y-4 text-left">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Horas Actuales</label>
                                <input name="hours" type="number" placeholder="Horas" className="w-full border p-3 rounded-lg" required min={selectedContext.machine.currentHours} defaultValue={selectedContext.machine.currentHours}/>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Litros Repostados</label>
                                <input name="litres" type="number" placeholder="Litros" className="w-full border p-3 rounded-lg" required />
                             </div>
                             
                             <button className="bg-green-600 text-white w-full py-3 rounded font-bold hover:bg-green-700">Guardar Repostaje</button>
                             <button type="button" onClick={() => setViewState(ViewState.ACTION_MENU)} className="w-full text-slate-500 py-2">Cancelar</button>
                         </form>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  };

  return renderContent();
}

export default App;
