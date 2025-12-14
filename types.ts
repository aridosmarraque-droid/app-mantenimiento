
export interface JobPosition {
  id: string;
  name: string;
}

export interface Worker {
  id: string;
  name: string;
  dni: string; // We use this for auth (first 4 digits)
  phone: string;
  positionIds: string[];
  role: 'admin' | 'worker' | 'cp'; // Añadido 'cp'
}

export interface CostCenter {
  id: string;
  name: string; // e.g., "Maquinaria Móvil"
  code?: string; // Nuevo: e.g., "CP", "MM"
}

export interface SubCenter {
  id: string;
  centerId: string;
  name: string; // e.g., "Palas Cargadoras", "Machacadora"
}

export interface MaintenanceDefinition {
  id?: string; // Optional for creation
  machineId?: string;
  name: string; // e.g., "Mantenimiento 500h"
  intervalHours: number; // 500
  tasks: string; // "Cambio aceite y filtros"
  warningHours: number; // 50
  pending?: boolean; // Check "Mantenimiento Pendiente"
  remainingHours?: number; // Nuevo campo: Horas hasta el próximo
  lastMaintenanceHours?: number | null; // Nuevo campo: Cuándo se hizo por última vez
}

export interface Machine {
  id: string;
  costCenterId: string;
  subCenterId?: string; // Nuevo: Subcentro
  name: string;
  companyCode?: string;
  currentHours: number;
  requiresHours: boolean;
  adminExpenses: boolean; 
  transportExpenses: boolean;
  isForWorkReport: boolean; // Nuevo: Seleccionable para partes de trabajo
  maintenanceDefs: MaintenanceDefinition[];
}

export interface ServiceProvider {
  id: string;
  name: string; 
}

// Logs for operations
export type OperationType = 'LEVELS' | 'BREAKDOWN' | 'MAINTENANCE' | 'SCHEDULED' | 'REFUELING';

export interface OperationLog {
  id: string;
  date: Date;
  workerId: string;
  machineId: string;
  hoursAtExecution: number;
  type: OperationType;
  
  // Levels Specific
  motorOil?: number;
  hydraulicOil?: number;
  coolant?: number;

  // Breakdown Specific
  breakdownCause?: string;
  breakdownSolution?: string;
  repairerId?: string;

  // Maintenance Specific
  maintenanceType?: 'CLEANING' | 'GREASING' | 'OTHER';
  description?: string;
  materials?: string;
  
  // Scheduled Specific
  maintenanceDefId?: string;
  
  // Refueling Specific
  fuelLitres?: number;
}

// --- CANTERA PURA TYPES ---

export interface CPDailyReport {
    id: string;
    date: Date;
    workerId: string;
    crusherStart: number;
    crusherEnd: number;
    millsStart: number;
    millsEnd: number;
    comments?: string;
}

export interface CPWeeklyPlan {
    id: string;
    mondayDate: string; // YYYY-MM-DD
    hoursMon: number;
    hoursTue: number;
    hoursWed: number;
    hoursThu: number;
    hoursFri: number;
}

// --- PERSONAL WORK REPORT ---

export interface PersonalWorkReport {
  id: string;
  date: Date;
  workerId: string;
  machineId: string;
  hours: number;
  comments?: string;
}
