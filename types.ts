export interface JobPosition {
  id: string;
  name: string;
}

export interface Worker {
  id: string;
  name: string;
  dni: string; 
  phone: string;
  positionIds: string[];
  role: 'admin' | 'worker' | 'cp' | 'cr';
  active?: boolean;
  expectedHours?: number; // Horas de jornada esperadas
}

export interface CostCenter {
  id: string;
  name: string;
}

export interface SubCenter {
  id: string;
  centerId: string;
  name: string;
  tracksProduction: boolean;
  productionField?: 'MACHACADORA' | 'MOLINOS' | 'LAVADO' | 'TRITURACION';
}

export interface MaintenanceDefinition {
  id?: string;
  machineId?: string;
  name: string;
  maintenanceType: 'HOURS' | 'DATE';
  intervalHours?: number;
  warningHours?: number;
  lastMaintenanceHours?: number | null;
  remainingHours?: number;
  intervalMonths?: number;
  nextDate?: Date;
  lastMaintenanceDate?: Date;
  tasks: string;
  pending?: boolean;
}

export interface Machine {
  id: string;
  costCenterId: string;
  subCenterId?: string; // Nuevo vínculo
  name: string;
  companyCode?: string;
  currentHours: number;
  requiresHours: boolean;
  adminExpenses: boolean;
  transportExpenses: boolean;
  maintenanceDefs: MaintenanceDefinition[];
  selectableForReports?: boolean;
  responsibleWorkerId?: string;
  active?: boolean;
  vinculadaProduccion?: boolean; // Si hereda horas de producción
}

export interface ServiceProvider {
  id: string;
  name: string;
}

export type OperationType = 'LEVELS' | 'BREAKDOWN' | 'MAINTENANCE' | 'SCHEDULED' | 'REFUELING';

export interface OperationLog {
  id: string;
  date: Date;
  workerId: string;
  machineId: string;
  hoursAtExecution: number;
  type: OperationType;
  motorOil?: number;
  hydraulicOil?: number;
  coolant?: number;
  breakdownCause?: string;
  breakdownSolution?: string;
  repairerId?: string;
  maintenanceType?: string;
  description?: string;
  materials?: string;
  maintenanceDefId?: string;
  fuelLitres?: number;
}

export interface CPDailyReport {
    id: string;
    date: Date;
    workerId: string;
    crusherStart: number;
    crusherEnd: number;
    millsStart: number;
    millsEnd: number;
    comments?: string;
    aiAnalysis?: string;
}

export interface CRDailyReport {
    id: string;
    date: Date;
    workerId: string;
    washingStart: number;
    washingEnd: number;
    triturationStart: number;
    triturationEnd: number;
    comments?: string;
    aiAnalysis?: string;
}

export interface CPWeeklyPlan {
    id: string;
    mondayDate: string;
    hoursMon: number;
    hoursTue: number;
    hoursWed: number;
    hoursThu: number;
    hoursFri: number;
}

export interface PersonalReport {
    id: string;
    date: Date;
    workerId: string;
    hours: number;
    costCenterId?: string;
    machineId?: string;
    machineName?: string;
    costCenterName?: string;
    description?: string;
    location?: string;
}
