
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport, CRDailyReport } from '../types';

// --- MOCK DATA ---

export const WORKERS: Worker[] = [
  { id: '1', name: 'Juan Pérez (Admin)', dni: '12345678X', phone: '600111222', positionIds: ['p1'], role: 'admin', active: true },
  { id: '2', name: 'Antonio Garcia', dni: '43215678Y', phone: '600333444', positionIds: ['p2'], role: 'worker', active: true },
  { id: '3', name: 'Maria Rodriguez', dni: '98765432Z', phone: '600555666', positionIds: ['p1', 'p2'], role: 'worker', active: true },
  { id: '4', name: 'Pedro Plantista', dni: '11112222C', phone: '600999888', positionIds: ['p3'], role: 'cp', active: true },
  { id: '5', name: 'Carlos Lavador', dni: '55554444R', phone: '611222333', positionIds: ['p4'], role: 'cr', active: true }, // Nuevo worker CR
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
let crReports: CRDailyReport[] = []; // Nuevo
let personalReports: PersonalReport[] = []; 
let cpPlanning: CPWeeklyPlan[] = [];

export const getWorkers = async (): Promise<Worker[]> => {
  return new Promise(resolve => setTimeout(() => resolve(WORKERS), 300));
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

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    const newCenter = { id: Math.random().toString(36).substr(2, 9), name };
    COST_CENTERS.push(newCenter);
    return new Promise(resolve => setTimeout(() => resolve(newCenter), 300));
};

export const updateCostCenter = async (id: string, name: string): Promise<void> => {
    const center = COST_CENTERS.find(c => c.id === id);
    if (center) center.name = name;
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    const idx = COST_CENTERS.findIndex(c => c.id === id);
    if (idx !== -1) COST_CENTERS.splice(idx, 1);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
  return new Promise(resolve => setTimeout(() => resolve(MACHINES.filter(m => m.costCenterId === centerId)), 300));
};

export const getAllMachines = async (): Promise<Machine[]> => {
    return new Promise(resolve => setTimeout(() => resolve(MACHINES), 300));
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newMachine: Machine = { ...machine, id: newId, maintenanceDefs: [] };
    MACHINES.push(newMachine);
    return new Promise(resolve => setTimeout(() => resolve(newMachine), 300));
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    const idx = MACHINES.findIndex(m => m.id === id);
    if (idx !== -1) MACHINES[idx] = { ...MACHINES[idx], ...updates };
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    const newDef = { ...def, id: Math.random().toString(36).substr(2, 9) };
    const machine = MACHINES.find(m => m.id === def.machineId);
    if (machine) machine.maintenanceDefs.push(newDef);
    return new Promise(resolve => setTimeout(() => resolve(newDef), 300));
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    const machine = MACHINES.find(m => m.id === def.machineId);
    if (machine) {
        const idx = machine.maintenanceDefs.findIndex(d => d.id === def.id);
        if (idx !== -1) machine.maintenanceDefs[idx] = def;
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    MACHINES.forEach(m => { m.maintenanceDefs = m.maintenanceDefs.filter(d => d.id !== defId); });
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
  return new Promise(resolve => setTimeout(() => resolve(SERVICE_PROVIDERS), 300));
};

export const createServiceProvider = async (name: string): Promise<void> => {
    SERVICE_PROVIDERS.push({ id: Math.random().toString(36).substr(2, 9), name });
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const updateServiceProvider = async (id: string, name: string): Promise<void> => {
    const p = SERVICE_PROVIDERS.find(sp => sp.id === id);
    if (p) p.name = name;
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteServiceProvider = async (id: string): Promise<void> => {
    const idx = SERVICE_PROVIDERS.findIndex(p => p.id === id);
    if (idx !== -1) SERVICE_PROVIDERS.splice(idx, 1);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
  const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
  logs.push(newLog);
  return new Promise(resolve => setTimeout(() => resolve(newLog), 500));
};

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
  return undefined;
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    return machine;
}

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    return [];
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    return new Promise(resolve => {
        if (cpReports.length === 0) resolve(null);
        else resolve(cpReports[cpReports.length - 1]);
    });
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    cpReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

// --- MOCK CR ---
export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    return new Promise(resolve => {
        if (crReports.length === 0) resolve(null);
        else resolve(crReports[crReports.length - 1]);
    });
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    crReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    return [];
};

export const updateCPReportAnalysis = async (id: string, analysis: string): Promise<void> => {
    return;
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    return null;
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    return;
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    return [];
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    return;
};
