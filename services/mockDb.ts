
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport, CRDailyReport } from '../types';

// --- MOCK DATA ---

export const WORKERS: Worker[] = [
  { id: '1', name: 'Juan Pérez (Admin)', dni: '12345678X', phone: '600111222', positionIds: ['p1'], role: 'admin', activo: true, expectedHours: 8, requiresReport: false },
  { id: '2', name: 'Antonio Garcia', dni: '43215678Y', phone: '600333444', positionIds: ['p2'], role: 'worker', activo: true, expectedHours: 8, requiresReport: true },
  { id: '3', name: 'Maria Rodriguez', dni: '98765432Z', phone: '600555666', positionIds: ['p1', 'p2'], role: 'worker', activo: true, expectedHours: 8, requiresReport: true },
  { id: '4', name: 'Pedro Plantista', dni: '11112222C', phone: '600999888', positionIds: ['p3'], role: 'cp', activo: true, expectedHours: 8, requiresReport: true },
  { id: '5', name: 'Carlos Lavador', dni: '55554444R', phone: '611222333', positionIds: ['p4'], role: 'cr', activo: true, expectedHours: 8, requiresReport: true },
];

export const COST_CENTERS: CostCenter[] = [
  { id: 'c1', name: 'Maquinaria Móvil' },
  { id: 'c2', name: 'Cantera Pura Machacadora' },
  { id: 'c3', name: 'Cantera Pura Molienda' },
  { id: 'c4', name: 'Planta Canto Rodado' },
];

const MOCK_MAINTENANCE_DEFS: MaintenanceDefinition[] = [
  { id: 'md1', machineId: 'm1', name: 'Mantenimiento 250h', maintenanceType: 'HOURS', intervalHours: 250, tasks: 'Engrase general y revisión niveles', warningHours: 25, pending: false, remainingHours: 100, lastMaintenanceHours: 4860 },
  { id: 'md2', machineId: 'm1', name: 'Mantenimiento 500h', maintenanceType: 'HOURS', intervalHours: 500, tasks: 'Cambio aceite motor y filtros', warningHours: 50, pending: false, remainingHours: 350, lastMaintenanceHours: 4500 },
];

export const MACHINES: Machine[] = [
  { id: 'm1', costCenterId: 'c1', name: 'Volvo L150H (Pala)', companyCode: 'VOL-001', currentHours: 4960, requiresHours: true, adminExpenses: false, transportExpenses: false, selectableForReports: true, maintenanceDefs: MOCK_MAINTENANCE_DEFS },
];

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  { id: 'sp1', name: 'Taller Propio' },
];

let logs: OperationLog[] = [];
let cpReports: CPDailyReport[] = [];
let crReports: CRDailyReport[] = []; 
let personalReports: PersonalReport[] = []; 

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
  return new Promise(resolve => setTimeout(() => resolve(onlyActive ? WORKERS.filter(w => w.activo) : WORKERS), 300));
};

export const saveWorker = async (worker: Omit<Worker, 'id'>): Promise<void> => {
    WORKERS.push({ ...worker, id: Math.random().toString(36).substr(2, 9), positionIds: [] });
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const updateWorker = async (id: string, updates: Partial<Worker>): Promise<void> => {
    const idx = WORKERS.findIndex(w => w.id === id);
    if (idx !== -1) WORKERS[idx] = { ...WORKERS[idx], ...updates };
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
  return new Promise(resolve => setTimeout(() => resolve(COST_CENTERS), 300));
};

export const getAllMachines = async (): Promise<Machine[]> => {
    return new Promise(resolve => setTimeout(() => resolve(MACHINES), 300));
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
  const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
  logs.push(newLog);
  return new Promise(resolve => setTimeout(() => resolve(newLog), 500));
};

export const updateOperationLog = async (id: string, updates: Partial<OperationLog>): Promise<void> => {
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) logs[idx] = { ...logs[idx], ...updates };
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteOperationLog = async (id: string): Promise<void> => {
    const idx = logs.findIndex(l => l.id === id);
    if (idx !== -1) logs.splice(idx, 1);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    cpReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    crReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    personalReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const updatePersonalReport = async (id: string, updates: Partial<PersonalReport>): Promise<void> => {
    const idx = personalReports.findIndex(r => r.id === id);
    if (idx !== -1) personalReports[idx] = { ...personalReports[idx], ...updates };
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deletePersonalReport = async (id: string): Promise<void> => {
    const idx = personalReports.findIndex(r => r.id === id);
    if (idx !== -1) personalReports.splice(idx, 1);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[], cp: CPDailyReport[], cr: CRDailyReport[] }> => {
    const dateStr = date.toISOString().split('T')[0];
    return { 
        ops: logs.filter(l => l.date.toISOString().split('T')[0] === dateStr), 
        personal: personalReports.filter(r => r.date.toISOString().split('T')[0] === dateStr),
        cp: cpReports.filter(r => r.date.toISOString().split('T')[0] === dateStr),
        cr: crReports.filter(r => r.date.toISOString().split('T')[0] === dateStr)
    };
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    return new Promise(resolve => resolve(personalReports.filter(r => r.workerId === workerId)));
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
  return new Promise(resolve => setTimeout(() => resolve(SERVICE_PROVIDERS), 300));
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    return cpReports.filter(r => r.date >= startDate && r.date <= endDate);
};

export const getCRReportsByRange = async (startDate: Date, endDate: Date): Promise<CRDailyReport[]> => {
    return crReports.filter(r => r.date >= startDate && r.date <= endDate);
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => null;
export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {};
export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {};
export const deleteMachine = async (id: string): Promise<void> => {};
export const createMachine = async (machine: any): Promise<void> => {};
export const getMachinesByCenter = async (id: string, activeOnly: boolean = true): Promise<Machine[]> => [];
export const getSubCentersByCenter = async (id: string): Promise<any[]> => [];
export const getLastCPReport = async (): Promise<CPDailyReport | null> => null;
export const getLastCRReport = async (): Promise<CRDailyReport | null> => null;
export const calculateAndSyncMachineStatus = async (m: Machine): Promise<Machine> => m;

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    const machine = MACHINES.find(m => m.id === def.machineId);
    if (machine) {
        const idx = machine.maintenanceDefs.findIndex(d => d.id === def.id);
        if (idx !== -1) machine.maintenanceDefs[idx] = { ...machine.maintenanceDefs[idx], ...def };
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};
