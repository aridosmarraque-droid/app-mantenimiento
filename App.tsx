import React, { useState, useEffect } from 'react';
import { Worker, Machine, CostCenter, OperationType, OperationLog, CPDailyReport, PersonalReport, CRDailyReport } from './types';
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
import { DailyAuditViewer } from './components/admin/DailyAuditViewer';
import { WorkerManager } from './components/admin/WorkerManager';
import { ProviderManager } from './components/admin/ProviderManager';
import { SubCenterManager } from './components/admin/SubCenterManager';
import { CPSelection } from './components/cp/CPSelection';
import { DailyReportForm } from './components/cp/DailyReportForm';
import { CRSelection } from './components/cr/CRSelection';
import { DailyReportFormCR } from './components/cr/DailyReportFormCR';
import { WorkerSelection } from './components/personal/WorkerSelection';
import { PersonalReportForm } from './components/personal/PersonalReportForm';
import { WeeklyPlanning } from './components/admin/WeeklyPlanning';
import { ProductionDashboard } from './components/admin/ProductionDashboard';
import { DatabaseDiagnostics } from './components/admin/DatabaseDiagnostics';
import { saveOperationLog, saveCPReport, saveCRReport, syncPendingData, savePersonalReport } from './services/db';
import { getQueue } from './services/offlineQueue';
import { LayoutDashboard, CheckCircle2, DatabaseZap, Menu, X, Factory, Truck, Settings, TrendingUp, WifiOff, RefreshCcw, LogOut, SearchCheck, LayoutGrid, ChevronDown, ChevronUp, Fuel, Database } from 'lucide-react';

enum ViewState {
  LOGIN,
  WORKER_SELECTION,
  PERSONAL_REPORT,
  CP_SELECTION,
  CP_DAILY_REPORT,
  CR_SELECTION,
  CR_DAILY_REPORT,
  CONTEXT_SELECTION,
  ACTION_MENU,
  FORM,
  ADMIN_CREATE_CENTER,
  ADMIN_MANAGE_SUBCENTERS,
  ADMIN_CREATE_MACHINE,
  ADMIN_SELECT_MACHINE_TO_EDIT,
  ADMIN_EDIT_MACHINE,
  ADMIN_VIEW_LOGS,
  ADMIN_DAILY_AUDIT,
  ADMIN_CP_PLANNING,
  ADMIN_PRODUCTION_DASHBOARD,
  ADMIN_MANAGE_WORKERS,
  ADMIN_MANAGE_PROVIDERS,
  ADMIN_DIAGNOSTICS
}

type MenuCategory = 'activos' | 'produccion' | 'auditoria' | 'configuracion' | null;

function App() {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOGIN);
  const [currentUser, setCurrentUser] = useState<Worker | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [selectedContext, setSelectedContext] = useState<{ machine: Machine, center: CostCenter } | null>(null);
  const [machineToEdit, setMachineToEdit] = useState<Machine | null>(null);
  const [selectedAction, setSelectedAction] = useState<OperationType | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<MenuCategory>(null);

  const isUserAdmin = currentUser?.role?.toLowerCase() === 'admin';
  
  useEffect(() => {
      const handleStatusChange = () => setIsOnline(navigator.onLine);
      const checkQueue = () => setPendingItems(getQueue().length);
      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);
      const interval = setInterval(checkQueue, 3000);
      checkQueue();
      return () => {
          window.removeEventListener('online', handleStatusChange);
          window.removeEventListener('offline', handleStatusChange);
          clearInterval(interval);
      };
  }, []);

  const handleForceSync = async () => {
      if (!isOnline) { alert("No hay conexión a internet."); return; }
      setIsSyncing(true);
      const res = await syncPendingData();
      setIsSyncing(false);
      setPendingItems(getQueue().length);
      if (res.synced > 0) {
          setSuccessMsg(`${res.synced} datos sincronizados.`);
          setTimeout(() => setSuccessMsg(''), 2000);
      } else if (res.errors > 0) alert(`Hubo errores en ${res.errors} elementos.`);
  };

  const handleLogin = (worker: Worker) => {
    setCurrentUser(worker);
    const role = worker.role?.toLowerCase();
    if (role === 'admin') setViewState(ViewState.CONTEXT_SELECTION);
    else if (role === 'cp') setViewState(ViewState.CP_SELECTION);
    else if (role === 'cr') setViewState(ViewState.CR_SELECTION);
    else setViewState(ViewState.WORKER_SELECTION);
  };

  const handleLogout = () => { 
    setCurrentUser(null); 
    setViewState(ViewState.LOGIN); 
    setIsMenuOpen(false); 
    setOpenCategory(null); 
  };

  const handleContextSelect = (machine: Machine, center: CostCenter) => { 
    setSelectedContext({ machine, center }); 
    setViewState(ViewState.ACTION_MENU); 
  };

  const handleEditSelection = (machine: Machine, center: CostCenter) => { 
    setMachineToEdit(machine); 
    setViewState(ViewState.ADMIN_EDIT_MACHINE); 
  };

  const handleActionSelect = (type: OperationType) => { 
    setSelectedAction(type); 
    setViewState(ViewState.FORM); 
  };
  
  const handleAdminNavigate = (view: ViewState) => { 
    setViewState(view); 
    setIsMenuOpen(false); 
  };

  const toggleCategory = (cat: MenuCategory) => {
    setOpenCategory(openCategory === cat ? null : cat);
  };

  const handlePersonalReportSubmit = async (data: Omit<PersonalReport, 'id'>) => {
      try {
          await savePersonalReport(data);
          setSuccessMsg('Reporte de Trabajo Guardado ✅');
          setTimeout(() => { 
            setSuccessMsg(''); 
            navigateBack();
          }, 1500);
      } catch (e: any) { alert(e.message || "Error al guardar"); }
  };

  const handleCPReportSubmit = async (data: Omit<CPDailyReport, 'id'>) => {
      try {
          await saveCPReport(data);
          setSuccessMsg('Parte Cantera Pura Guardado ✅');
          setTimeout(() => { setSuccessMsg(''); setViewState(ViewState.CP_SELECTION); }, 2000);
      } catch (e: any) { alert(e.message || "Error al guardar"); }
  };

  const handleCRReportSubmit = async (data: Omit<CRDailyReport, 'id'>) => {
      try {
          await saveCRReport(data);
          setSuccessMsg('Parte Canto Rodado Guardado ✅');
          setTimeout(() => { setSuccessMsg(''); setViewState(ViewState.CR_SELECTION); }, 2000);
      } catch (e: any) { alert(e.message || "Error al guardar"); }
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
        ...data 
      };
      await saveOperationLog(logData);
      setSuccessMsg(navigator.onLine ? 'Operación registrada' : 'Guardado offline');
      setTimeout(() => { 
        setSuccessMsg(''); 
        setViewState(ViewState.ACTION_MENU); 
        setSelectedAction(null); 
      }, 2000);
    } catch (e: any) { 
        console.error("Error capturado en App.tsx:", e);
        alert(e.message || "Error al registrar"); 
    }
  };

  const handleAdminSuccess = (msg: string) => {
      setSuccessMsg(msg);
      setTimeout(() => { setSuccessMsg(''); setViewState(ViewState.CONTEXT_SELECTION); }, 1500);
  };

  const navigateBack = () => {
    const role = currentUser?.role?.toLowerCase();
    if (role === 'cp') setViewState(ViewState.CP_SELECTION);
    else if (role === 'cr') setViewState(ViewState.CR_SELECTION);
    else if (role === 'admin') setViewState(ViewState.CONTEXT_SELECTION);
    else setViewState(ViewState.WORKER_SELECTION);
  };

  if (viewState === ViewState.LOGIN) {
      return <Login onLogin={handleLogin} />;
  }

  return (
      <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 shadow-xl relative overflow-x-hidden">
        <header className="bg-slate-800 text-white shadow-lg sticky top-0 z-20">
          {(!isOnline || pendingItems > 0) && (
              <div className={`text-white text-[10px] text-center p-2 font-black uppercase flex items-center justify-between px-4 ${isOnline ? 'bg-orange-500' : 'bg-red-600'}`}>
                  <div className="flex items-center gap-2">
                    {!isOnline ? <WifiOff size={12} /> : <DatabaseZap size={12} />} 
                    <span>{!isOnline ? 'Modo Offline' : 'Sincronización Pendiente'}: {pendingItems} items</span>
                  </div>
                  {isOnline && pendingItems > 0 && (
                    <button onClick={handleForceSync} disabled={isSyncing} className="bg-white/20 px-2 py-0.5 rounded border border-white/30 flex items-center gap-1">
                      <RefreshCcw size={10} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Enviando...' : 'Sincronizar'}
                    </button>
                  )}
              </div>
          )}

          <div className="p-4 flex justify-between items-center relative">
            <div className="flex flex-col">
              <h1 className="font-black text-lg flex items-center gap-2 text-white leading-none">
                <LayoutDashboard className="w-5 h-5 text-red-500" /> ARIDOS MARRAQUE
              </h1>
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">GMAO & Documentación</span>
            </div>
            
            <div className="flex items-center gap-2">
                {isUserAdmin ? (
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-lg transition-all ${isMenuOpen ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                ) : (
                    <button onClick={handleLogout} className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:text-white transition-colors" title="Cerrar Sesión">
                      <LogOut size={20} />
                    </button>
                )}
                {viewState !== ViewState.WORKER_SELECTION && viewState !== ViewState.CP_SELECTION && viewState !== ViewState.CR_SELECTION && viewState !== ViewState.CONTEXT_SELECTION && (
                   <button onClick={navigateBack} className="text-[10px] font-black uppercase bg-slate-600 px-3 py-2 rounded-lg hover:bg-slate-500 transition-all border border-slate-500">Volver</button>
                )}
            </div>
          </div>
          
          {isMenuOpen && isUserAdmin && (
              <div className="absolute top-full right-0 w-80 bg-white shadow-2xl rounded-bl-3xl overflow-y-auto max-h-[85vh] border-l border-b border-slate-200 z-30 animate-in slide-in-from-right-5 duration-300">
                  <div className="border-b border-slate-100">
                    <button onClick={() => toggleCategory('activos')} className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${openCategory === 'activos' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                            <Truck className={`w-5 h-5 ${openCategory === 'activos' ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className="text-xs font-black uppercase tracking-tight">Activos y Plantas</span>
                        </div>
                        {openCategory === 'activos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {openCategory === 'activos' && (
                        <div className="bg-slate-50 divide-y divide-slate-100">
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CREATE_CENTER)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>Centros de Coste</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_MANAGE_SUBCENTERS)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>Plantas / Subcentros</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CREATE_MACHINE)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>Nueva Máquina</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_SELECT_MACHINE_TO_EDIT)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>Editar Inventario</button>
                        </div>
                    )}
                  </div>

                  <div className="border-b border-slate-100">
                    <button onClick={() => toggleCategory('produccion')} className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${openCategory === 'produccion' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                            <TrendingUp className={`w-5 h-5 ${openCategory === 'produccion' ? 'text-amber-400' : 'text-amber-600'}`} />
                            <span className="text-xs font-black uppercase tracking-tight">Producción</span>
                        </div>
                        {openCategory === 'produccion' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {openCategory === 'produccion' && (
                        <div className="bg-slate-50 divide-y divide-slate-100">
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_CP_PLANNING)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>Planificación Semanal</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_PRODUCTION_DASHBOARD)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>Panel Eficiencia IA</button>
                        </div>
                    )}
                  </div>

                  <div className="border-b border-slate-100">
                    <button onClick={() => toggleCategory('auditoria')} className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${openCategory === 'auditoria' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                            <SearchCheck className={`w-5 h-5 ${openCategory === 'auditoria' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            <span className="text-xs font-black uppercase tracking-tight">Auditoría</span>
                        </div>
                        {openCategory === 'auditoria' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {openCategory === 'auditoria' && (
                        <div className="bg-slate-50 divide-y divide-slate-100">
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_DAILY_AUDIT)} className="w-full text-left pl-14 py-3 text-xs font-black text-indigo-700 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>Auditoría Diaria Integral</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_VIEW_LOGS)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>Registros Técnicos</button>
                        </div>
                    )}
                  </div>

                  <div className="border-b border-slate-100">
                    <button onClick={() => toggleCategory('configuracion')} className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${openCategory === 'configuracion' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                            <Settings className={`w-5 h-5 ${openCategory === 'configuracion' ? 'text-slate-400' : 'text-slate-600'}`} />
                            <span className="text-xs font-black uppercase tracking-tight">Sistema</span>
                        </div>
                        {openCategory === 'configuracion' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {openCategory === 'configuracion' && (
                        <div className="bg-slate-50 divide-y divide-slate-100">
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_MANAGE_WORKERS)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>Gestión de Plantilla</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_MANAGE_PROVIDERS)} className="w-full text-left pl-14 py-3 text-xs font-bold text-slate-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>Talleres y Proveedores</button>
                            <button onClick={() => handleAdminNavigate(ViewState.ADMIN_DIAGNOSTICS)} className="w-full text-left pl-14 py-3 text-xs font-black text-red-600 hover:bg-white flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>Diagnóstico DB</button>
                        </div>
                    )}
                  </div>
                  
                  <div className="p-5 bg-slate-100">
                    <button onClick={handleLogout} className="text-red-600 text-xs font-black uppercase w-full py-3 bg-white rounded-xl border border-red-100 shadow-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-all">
                        <LogOut size={16} /> Cerrar Sesión Segura
                    </button>
                  </div>
              </div>
          )}
        </header>
        
        {isMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-10 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>}

        <main className="flex-1 p-4 overflow-y-auto">
          {successMsg && (
            <div className="flex flex-col items-center justify-center h-full text-green-600 animate-in zoom-in-95 duration-300 absolute inset-0 bg-white/95 z-50">
              <div className="bg-green-100 p-6 rounded-full mb-6 shadow-inner">
                <CheckCircle2 className="w-20 h-20" />
              </div>
              <h2 className="text-2xl font-black text-center px-10 tracking-tight leading-tight">{successMsg}</h2>
            </div>
          )}

            {viewState === ViewState.WORKER_SELECTION && currentUser && (
              <WorkerSelection 
                workerName={currentUser.name} 
                onSelectMachines={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                onSelectPersonalReport={() => setViewState(ViewState.PERSONAL_REPORT)} 
                onLogout={handleLogout} 
              />
            )}
            {viewState === ViewState.CP_SELECTION && currentUser && (
              <CPSelection 
                workerName={currentUser.name} 
                onSelectMaintenance={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                onSelectProduction={() => setViewState(ViewState.CP_DAILY_REPORT)} 
                onSelectPersonalReport={() => setViewState(ViewState.PERSONAL_REPORT)} 
                onLogout={handleLogout} 
              />
            )}
            {viewState === ViewState.CR_SELECTION && currentUser && (
              <CRSelection 
                workerName={currentUser.name} 
                onSelectMaintenance={() => setViewState(ViewState.CONTEXT_SELECTION)} 
                onSelectProduction={() => setViewState(ViewState.CR_DAILY_REPORT)} 
                onSelectPersonalReport={() => setViewState(ViewState.PERSONAL_REPORT)} 
                onLogout={handleLogout} 
              />
            )}
            
            {viewState === ViewState.PERSONAL_REPORT && currentUser && (
              <PersonalReportForm workerId={currentUser.id} onBack={navigateBack} onSubmit={handlePersonalReportSubmit} />
            )}
            {viewState === ViewState.CP_DAILY_REPORT && currentUser && (
              <DailyReportForm workerId={currentUser.id} onBack={() => setViewState(ViewState.CP_SELECTION)} onSubmit={handleCPReportSubmit} />
            )}
            {viewState === ViewState.CR_DAILY_REPORT && currentUser && (
              <DailyReportFormCR workerId={currentUser.id} onBack={() => setViewState(ViewState.CR_SELECTION)} onSubmit={handleCRReportSubmit} />
            )}

            {viewState === ViewState.CONTEXT_SELECTION && (
              <MachineSelector 
                selectedDate={selectedDate} 
                onChangeDate={setSelectedDate} 
                onSelect={handleContextSelect} 
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
              <div className="animate-in slide-in-from-right duration-500">
                {selectedAction === 'LEVELS' && <LevelsForm machine={selectedContext.machine} onSubmit={handleFormSubmit} onCancel={() => setViewState(ViewState.ACTION_MENU)}/>}
                {selectedAction === 'BREAKDOWN' && <BreakdownForm machine={selectedContext.machine} onSubmit={handleFormSubmit} onCancel={() => setViewState(ViewState.ACTION_MENU)}/>}
                {selectedAction === 'MAINTENANCE' && <MaintenanceForm machine={selectedContext.machine} onSubmit={handleFormSubmit} onCancel={() => setViewState(ViewState.ACTION_MENU)}/>}
                {selectedAction === 'SCHEDULED' && <ScheduledMaintenanceForm machine={selectedContext.machine} onSubmit={handleFormSubmit} onCancel={() => setViewState(ViewState.ACTION_MENU)}/>}
                {selectedAction === 'REFUELING' && (
                  <div className="bg-white p-8 rounded-3xl shadow-xl text-center border border-slate-100">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Fuel size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Suministro Combustible</h3>
                    <form onSubmit={(e) => { 
                        e.preventDefault(); 
                        const formData = new FormData(e.currentTarget);
                        handleFormSubmit({ 
                          hoursAtExecution: Number(formData.get('hours')), 
                          fuelLitres: Number(formData.get('litres')) 
                        }); 
                    }} className="space-y-5 text-left">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Horas / Kms Marcador</label>
                        <input name="hours" type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-xl font-black text-lg focus:border-green-500 transition-colors" required min={selectedContext.machine.currentHours} defaultValue={selectedContext.machine.currentHours}/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Litros Repostados</label>
                        <input name="litres" type="number" step="0.1" className="w-full border-2 border-slate-100 p-4 rounded-xl font-black text-lg focus:border-green-500 transition-colors" placeholder="0.0" required />
                      </div>
                      <button className="bg-slate-900 text-white w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all">Guardar Registro</button>
                      <button type="button" onClick={() => setViewState(ViewState.ACTION_MENU)} className="w-full text-slate-400 py-2 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {viewState === ViewState.ADMIN_SELECT_MACHINE_TO_EDIT && (
              <div className="space-y-4">
                <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg"><Truck size={20}/></div>
                  <p className="font-black text-sm uppercase tracking-tight">Gestión de Inventario: Seleccione Unidad</p>
                </div>
                <MachineSelector selectedDate={new Date()} onChangeDate={() => {}} onSelect={handleEditSelection} showInactive={true} />
              </div>
            )}
            
            {viewState === ViewState.ADMIN_CREATE_CENTER && <CreateCenterForm onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} onSuccess={() => handleAdminSuccess('Cantera creada correctamente')}/>}
            {viewState === ViewState.ADMIN_MANAGE_SUBCENTERS && <SubCenterManager onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_CREATE_MACHINE && <CreateMachineForm onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} onSuccess={() => handleAdminSuccess('Máquina dada de alta')}/>}
            {viewState === ViewState.ADMIN_EDIT_MACHINE && machineToEdit && <EditMachineForm machine={machineToEdit} onBack={() => setViewState(ViewState.ADMIN_SELECT_MACHINE_TO_EDIT)} onSuccess={() => handleAdminSuccess('Ficha actualizada')}/>}
            {viewState === ViewState.ADMIN_CP_PLANNING && <WeeklyPlanning onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_PRODUCTION_DASHBOARD && <ProductionDashboard onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_VIEW_LOGS && <MachineLogsViewer onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_DAILY_AUDIT && <DailyAuditViewer onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_MANAGE_WORKERS && <WorkerManager onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_MANAGE_PROVIDERS && <ProviderManager onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}
            {viewState === ViewState.ADMIN_DIAGNOSTICS && <DatabaseDiagnostics onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />}

        </main>
      </div>
    );
}

export default App;
