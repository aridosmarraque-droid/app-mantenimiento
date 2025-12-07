
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
  role: 'admin' | 'worker';
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
}

export interface Machine {
  id: string;
  costCenterId: string;
  name: string;
  currentHours: number;
  requiresHours: boolean;
  adminExpenses: boolean; // "Gastos de Administración"
  transportExpenses: boolean; // "Gastos de Transporte"
  maintenanceDefs: MaintenanceDefinition[];
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
}
