
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition } from '../types';

// --- MOCK DATA ---

export const WORKERS: Worker[] = [
  { id: '1', name: 'Juan Pérez (Admin)', dni: '12345678X', phone: '600111222', positionIds: ['p1'], role: 'admin' },
  { id: '2', name: 'Antonio Garcia', dni: '43215678Y', phone: '600333444', positionIds: ['p2'], role: 'worker' },
  { id: '3', name: 'Maria Rodriguez', dni: '98765432Z', phone: '600555666', positionIds: ['p1', 'p2'], role: 'worker' },
];

export const COST_CENTERS: CostCenter[] = [
  { id: 'c1', name: 'Maquinaria Móvil' },
  { id: 'c2', name: 'Cantera Pura Machacadora' },
  { id: 'c3', name: 'Cantera Pura Molienda' },
];

const MOCK_MAINTENANCE_DEFS: MaintenanceDefinition[] = [
  { id: 'md1', machineId: 'm1', name: 'Mantenimiento 250h', intervalHours: 250, tasks: 'Engrase general y revisión niveles', warningHours: 25, pending: false, remainingHours: 100 },
  { id: 'md2', machineId: 'm1', name: 'Mantenimiento 500h', intervalHours: 500, tasks: 'Cambio aceite motor y filtros', warningHours: 50, pending: false, remainingHours: 350 },
  { id: 'md3', machineId: 'm2', name: 'Mantenimiento 1000h', intervalHours: 1000, tasks: 'Cambio aceite hidráulico', warningHours: 100, pending: true, remainingHours: 50 },
];

export const MACHINES: Machine[] = [
  { 
    id: 'm1', costCenterId: 'c1', name: 'Volvo L150H (Pala)', companyCode: 'VOL-001', currentHours: 4960, requiresHours: true, adminExpenses: false, transportExpenses: false,
    maintenanceDefs: MOCK_MAINTENANCE_DEFS.filter(m => m.machineId === 'm1') 
  },
  { 
    id: 'm2', costCenterId: 'c1', name: 'CAT 336 (Retro)', companyCode: 'CAT-055', currentHours: 12100, requiresHours: true, adminExpenses: false, transportExpenses: false,
    maintenanceDefs: MOCK_MAINTENANCE_DEFS.filter(m => m.machineId === 'm2')
  },
  { 
    id: 'm3', costCenterId: 'c2', name: 'Machacadora Primaria', companyCode: 'MACH-01', currentHours: 0, requiresHours: false, adminExpenses: false, transportExpenses: false,
    maintenanceDefs: []
  },
  { 
    id: 'm4', costCenterId: 'c1', name: 'Coche Empresa Ford', companyCode: 'FORD-99', currentHours: 150000, requiresHours: false, adminExpenses: true, transportExpenses: false,
    maintenanceDefs: []
  },
];

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  { id: 'sp1', name: 'Taller Propio' },
  { id: 'sp2', name: 'Servicio Técnico Volvo' },
  { id: 'sp3', name: 'Servicio Técnico Caterpillar' },
  { id: 'sp4', name: 'Electricista IDESA' },
  { id: 'sp5', name: 'Neumáticos del Sur' },
];

// In-memory store for the session
let logs: OperationLog[] = [];

// --- SERVICE METHODS ---

export const getWorkers = async (): Promise<Worker[]> => {
  return new Promise(resolve => setTimeout(() => resolve(WORKERS), 300));
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
  return new Promise(resolve => setTimeout(() => resolve(COST_CENTERS), 300));
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    const newCenter = { id: Math.random().toString(36).substr(2, 9), name };
    COST_CENTERS.push(newCenter);
    return new Promise(resolve => setTimeout(() => resolve(newCenter), 300));
};

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
  return new Promise(resolve => setTimeout(() => resolve(MACHINES.filter(m => m.costCenterId === centerId)), 300));
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newMachine: Machine = {
        ...machine,
        id: newId,
        maintenanceDefs: machine.maintenanceDefs.map(def => ({...def, id: Math.random().toString(36).substr(2, 9), machineId: newId, pending: false, remainingHours: def.intervalHours}))
    };
    MACHINES.push(newMachine);
    return new Promise(resolve => setTimeout(() => resolve(newMachine), 300));
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    const idx = MACHINES.findIndex(m => m.id === id);
    if (idx !== -1) {
        MACHINES[idx] = { ...MACHINES[idx], ...updates };
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    const newDef = { ...def, id: Math.random().toString(36).substr(2, 9) };
    const machine = MACHINES.find(m => m.id === def.machineId);
    if (machine) {
        machine.maintenanceDefs.push(newDef);
    }
    return new Promise(resolve => setTimeout(() => resolve(newDef), 300));
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    const machine = MACHINES.find(m => m.id === def.machineId);
    if (machine) {
        const idx = machine.maintenanceDefs.findIndex(d => d.id === def.id);
        if (idx !== -1) {
            machine.maintenanceDefs[idx] = def;
        }
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    MACHINES.forEach(m => {
        m.maintenanceDefs = m.maintenanceDefs.filter(d => d.id !== defId);
    });
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
  return new Promise(resolve => setTimeout(() => resolve(SERVICE_PROVIDERS), 300));
};

// Simplified Mock Logic for updating maintenance status
const updateMockMaintenanceStatus = (machineId: string, currentHours: number, completedDefId?: string) => {
    const machine = MACHINES.find(m => m.id === machineId);
    if (!machine) return;

    machine.maintenanceDefs.forEach(def => {
        // Recalculate remaining
        const hoursInCycle = currentHours % def.intervalHours;
        const remaining = def.intervalHours - hoursInCycle;
        def.remainingHours = remaining;

        // If this exact def was just completed, reset it
        if (completedDefId && def.id === completedDefId) {
            def.pending = false;
        } else {
            // Logic: Sticky pending. 
            const shouldBePending = remaining <= def.warningHours;
            if (shouldBePending) {
                def.pending = true;
            }
        }
    });
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
  const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
  logs.push(newLog);
  
  const machineIndex = MACHINES.findIndex(m => m.id === log.machineId);
  if (machineIndex >= 0 && log.hoursAtExecution && log.hoursAtExecution > MACHINES[machineIndex].currentHours) {
    MACHINES[machineIndex].currentHours = log.hoursAtExecution;
    updateMockMaintenanceStatus(log.machineId, log.hoursAtExecution, log.maintenanceDefId);
  } else if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
    updateMockMaintenanceStatus(log.machineId, MACHINES[machineIndex].currentHours, log.maintenanceDefId);
  }

  return new Promise(resolve => setTimeout(() => resolve(newLog), 500));
};

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
  const relatedLogs = logs.filter(l => l.machineId === machineId && l.type === 'SCHEDULED' && l.maintenanceDefId === defId);
  relatedLogs.sort((a, b) => b.hoursAtExecution - a.hoursAtExecution); 
  return relatedLogs[0];
};

export const getMachineDetails = async (machineId: string): Promise<Machine | undefined> => {
    return MACHINES.find(m => m.id === machineId);
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    updateMockMaintenanceStatus(machine.id, machine.currentHours);
    return machine;
}
