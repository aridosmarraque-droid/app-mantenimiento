
/**
 * GMAO Aridos Marraque - Types & Interfaces
 * Versión Integral: Mantenimiento, Producción y Prevención (PRL)
 */

// --- 1. ESTRUCTURA ORGANIZATIVA ---

export interface JobPosition {
  id: string;
  name: string;
  description?: string;
  requiredPPE?: string[]; // IDs de EPIs obligatorios
}

export interface CostCenter {
  id: string;
  name: string;
  companyCode?: string;
  selectableForReports?: boolean;
  location?: string;
  activo?: boolean;
}

export interface SubCenter {
  id: string;
  centerId: string;
  name: string;
  tracksProduction: boolean;
  productionField?: 'MACHACADORA' | 'MOLINOS' | 'LAVADO' | 'TRITURACION';
}

// --- 2. GESTIÓN DE PERSONAL Y PRL (PREVENCIÓN) ---

export type WorkerRole = 'admin' | 'worker' | 'cp' | 'cr' | 'reparador' | 'prevencion';

export interface Worker {
  id: string;
  name: string;
  dni: string; 
  phone: string;
  email?: string;
  positionIds: string[];
  role: WorkerRole;
  activo?: boolean;
  expectedHours?: number; 
  requiresReport?: boolean; 
  
  // Datos de Prevención
  lastMedicalExam?: Date;
  nextMedicalExam?: Date;
  medicalAptitude?: 'APT' | 'APT_RESTRICTION' | 'NO_APT' | 'PENDING';
  lastPPEHandover?: Date;
  tallaRopa?: string;
  tallaCalzado?: string;
}

export interface PPEDelivery {
  id: string;
  workerId: string;
  date: Date;
  items: Array<{
    description: string;
    quantity: number;
    expiryDate?: Date;
  }>;
  signatureUrl?: string; 
}

export interface TrainingSession {
  id: string;
  title: string;
  date: Date;
  trainerName: string;
  durationHours: number;
  content: string;
  attendees: Array<{
    workerId: string;
    passed: boolean;
  }>;
}

// --- 3. GESTIÓN DOCUMENTAL (CALIDAD Y SEGURIDAD) ---

export type DocumentStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED' | 'PENDING_RENEWAL';

export interface BaseDocument {
  id: string;
  title: string;
  category: 'MAQUINA' | 'TRABAJADOR' | 'EMPRESA' | 'CENTRO' | 'PROYECTO';
  issueDate: Date;
  expiryDate?: Date;
  fileUrl?: string;
  status: DocumentStatus;
  notes?: string;
}

export interface WorkerDocument extends BaseDocument {
  workerId: string;
  docType: 'DNI' | 'CONTRATO' | 'CURSO_PRL' | 'APTITUD_MEDICA' | 'ENTREGA_EPI';
}

export interface MachineDocument extends BaseDocument {
  machineId: string;
  docType: 'SEGURO' | 'ITV' | 'FICHA_TECNICA' | 'CE' | 'MANUAL';
}

// --- 4. MANTENIMIENTO Y MAQUINARIA (GMAO) ---

export type MaintenancePeriod = 'HOURS' | 'DATE';

export interface MaintenanceDefinition {
  id?: string;
  machineId?: string;
  name: string;
  maintenanceType: MaintenancePeriod;
  intervalHours?: number;
  warningHours?: number;
  lastMaintenanceHours?: number | null;
  remainingHours?: number;
  intervalMonths?: number;
  nextDate?: Date;
  lastMaintenanceDate?: Date;
  tasks: string;
  pending?: boolean;
  
  // Control de notificaciones únicas
  notifiedWarning?: boolean;
  notifiedOverdue?: boolean;
}

export interface Machine {
  id: string;
  costCenterId: string;
  subCenterId?: string; 
  name: string;
  companyCode?: string;
  currentHours: number;
  requiresHours: boolean;
  adminExpenses: boolean;
  transportExpenses: boolean;
  selectableForReports?: boolean;
  responsibleWorkerId?: string;
  activo?: boolean;
  vinculadaProduccion?: boolean; 
  
  maintenanceDefs: MaintenanceDefinition[];
}

export interface ServiceProvider {
  id: string;
  name: string;
  cif?: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

// --- 5. REGISTROS OPERATIVOS ---

export type OperationType = 'LEVELS' | 'BREAKDOWN' | 'MAINTENANCE' | 'SCHEDULED' | 'REFUELING';

export interface OperationLog {
  id: string;
  date: Date;
  workerId: string;
  machineId: string;
  hoursAtExecution: number;
  type: OperationType;
  
  // Datos específicos según tipo
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

// --- 6. PRODUCCIÓN Y PARTES DIARIOS ---

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

// --- 7. REPARTO DE COSTES ---

export interface SpecificCostRule {
    id: string;
    machineOriginId: string;
    targetCenterId: string;
    targetMachineId?: string | null;
    percentage: number;
}
