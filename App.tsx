
import React, { useState, useEffect } from 'react';
import { Worker, Machine, CostCenter, OperationType, OperationLog, CPDailyReport } from './types';
import { Login } from './components/Login';
import { MachineSelector } from './components/MachineSelector';
import { MainMenu } from './components/MainMenu';
import { LevelsForm } from './components/forms/LevelsForm';
import { BreakdownForm } from './components/forms/BreakdownForm';
import { MaintenanceForm } from './components/forms/MaintenanceForm';
import { ScheduledMaintenanceForm } from './components/forms/ScheduledMaintenanceForm';
import { CreateCenterForm } from './components/admin/CreateCenterForm';
import { CreateMachineForm } from './components/admin/CreateMachineForm';
import { EditMachineForm } from './components/admin/EditMachineForm';
import { MachineLogsViewer } from './components/admin/MachineLogsViewer';
import { CPSelection } from './components/cp/CPSelection';
import { DailyReportForm } from './components/cp/DailyReportForm';
import { WeeklyPlanning } from './components/admin/WeeklyPlanning';
import { ProductionDashboard } from './components/admin/ProductionDashboard';
import { saveOperationLog, calculateAndSyncMachineStatus, saveCPReport, syncPendingData } from './services/db';
import { getQueue } from './services/offlineQueue';
import { isConfigured } from './services/client';
import { sendEmail } from './services/api'; 
import { generateCPReportPDF } from './services/pdf'; 
import { LayoutDashboard, CheckCircle2, DatabaseZap, Menu, X, Factory, Truck, Settings, FileSearch, CalendarDays, TrendingUp, Mail, WifiOff, RefreshCcw } from 'lucide-react';

enum ViewState {
  LOGIN,
  CP_SELECTION,
  CP_DAILY_REPORT,
  CONTEXT_SELECTION,
  ACTION_MENU,
  FORM,
  ADMIN_CREATE_CENTER,
  ADMIN_CREATE_MACHINE,
  ADMIN_SELECT_MACHINE_TO_EDIT,
  ADMIN_EDIT_MACHINE,
  ADMIN_VIEW_LOGS,
  ADMIN_CP_PLANNING,
  ADMIN_PRODUCTION_DASHBOARD
}

function App() {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOGIN);
  const [currentUser, setCurrentUser] = useState<Worker | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [selectedContext, setSelectedContext] = useState<{ machine: Machine, center: CostCenter } | null>(null);
  const [machineToEdit, setMachineToEdit] = useState<Machine | null>(null);
  const [selectedAction, setSelectedAction] = useState<OperationType | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Online/Offline State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
      const handleStatusChange = () => {
          setIsOnline(navigator.onLine);
      };
      
      // Update pending items count periodically
      const checkQueue = () => {
          setPendingItems(getQueue().length);
      };

      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);
      
      const interval = setInterval(checkQueue, 2000);
      checkQueue();

      return () => {
          window.removeEventListener('online', handleStatusChange);
          window.removeEventListener('offline', handleStatusChange);
          clearInterval(interval);
      };
  }, []);

  const handleForceSync = async () => {
      if (!isOnline) {
          alert("No hay conexión a internet. Busca cobertura.");
          return;
      }
      setIsSyncing(true);
      const res = await syncPendingData();
      setIsSyncing(false);
      setPendingItems(getQueue().length);
      if (res.synced > 0) {
          setSuccessMsg(`${res.synced} datos sincronizados.`);
          setTimeout(() => setSuccessMsg(''), 2000);
      } else if (res.errors > 0) {
          alert(`Hubo errores al sincronizar ${res.errors} elementos. Inténtalo de nuevo.`);
      }
  };

  const handleLogin = (worker: Worker) => {
    setCurrentUser(worker);
    if (worker.role === 'cp') {
        setViewState(ViewState.CP_SELECTION);
    } else {
        setViewState(ViewState.CONTEXT_SELECTION);
    }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setViewState(ViewState.LOGIN);
      setIsMenuOpen(false);
  }

  const handleContextSelect = (machine: Machine, center: CostCenter) => {
    setSelectedContext({ machine, center });
    setViewState(ViewState.ACTION_MENU);
  };

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

  const handleCPReportSubmit = async (data: Omit<CPDailyReport, 'id'>) => {
      try {
          // 1. Guardar en Base de Datos (o cola offline)
          await saveCPReport(data);
          
          // 2. Intentar Email (Si offline, esto fallará silenciosamente en api.ts o se puede manejar)
          // La generación de PDF es local, así que no hay problema
          setSuccessMsg('Guardando...');
          
          if (currentUser && navigator.onLine) {
              setSuccessMsg('Generando PDF y Enviando...');
              const pdfBase64 = generateCPReportPDF(data, currentUser.name);
              
              const emailSubject = `Parte Producción - ${data.date.toLocaleDateString()} - ${currentUser.name}`;
              const emailHtml = `
                <h2>Parte Diario de Producción</h2>
                <p><strong>Fecha:</strong> ${data.date.toLocaleDateString()}</p>
                <p><strong>Operario:</strong> ${currentUser.name}</p>
                <p>Adjunto encontrarás el informe detallado en PDF.</p>
                <br/>
                <p><em>GMAO Aridos Marraque</em></p>
              `;

              const { success } = await sendEmail(
                  ['aridos@marraque.es'], 
                  emailSubject, 
                  emailHtml, 
                  pdfBase64, 
                  `Parte_${data.date.toISOString().split('T')[0]}.pdf`
              );

              if (success) {
                  setSuccessMsg('Guardado y Email Enviado ✅');
              } else {
                  setSuccessMsg('Guardado (Email falló) ⚠️');
              }
          } else {
              setSuccessMsg(navigator.onLine ? 'Guardado ✅' : 'Guardado en cola (Offline) 📡');
          }

          setTimeout(() => {
              setSuccessMsg('');
              setViewState(ViewState.CP_SELECTION);
          }, 2500);
      } catch (e) {
          console.error(e);
          setSuccessMsg('Error al guardar');
          setTimeout(() => setSuccessMsg(''), 2000);
      }
  };

  const handleFormSubmit = async (data: Partial<OperationLog>) => {
    if (!currentUser || !selectedContext || !selectedAction) return;

    try {
      const logData: Omit<OperationLog, 'id'> = {
        date: selectedDate,
        workerId: currentUser.id,
        machineId: selectedContext.machine.id,
        type: selectedAction,
        hoursAtExecution: data.hoursAtExecution || selectedContext.machine.currentHours,
        ...data,
      };

      await saveOperationLog(logData);
      
      const newHours = logData.hoursAtExecution && logData.hoursAtExecution > selectedContext.machine.currentHours
          ? logData.hoursAtExecution 
          : selectedContext.machine.currentHours;

      // Optimistic update for UI if online, or local logic
      // Note: calculateAndSyncMachineStatus checks online status internally now
      try {
          const tempMachine = { ...selectedContext.machine, currentHours: newHours };
          const updatedMachine = await calculateAndSyncMachineStatus(tempMachine);
          
          setSelectedContext({
              ...selectedContext,
              machine: updatedMachine
          });
      } catch (err) {
           // Ignore errors in optimistic UI update
      }

      setSuccessMsg(navigator.onLine ? 'Operación registrada' : 'Guardado en dispositivo (Sin Red)');
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

  if (viewState === ViewState.CP_SELECTION && currentUser) {
      return (
          <CPSelection 
            workerName={currentUser.name}
            onSelectMaintenance={() => setViewState(ViewState.CONTEXT_SELECTION)}
            onSelectProduction={() => setViewState(ViewState.CP_DAILY_REPORT)}
            onLogout={handleLogout}
          />
      );
  }

  if (viewState === ViewState.CP_DAILY_REPORT && currentUser) {
      return (
          <DailyReportForm 
            workerId={currentUser.id}
            onBack={() => setViewState(ViewState.CP_SELECTION)}
            onSubmit={handleCPReportSubmit}
          />
      );
  }

  return (
      <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 shadow-xl overflow-hidden min-h-screen relative">
        <header className="bg-slate-800 text-white shadow-lg sticky top-0 z-20">
          {/* OFFLINE / SYNC BANNER */}
          {(!isOnline || pendingItems > 0) && (
              <div className={`text-white text-xs text-center p-2 font-bold flex items-center justify-between px-4 ${isOnline ? 'bg-orange-500' : 'bg-red-600'}`}>
                  <div className="flex items-center gap-2">
                    {!isOnline ? <WifiOff size={14} /> : <DatabaseZap size={14} />}
                    <span>{!isOnline ? 'Sin Conexión' : 'Datos Pendientes'}: {pendingItems}</span>
                  </div>
                  {isOnline && pendingItems > 0 && (
                      <button 
                        onClick={handleForceSync} 
                        disabled={isSyncing}
                        className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded flex items-center gap-1"
                      >
                          <RefreshCcw size={12} className={isSyncing ? 'animate-spin' : ''} />
                          {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                  )}
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
                {currentUser?.role === 'cp' && viewState !== ViewState.CP_SELECTION && (
                    <button onClick={() => setViewState(ViewState.CP_SELECTION)} className="text-xs bg-slate-700 px-2 py-1 rounded">
                        Volver Inicio
                    </button>
                )}
            </div>
          </div>
          
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
                   <button onClick={() => handleAdminNavigate(ViewState.ADMIN_SELECT_MACHINE_TO_EDIT)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 border-b border-slate-50 transition-colors">
                      <Settings className="w-5 h-5 text-blue-500" />
                      Modificar Máquina
                  </button>
                  <div className="p-2 border-b border-slate-50"></div>
                  <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CP_PLANNING)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 border-b border-slate-50 transition-colors">
                      <CalendarDays className="w-5 h-5 text-amber-500" />
                      Planificación Cantera
                  </button>
                  <button onClick={() => handleAdminNavigate(ViewState.ADMIN_PRODUCTION_DASHBOARD)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 border-b border-slate-50 transition-colors">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                      Informes Producción
                  </button>
                   <button onClick={() => handleAdminNavigate(ViewState.ADMIN_VIEW_LOGS)} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center gap-3 transition-colors">
                      <FileSearch className="w-5 h-5 text-blue-500" />
                      Consultar Registros
                  </button>
                  <div className="p-4 border-t border-slate-100 mt-2">
                       <button onClick={handleLogout} className="text-red-500 text-sm font-medium w-full text-left">Cerrar Sesión</button>
                  </div>
              </div>
          )}
        </header>
        
        {isMenuOpen && <div className="fixed inset-0 bg-black/20 z-10" onClick={() => setIsMenuOpen(false)}></div>}

        <main className="flex-1 p-4 overflow-y-auto">
          {successMsg ? (
            <div className="flex flex-col items-center justify-center h-full text-green-600 animate-fade-in">
              {successMsg.includes('Enviando') || successMsg.includes('Generando') ? (
                  <Mail className="w-20 h-20 mb-4 animate-pulse text-blue-500" />
              ) : (
                  <CheckCircle2 className="w-20 h-20 mb-4" />
              )}
              <h2 className="text-xl font-bold text-center">{successMsg}</h2>
            </div>
          ) : (
            <>
              {viewState === ViewState.CONTEXT_SELECTION && (
                <MachineSelector 
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  onSelect={handleContextSelect} 
                />
              )}

              {viewState === ViewState.ADMIN_SELECT_MACHINE_TO_EDIT && (
                  <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-center mb-4">
                          <p className="text-blue-800 font-bold">Modo Administrador: Selecciona la máquina a modificar</p>
                      </div>
                      <MachineSelector 
                        selectedDate={new Date()} 
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

              {viewState === ViewState.ADMIN_CP_PLANNING && (
                  <WeeklyPlanning 
                    onBack={() => setViewState(ViewState.CONTEXT_SELECTION)}
                  />
              )}

              {viewState === ViewState.ADMIN_PRODUCTION_DASHBOARD && (
                  <ProductionDashboard 
                    onBack={() => setViewState(ViewState.CONTEXT_SELECTION)}
                  />
              )}
              
              {viewState === ViewState.ADMIN_VIEW_LOGS && (
                  <MachineLogsViewer 
                    onBack={() => setViewState(ViewState.CONTEXT_SELECTION)}
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
}

export default App;
