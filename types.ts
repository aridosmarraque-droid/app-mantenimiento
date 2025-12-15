
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
  name: string; // e.g., "Cantera Pura Machacadora"
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
  name: string;
  companyCode?: string; // Nuevo campo: Código Interno
  currentHours: number;
  requiresHours: boolean;
  adminExpenses: boolean; // "Gastos de Administración"
  transportExpenses: boolean; // "Gastos de Transporte"
  maintenanceDefs: MaintenanceDefinition[];
  selectableForReports?: boolean; // Nuevo: Para partes de trabajo personal
}

export interface ServiceProvider {
  id: string;
  name: string; // "Volvo Service", "IDESA"
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

// --- PERSONAL REPORT TYPES ---

export interface PersonalReport {
    id: string;
    date: Date;
    workerId: string;
    hours: number;
    
    // New Fields for Machine flow
    costCenterId?: string;
    machineId?: string;
    machineName?: string; // Helper for display
    costCenterName?: string; // Helper for display

    description?: string; // Optional now?
    location?: string; // Legacy/Optional
}
