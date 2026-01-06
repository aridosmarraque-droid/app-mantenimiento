
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { CostCenter, SubCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport, CRDailyReport } from '../types';

// --- HELPERS ---

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toDbOperationType = (type: OperationType): string => {
    switch (type) {
        case 'BREAKDOWN': return 'AVERIA';
        case 'LEVELS': return 'NIVELES';
        case 'MAINTENANCE': return 'MANTENIMIENTO';
        case 'SCHEDULED': return 'PROGRAMADO';
        case 'REFUELING': return 'REPOSTAJE';
        default: return type;
    }
};

const fromDbOperationType = (type: string): OperationType => {
    switch (type) {
        case 'AVERIA': return 'BREAKDOWN';
        case 'DESINTEGRACION': return 'BREAKDOWN';
        case 'NIVELES': return 'LEVELS';
        case 'MANTENIMIENTO': return 'MAINTENANCE';
        case 'PROGRAMADO': return 'SCHEDULED';
        case 'REPOSTAJE': return 'REFUELING';
        default: return type as OperationType;
    }
};

// --- MAPPERS ---

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre,
    dni: w.dni,
    phone: w.telefono,
    positionIds: [], 
    role: w.rol,
    active: w.activo !== undefined ? w.activo : true
});

const mapSubCenter = (s: any): SubCenter => ({
    id: s.id,
    centerId: s.centro_id,
    name: s.nombre,
    tracksProduction: s.registra_produccion || false,
    productionField: s.vinculo_produccion || undefined
});

const mapDef = (d: any): MaintenanceDefinition => ({
    id: d.id,
    machineId: d.maquina_id,
    name: d.nombre,
    maintenanceType: d.tipo_programacion || 'HOURS',
    intervalHours: d.intervalo_horas || 0,
    warningHours: d.horas_preaviso || 0, 
    lastMaintenanceHours: d.ultimas_horas_realizadas,
    remainingHours: d.horas_restantes !== undefined ? d.horas_restantes : 0,
    intervalMonths: d.intervalo_meses || 0,
    nextDate: d.proxima_fecha ? new Date(d.proxima_fecha) : undefined,
    lastMaintenanceDate: d.ultima_fecha ? new Date(d.ultima_fecha) : undefined,
    tasks: d.tareas,
    pending: d.pendiente || false,
});

const mapMachine = (m: any): Machine => {
    const defs = m.mant_mantenimientos_def; 
    return {
        id: m.id,
        costCenterId: m.centro_id, 
        subCenterId: m.subcentro_id,
        name: m.nombre,
        companyCode: m.codigo_empresa,
        currentHours: m.horas_actuales,
        requiresHours: m.requiere_horas, 
        adminExpenses: m.gastos_admin,
        transportExpenses: m.gastos_transporte,
        maintenanceDefs: defs ? defs.map(mapDef) : [],
        selectableForReports: m.es_parte_trabajo,
        responsibleWorkerId: m.responsable_id,
        active: m.activo !== undefined ? m.activo : true,
        vinculadaProduccion: m.vinculada_produccion
    };
};

const mapLogFromDb = (dbLog: any): OperationLog => ({
  id: dbLog.id,
  date: new Date(dbLog.fecha),
  workerId: dbLog.trabajador_id,
  machineId: dbLog.maquina_id,
  hoursAtExecution: Number(dbLog.horas_registro),
  type: fromDbOperationType(dbLog.tipo_operacion),
  motorOil: dbLog.aceite_motor_l,
  hydraulicOil: dbLog.aceite_hidraulico_l,
  coolant: dbLog.refrigerante_l,
  breakdownCause: dbLog.causa_averia,
  breakdownSolution: dbLog.solucion_averia,
  repairerId: dbLog.reparador_id,
  maintenanceType: dbLog.tipo_mantenimiento,
  description: dbLog.description,
  materials: dbLog.materiales,
  maintenanceDefId: dbLog.mantenimiento_def_id,
  fuelLitres: dbLog.litros_combustible
});

// --- TRABAJADORES ---

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) { console.error("DB Error getWorkers:", error); return []; }
    const workers = (data || [])
        .map(mapWorker)
        .sort((a, b) => a.name.localeCompare(b.name));
    return onlyActive ? workers.filter(w => w.active !== false) : workers;
};

export const createWorker = async (worker: Omit<Worker, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveWorker(worker);
    const { error } = await supabase.from('mant_trabajadores').insert({
        nombre: worker.name,
        dni: worker.dni,
        telefono: worker.phone,
        rol: worker.role,
        activo: worker.active ?? true
    });
    if (error) throw error;
};

export const updateWorker = async (id: string, updates: Partial<Worker>): Promise<void> => {
    if (!isConfigured) return mock.updateWorker(id, updates);
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.dni !== undefined) dbUpdates.dni = updates.dni;
    if (updates.phone !== undefined) dbUpdates.telefono = updates.phone;
    if (updates.role !== undefined) dbUpdates.rol = updates.role;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    const { error } = await supabase.from('mant_trabajadores').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

// --- CENTROS Y SUBCENTROS ---

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) { console.error("getCostCenters", error); return []; }
    return (data || [])
        .map((c: any) => ({ id: c.id, name: c.nombre }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const getSubCentersByCenter = async (centerId: string): Promise<SubCenter[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_subcentros').select('*').eq('centro_id', centerId);
    if (error) return [];
    return data.map(mapSubCenter).sort((a, b) => a.name.localeCompare(b.name));
};

export const createSubCenter = async (sub: Omit<SubCenter, 'id'>): Promise<void> => {
    const { error } = await supabase.from('mant_subcentros').insert({
        centro_id: sub.centerId,
        nombre: sub.name,
        registra_produccion: sub.tracksProduction,
        vinculo_produccion: sub.tracksProduction ? sub.productionField : null
    });
    if (error) throw error;
};

export const deleteSubCenter = async (id: string): Promise<void> => {
    const { error } = await supabase.from('mant_subcentros').delete().eq('id', id);
    if (error) throw error;
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.tracksProduction !== undefined) dbUpdates.registra_produccion = updates.tracksProduction;
    
    if (updates.tracksProduction === false) {
        dbUpdates.vinculo_produccion = null;
    } else if (updates.productionField !== undefined) {
        dbUpdates.vinculo_produccion = updates.productionField;
    }

    const { error } = await supabase.from('mant_subcentros').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name);
    const { data, error } = await supabase.from('mant_centros').insert({ nombre: name }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.nombre };
};

export const updateCostCenter = async (id: string, name: string): Promise<void> => {
    if (!isConfigured) return mock.updateCostCenter(id, name);
    const { error } = await supabase.from('mant_centros').update({ nombre: name }).eq('id', id);
    if (error) throw error;
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteCostCenter(id);
    const { error } = await supabase.from('mant_centros').delete().eq('id', id);
    if (error) throw error;
};

// --- MÁQUINAS ---

const sortMachines = (machines: Machine[]) => {
    return machines.sort((a, b) => {
        const codeA = a.companyCode || '';
        const codeB = b.companyCode || '';
        if (codeA && codeB) return codeA.localeCompare(codeB);
        if (codeA) return -1;
        if (codeB) return 1;
        return a.name.localeCompare(b.name);
    });
};

export const getMachinesBySubCenter = async (subCenterId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('subcentro_id', subCenterId);
    if (error) return [];
    const machines = data.map(mapMachine);
    const sorted = sortMachines(machines);
    return onlyActive ? sorted.filter(m => m.active !== false) : sorted;
};

export const getMachinesByCenter = async (centerId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
    if (error) return [];
    const machines = data.map(mapMachine);
    const sorted = sortMachines(machines);
    return onlyActive ? sorted.filter(m => m.active !== false) : sorted;
};

export const getAllMachines = async (onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)');
    if (error) return [];
    const machines = data.map(mapMachine);
    const sorted = sortMachines(machines);
    return onlyActive ? sorted.filter(m => m.active !== false) : sorted;
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    const { data, error } = await supabase.from('mant_maquinas').insert({
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        centro_id: machine.costCenterId,
        subcentro_id: machine.subCenterId,
        responsable_id: machine.responsibleWorkerId,
        horas_actuales: machine.currentHours,
        requiere_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses,
        es_parte_trabajo: machine.selectableForReports,
        activo: machine.active ?? true,
        vinculada_produccion: machine.vinculadaProduccion
    }).select().single();
    if (error) throw error;

    if (machine.maintenanceDefs && machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: data.id,
            nombre: d.name,
            tipo_programacion: d.maintenanceType,
            intervalo_horas: d.intervalHours,
            horas_preaviso: d.warningHours,
            intervalo_meses: d.intervalMonths,
            proxima_fecha: d.nextDate ? toLocalDateString(d.nextDate) : null,
            tareas: d.tasks
        }));
        await supabase.from('mant_mantenimientos_def').insert(defsToInsert);
    }

    return mapMachine({ ...data, mant_mantenimientos_def: [] });
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.companyCode !== undefined) dbUpdates.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) dbUpdates.centro_id = updates.costCenterId;
    if (updates.subCenterId !== undefined) dbUpdates.subcentro_id = updates.subCenterId;
    if (updates.responsibleWorkerId !== undefined) dbUpdates.responsable_id = updates.responsibleWorkerId;
    if (updates.currentHours !== undefined) dbUpdates.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) dbUpdates.requiere_horas = updates.requiresHours;
    if (updates.adminExpenses !== undefined) dbUpdates.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) dbUpdates.gastos_transporte = updates.transportExpenses;
    if (updates.selectableForReports !== undefined) dbUpdates.es_parte_trabajo = updates.selectableForReports;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    if (updates.vinculadaProduccion !== undefined) dbUpdates.vinculada_produccion = updates.vinculadaProduccion;

    const { error } = await supabase.from('mant_maquinas').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const deleteMachine = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMachine(id);
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

export const getMachineDependencyCount = async (machineId: string) => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    const { count: logsCount } = await supabase.from('mant_operaciones_log').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId);
    const { count: personalCount } = await supabase.from('mant_personal_reportes').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId);
    return { logs: logsCount || 0, reports: personalCount || 0 };
};

// --- MANTENIMIENTOS DEF ---

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks
    }).select().single();
    if (error) throw error;
    return mapDef(data);
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) return mock.updateMaintenanceDef(def);
    const { error } = await supabase.from('mant_mantenimientos_def').update({
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks
    }).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMaintenanceDef(defId);
    const { error } = await supabase.from('mant_mantenimientos_def').delete().eq('id', defId);
    if (error) throw error;
};

// --- PROVEEDORES ---

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('mant_proveedores').select('*');
    if (error) return [];
    return data.map((p: any) => ({ id: p.id, name: p.nombre })).sort((a: any, b: any) => a.name.localeCompare(b.name));
};

export const createServiceProvider = async (name: string): Promise<void> => {
    if (!isConfigured) return mock.createServiceProvider(name);
    const { error } = await supabase.from('mant_proveedores').insert({ nombre: name });
    if (error) throw error;
};

export const updateServiceProvider = async (id: string, name: string): Promise<void> => {
    if (!isConfigured) return mock.updateServiceProvider(id, name);
    const { error } = await supabase.from('mant_proveedores').update({ nombre: name }).eq('id', id);
    if (error) throw error;
};

export const deleteServiceProvider = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteServiceProvider(id);
    const { error } = await supabase.from('mant_proveedores').delete().eq('id', id);
    if (error) throw error;
};

// --- OPERACIONES ---

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>, isSyncing = false): Promise<OperationLog> => {
    if (!navigator.onLine && !isSyncing) {
        offline.addToQueue('LOG', log);
        return { ...log, id: 'offline-' + Date.now() } as OperationLog;
    }
    if (!isConfigured) return mock.saveOperationLog(log);
    
    const { data, error } = await supabase.from('mant_operaciones_log').insert({
        fecha: toLocalDateString(log.date),
        trabajador_id: log.workerId,
        maquina_id: log.machineId,
        horas_registro: log.hoursAtExecution,
        tipo_operacion: toDbOperationType(log.type),
        aceite_motor_l: log.motorOil,
        aceite_hidraulico_l: log.hydraulicOil,
        refrigerante_l: log.coolant,
        causa_averia: log.breakdownCause,
        solucion_averia: log.breakdownSolution,
        reparador_id: log.repairerId,
        tipo_mantenimiento: log.maintenanceType,
        description: log.description,
        materiales: log.materials,
        mantenimiento_def_id: log.maintenanceDefId,
        litros_combustible: log.fuelLitres
    }).select().single();
    
    if (error) throw error;
    return mapLogFromDb(data);
};

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return mock.getMachineLogs(machineId, startDate, endDate, types);
    let query = supabase.from('mant_operaciones_log').select('*').eq('maquina_id', machineId);
    
    if (startDate) query = query.gte('fecha', toLocalDateString(startDate));
    if (endDate) query = query.lte('fecha', toLocalDateString(endDate));
    if (types && types.length > 0) {
        const dbTypes = types.map(toDbOperationType);
        query = query.in('tipo_operacion', dbTypes);
    }
    
    const { data, error } = await query.order('fecha', { ascending: false }).order('horas_registro', { ascending: false });
    if (error) return [];
    return data.map(mapLogFromDb);
};

// --- CP REPORTS ---

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    const { data, error } = await supabase.from('mant_cp_reportes').select('*').order('fecha', { ascending: false }).limit(1).single();
    if (error) return null;
    return {
        id: data.id,
        date: new Date(data.fecha),
        workerId: data.trabajador_id,
        crusherStart: data.machacadora_inicio,
        crusherEnd: data.machacadora_fin,
        millsStart: data.molinos_inicio,
        millsEnd: data.molinos_fin,
        comments: data.comentarios,
        aiAnalysis: data.analisis_ia
    };
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>, isSyncing = false): Promise<void> => {
    if (!navigator.onLine && !isSyncing) {
        offline.addToQueue('CP_REPORT', report);
        return;
    }
    if (!isConfigured) return mock.saveCPReport(report);
    const { error } = await supabase.from('mant_cp_reportes').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: report.workerId,
        machacadora_inicio: report.crusherStart,
        machacadora_fin: report.crusherEnd,
        molinos_inicio: report.millsStart,
        molinos_fin: report.millsEnd,
        comentarios: report.comments,
        analisis_ia: report.aiAnalysis
    });
    if (error) throw error;
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return mock.getCPReportsByRange(startDate, endDate);
    const { data, error } = await supabase.from('mant_cp_reportes')
        .select('*')
        .gte('fecha', toLocalDateString(startDate))
        .lte('fecha', toLocalDateString(endDate))
        .order('fecha', { ascending: true });
    
    if (error) return [];
    return data.map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        crusherStart: r.machacadora_inicio,
        crusherEnd: r.machacadora_fin,
        millsStart: r.molinos_inicio,
        millsEnd: r.molinos_fin,
        comments: r.comentarios,
        aiAnalysis: r.analisis_ia
    }));
};

export const updateCPReportAnalysis = async (id: string, analysis: string): Promise<void> => {
    if (!isConfigured) return mock.updateCPReportAnalysis(id, analysis);
    const { error } = await supabase.from('mant_cp_reportes').update({ analisis_ia: analysis }).eq('id', id);
    if (error) throw error;
};

// --- CR REPORTS ---

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return mock.getLastCRReport();
    const { data, error } = await supabase.from('mant_cr_reportes').select('*').order('fecha', { ascending: false }).limit(1).single();
    if (error) return null;
    return {
        id: data.id,
        date: new Date(data.fecha),
        workerId: data.trabajador_id,
        washingStart: data.lavado_inicio,
        washingEnd: data.lavado_fin,
        triturationStart: data.trituracion_inicio,
        triturationEnd: data.trituracion_fin,
        comments: data.comentarios,
        aiAnalysis: data.analisis_ia
    };
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>, isSyncing = false): Promise<void> => {
    if (!navigator.onLine && !isSyncing) {
        offline.addToQueue('CR_REPORT', report);
        return;
    }
    if (!isConfigured) return mock.saveCRReport(report);
    const { error } = await supabase.from('mant_cr_reportes').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: report.workerId,
        lavado_inicio: report.washingStart,
        lavado_fin: report.washingEnd,
        trituracion_inicio: report.triturationStart,
        trituracion_fin: report.triturationEnd,
        comentarios: report.comments,
        analisis_ia: report.aiAnalysis
    });
    if (error) throw error;
};

// --- WEEKLY PLAN ---

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
    const { data, error } = await supabase.from('mant_cp_plan_semanal').select('*').eq('lunes_fecha', mondayDate).single();
    if (error) return null;
    return {
        id: data.id,
        mondayDate: data.lunes_fecha,
        hoursMon: data.h_lun,
        hoursTue: data.h_mar,
        hoursWed: data.h_mie,
        hoursThu: data.h_jue,
        hoursFri: data.h_vie
    };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);
    const { error } = await supabase.from('mant_cp_plan_semanal').upsert({
        lunes_fecha: plan.mondayDate,
        h_lun: plan.hoursMon,
        h_mar: plan.hoursTue,
        h_mie: plan.hoursWed,
        h_jue: plan.hoursThu,
        h_vie: plan.hoursFri
    }, { onConflict: 'lunes_fecha' });
    if (error) throw error;
};

// --- PERSONAL REPORTS ---

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured) return mock.getPersonalReports(workerId);
    const { data, error } = await supabase.from('mant_personal_reportes')
        .select('*, mant_centros(nombre), mant_maquinas(nombre, codigo_empresa)')
        .eq('trabajador_id', workerId)
        .order('fecha', { ascending: false })
        .limit(10);
    
    if (error) return [];
    return data.map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        hours: r.horas,
        costCenterId: r.centro_id,
        machineId: r.maquina_id,
        machineName: r.mant_maquinas ? `${r.mant_maquinas.codigo_empresa ? `[${r.mant_maquinas.codigo_empresa}] ` : ''}${r.mant_maquinas.nombre}` : undefined,
        costCenterName: r.mant_centros?.nombre,
        description: r.descripcion,
        location: r.ubicacion
    }));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>, isSyncing = false): Promise<void> => {
    if (!navigator.onLine && !isSyncing) {
        offline.addToQueue('PERSONAL_REPORT', report);
        return;
    }
    if (!isConfigured) return mock.savePersonalReport(report);
    const { error } = await supabase.from('mant_personal_reportes').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: report.workerId,
        horas: report.hours,
        centro_id: report.costCenterId,
        maquina_id: report.machineId,
        descripcion: report.description,
        ubicacion: report.location
    });
    if (error) throw error;
};

// --- AUDIT ---

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[] }> => {
    if (!isConfigured) return mock.getDailyAuditLogs(date);
    const dateStr = toLocalDateString(date);
    
    const [opsRes, personalRes] = await Promise.all([
        supabase.from('mant_operaciones_log').select('*').eq('fecha', dateStr),
        supabase.from('mant_personal_reportes').select('*, mant_centros(nombre), mant_maquinas(nombre, codigo_empresa)').eq('fecha', dateStr)
    ]);
    
    return {
        ops: (opsRes.data || []).map(mapLogFromDb),
        personal: (personalRes.data || []).map(r => ({
            id: r.id,
            date: new Date(r.fecha),
            workerId: r.trabajador_id,
            hours: r.horas,
            costCenterId: r.centro_id,
            machineId: r.maquina_id,
            machineName: r.mant_maquinas ? `${r.mant_maquinas.codigo_empresa ? `[${r.mant_maquinas.codigo_empresa}] ` : ''}${r.mant_maquinas.nombre}` : undefined,
            costCenterName: r.mant_centros?.nombre,
            description: r.descripcion,
            location: r.ubicacion
        }))
    };
};

// --- SYNC ---

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', machine.id).single();
    if (error) return machine;
    return mapMachine(data);
};

export const syncPendingData = async () => {
    const queue = offline.getQueue();
    let synced = 0;
    let errors = 0;

    for (const item of queue) {
        try {
            if (item.type === 'LOG') await saveOperationLog(item.payload, true);
            else if (item.type === 'CP_REPORT') await saveCPReport(item.payload, true);
            else if (item.type === 'CR_REPORT') await saveCRReport(item.payload, true);
            else if (item.type === 'PERSONAL_REPORT') await savePersonalReport(item.payload, true);
            
            offline.removeFromQueue(item.id);
            synced++;
        } catch (e) {
            console.error("Sync Error item:", item.type, e);
            errors++;
        }
    }
    return { synced, errors };
};
