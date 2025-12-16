
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport } from '../types';

// --- MOCK DATA ---

export const WORKERS: Worker[] = [
  { id: '1', name: 'Juan Pérez (Admin)', dni: '12345678X', phone: '600111222', positionIds: ['p1'], role: 'admin' },
  { id: '2', name: 'Antonio Garcia', dni: '43215678Y', phone: '600333444', positionIds: ['p2'], role: 'worker' },
  { id: '3', name: 'Maria Rodriguez', dni: '98765432Z', phone: '600555666', positionIds: ['p1', 'p2'], role: 'worker' },
  { id: '4', name: 'Pedro Plantista', dni: '11112222C', phone: '600999888', positionIds: ['p3'], role: 'cp' }, // Usuario CP
];

export const COST_CENTERS: CostCenter[] = [
  { id: 'c1', name: 'Maquinaria Móvil' },
  { id: 'c2', name: 'Cantera Pura Machacadora' },
  { id: 'c3', name: 'Cantera Pura Molienda' },
];

const MOCK_MAINTENANCE_DEFS: MaintenanceDefinition[] = [
  { id: 'md1', machineId: 'm1', name: 'Mantenimiento 250h', maintenanceType: 'HOURS', intervalHours: 250, tasks: 'Engrase general y revisión niveles', warningHours: 25, pending: false, remainingHours: 100, lastMaintenanceHours: 4860 },
  { id: 'md2', machineId: 'm1', name: 'Mantenimiento 500h', maintenanceType: 'HOURS', intervalHours: 500, tasks: 'Cambio aceite motor y filtros', warningHours: 50, pending: false, remainingHours: 350, lastMaintenanceHours: 4500 },
  { id: 'md3', machineId: 'm2', name: 'Mantenimiento 1000h', maintenanceType: 'HOURS', intervalHours: 1000, tasks: 'Cambio aceite hidráulico', warningHours: 100, pending: true, remainingHours: 50, lastMaintenanceHours: 11000 },
];

export const MACHINES: Machine[] = [
  { 
    id: 'm1', costCenterId: 'c1', name: 'Volvo L150H (Pala)', companyCode: 'VOL-001', currentHours: 4960, requiresHours: true, adminExpenses: false, transportExpenses: false, selectableForReports: true,
    maintenanceDefs: MOCK_MAINTENANCE_DEFS.filter(m => m.machineId === 'm1') 
  },
  { 
    id: 'm2', costCenterId: 'c1', name: 'CAT 336 (Retro)', companyCode: 'CAT-055', currentHours: 12100, requiresHours: true, adminExpenses: false, transportExpenses: false, selectableForReports: true,
    maintenanceDefs: MOCK_MAINTENANCE_DEFS.filter(m => m.machineId === 'm2')
  },
  { 
    id: 'm3', costCenterId: 'c2', name: 'Machacadora Primaria', companyCode: 'MACH-01', currentHours: 0, requiresHours: false, adminExpenses: false, transportExpenses: false, selectableForReports: true,
    maintenanceDefs: []
  },
  { 
    id: 'm4', costCenterId: 'c1', name: 'Coche Empresa Ford', companyCode: 'FORD-99', currentHours: 150000, requiresHours: false, adminExpenses: true, transportExpenses: false, selectableForReports: false,
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
let cpReports: CPDailyReport[] = [];
let personalReports: PersonalReport[] = []; 
let cpPlanning: CPWeeklyPlan[] = [];

// Initialize some dummy personal reports
personalReports.push({
    id: 'pr1', date: new Date(), workerId: '4', hours: 8, machineId: 'm3', costCenterId: 'c2', machineName: 'Machacadora Primaria', costCenterName: 'Cantera Pura Machacadora'
});

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

export const updateCostCenter = async (id: string, name: string): Promise<void> => {
    const center = COST_CENTERS.find(c => c.id === id);
    if (center) {
        center.name = name;
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    const idx = COST_CENTERS.findIndex(c => c.id === id);
    if (idx !== -1) {
        COST_CENTERS.splice(idx, 1);
    }
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

// LOGIC CORE for MOCK
const updateMockMaintenanceStatus = (machineId: string, currentHours: number) => {
    const machine = MACHINES.find(m => m.id === machineId);
    if (!machine) return;

    machine.maintenanceDefs.forEach(def => {
        // Logica para DATE
        if (def.maintenanceType === 'DATE') {
            if (def.nextDate) {
                const today = new Date();
                today.setHours(0,0,0,0);
                const target = new Date(def.nextDate);
                target.setHours(0,0,0,0);
                def.pending = today >= target;
            }
            return;
        }

        // Logica para HOURS
        if (def.intervalHours === undefined) return;

        let remaining;

        if (def.lastMaintenanceHours !== undefined && def.lastMaintenanceHours !== null) {
            const nextDue = Number(def.lastMaintenanceHours) + Number(def.intervalHours);
            remaining = nextDue - currentHours;
        } else {
            const hoursInCycle = currentHours % def.intervalHours;
            remaining = def.intervalHours - hoursInCycle;
        }

        def.remainingHours = remaining;
        const shouldBePending = remaining <= (def.warningHours || 0);
        def.pending = shouldBePending;
    });
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
  const newLog = { ...log, id: Math.random().toString(36).substr(2, 9) };
  logs.push(newLog);
  
  const machineIndex = MACHINES.findIndex(m => m.id === log.machineId);
  const machine = MACHINES[machineIndex];

  if (machineIndex >= 0 && log.hoursAtExecution && log.hoursAtExecution > machine.currentHours) {
    machine.currentHours = log.hoursAtExecution;
  }

  if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
      const def = machine.maintenanceDefs.find(d => d.id === log.maintenanceDefId);
      if (def) {
          if (def.maintenanceType === 'DATE') {
              def.lastMaintenanceDate = log.date;
              if (def.nextDate && def.intervalMonths) {
                  const next = new Date(log.date);
                  next.setMonth(next.getMonth() + def.intervalMonths);
                  def.nextDate = next;
              }
          } else {
              def.lastMaintenanceHours = log.hoursAtExecution;
          }
      }
  }

  updateMockMaintenanceStatus(log.machineId, machine.currentHours);

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

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            let filtered = logs.filter(l => l.machineId === machineId);
            
            if (startDate) {
                filtered = filtered.filter(l => l.date >= startDate);
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                filtered = filtered.filter(l => l.date <= e);
            }
            if (types && types.length > 0) {
                filtered = filtered.filter(l => types.includes(l.type));
            }
            filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
            resolve(filtered);
        }, 300);
    });
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    return new Promise(resolve => {
        setTimeout(() => {
            if (cpReports.length === 0) resolve(null);
            else {
                // Sort by date desc
                const sorted = [...cpReports].sort((a, b) => b.date.getTime() - a.date.getTime());
                resolve(sorted[0]);
            }
        }, 300);
    });
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            // Filter inclusive
            const start = new Date(startDate); start.setHours(0,0,0,0);
            const end = new Date(endDate); end.setHours(23,59,59,999);
            
            const filtered = cpReports.filter(r => r.date >= start && r.date <= end);
            resolve(filtered);
        }, 300);
    });
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    cpReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const updateCPReportAnalysis = async (id: string, analysis: string): Promise<void> => {
    const report = cpReports.find(r => r.id === id);
    if (report) {
        report.aiAnalysis = analysis;
    }
    return new Promise(resolve => setTimeout(resolve, 300));
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
     return new Promise(resolve => {
        setTimeout(() => {
            const plan = cpPlanning.find(p => p.mondayDate === mondayDate);
            resolve(plan || null);
        }, 300);
    });
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
     return new Promise(resolve => {
        setTimeout(() => {
            const idx = cpPlanning.findIndex(p => p.mondayDate === plan.mondayDate);
            if (idx >= 0) {
                cpPlanning[idx] = { ...plan, id: cpPlanning[idx].id }; // Update keeping ID if existed
            } else {
                cpPlanning.push({ ...plan, id: Math.random().toString(36).substr(2, 9) });
            }
            resolve();
        }, 300);
    });
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const reports = personalReports.filter(r => r.workerId === workerId);
            reports.sort((a, b) => b.date.getTime() - a.date.getTime());
            resolve(reports.slice(0, 5)); // Limit like DB
        }, 300);
    });
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    const newReport = { ...report, id: Math.random().toString(36).substr(2, 9) };
    // Enrich with names for mock display consistency if needed
    if (!newReport.machineName) {
        const m = MACHINES.find(mach => mach.id === report.machineId);
        if (m) {
            newReport.machineName = m.name;
            if (!newReport.costCenterId) newReport.costCenterId = m.costCenterId;
        }
    }
    if (!newReport.costCenterName && newReport.costCenterId) {
        const c = COST_CENTERS.find(cen => cen.id === newReport.costCenterId);
        if (c) newReport.costCenterName = c.name;
    }

    personalReports.push(newReport);
    return new Promise(resolve => setTimeout(resolve, 300));
};

