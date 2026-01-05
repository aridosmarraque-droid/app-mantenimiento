
import React, { useState } from 'react';
import { Worker, OperationLog, OperationType, Machine, CostCenter } from './types';
import { Login } from './components/Login';
import { WorkerSelection } from './components/worker/WorkerSelection';
import { PersonalReportForm } from './components/personal/PersonalReportForm';
import { CPSelection } from './components/cp/CPSelection';
import { DailyReportForm } from './components/cp/DailyReportForm';
import { CRSelection } from './components/cr/CRSelection';
import { DailyReportFormCR } from './components/cr/DailyReportFormCR';
import { MachineSelector } from './components/MachineSelector';
import { MainMenu } from './components/MainMenu';
import { CreateCenterForm } from './components/admin/CreateCenterForm';
import { CreateMachineForm } from './components/admin/CreateMachineForm';
import { EditMachineForm } from './components/admin/EditMachineForm';
import { MachineLogsViewer } from './components/admin/MachineLogsViewer';
import { DailyAuditViewer } from './components/admin/DailyAuditViewer';
import { WeeklyPlanning } from './components/admin/WeeklyPlanning';
import { ProductionDashboard } from './components/admin/ProductionDashboard';
import { WorkerManager } from './components/admin/WorkerManager';
import { ProviderManager } from './components/admin/ProviderManager';
import { SubCenterManager } from './components/admin/SubCenterManager';
import { Factory, LayoutGrid } from 'lucide-react';

enum ViewState {
  LOGIN, WORKER_SELECTION, PERSONAL_REPORT, CP_SELECTION, CP_DAILY_REPORT, CR_SELECTION, CR_DAILY_REPORT,
  CONTEXT_SELECTION, ACTION_MENU, FORM, ADMIN_CREATE_CENTER, ADMIN_CREATE_MACHINE, ADMIN_SELECT_MACHINE_TO_EDIT,
  ADMIN_EDIT_MACHINE, ADMIN_VIEW_LOGS, ADMIN_DAILY_AUDIT, ADMIN_CP_PLANNING, ADMIN_PRODUCTION_DASHBOARD,
  ADMIN_MANAGE_WORKERS, ADMIN_MANAGE_PROVIDERS, ADMIN_MANAGE_SUBCENTERS
}

export const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOGIN);
  const [currentUser, setCurrentUser] = useState<Worker | null>(null);

  /**
   * Navigates the admin to a specific management view.
   */
  const handleAdminNavigate = (state: ViewState) => {
    setViewState(state);
  };

  /**
   * Resets the application state to the login screen.
   */
  const handleLogout = () => {
    setCurrentUser(null);
    setViewState(ViewState.LOGIN);
  };

  if (viewState === ViewState.LOGIN) {
    return <Login onLogin={(user) => {
      setCurrentUser(user);
      if (user.role === 'admin') setViewState(ViewState.CONTEXT_SELECTION);
      else if (user.role === 'cp') setViewState(ViewState.CP_SELECTION);
      else if (user.role === 'cr') setViewState(ViewState.CR_SELECTION);
      else setViewState(ViewState.WORKER_SELECTION);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Render views based on viewState */}
        {viewState === ViewState.ADMIN_MANAGE_SUBCENTERS && (
          <SubCenterManager onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />
        )}

        {viewState === ViewState.CONTEXT_SELECTION && (
          <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mb-4">Administración</h2>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => handleAdminNavigate(ViewState.ADMIN_CREATE_CENTER)} 
                className="w-full text-left pl-11 pr-4 py-3 hover:bg-slate-50 text-slate-600 flex items-center gap-3 border-b border-slate-100/50"
              >
                <Factory className="w-3.5 h-3.5 opacity-70" />
                <span className="text-sm">Centros de Coste</span>
              </button>
              <button 
                onClick={() => handleAdminNavigate(ViewState.ADMIN_MANAGE_SUBCENTERS)} 
                className="w-full text-left pl-11 pr-4 py-3 hover:bg-slate-50 text-slate-600 flex items-center gap-3 border-b border-slate-100/50"
              >
                <LayoutGrid className="w-3.5 h-3.5 opacity-70" />
                <span className="text-sm">Plantas / Subcentros</span>
              </button>
              <button 
                onClick={() => handleAdminNavigate(ViewState.ADMIN_MANAGE_WORKERS)} 
                className="w-full text-left pl-11 pr-4 py-3 hover:bg-slate-50 text-slate-600 flex items-center gap-3 border-b border-slate-100/50"
              >
                <span className="text-sm">Gestionar Trabajadores</span>
              </button>
              <button 
                onClick={() => handleAdminNavigate(ViewState.ADMIN_PRODUCTION_DASHBOARD)} 
                className="w-full text-left pl-11 pr-4 py-3 hover:bg-slate-50 text-slate-600 flex items-center gap-3 border-b border-slate-100/50"
              >
                <span className="text-sm">Dashboard Producción</span>
              </button>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-full mt-6 py-3 bg-slate-800 text-white rounded-lg font-bold"
            >
              Cerrar Sesión
            </button>
          </div>
        )}

        {/* Other view components would go here in a full implementation */}
        {viewState === ViewState.ADMIN_CREATE_CENTER && (
          <CreateCenterForm onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} onSuccess={() => setViewState(ViewState.CONTEXT_SELECTION)} />
        )}
        {viewState === ViewState.ADMIN_MANAGE_WORKERS && (
          <WorkerManager onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />
        )}
        {viewState === ViewState.ADMIN_PRODUCTION_DASHBOARD && (
          <ProductionDashboard onBack={() => setViewState(ViewState.CONTEXT_SELECTION)} />
        )}
      </div>
    </div>
  );
};

export default App;
