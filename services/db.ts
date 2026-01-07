import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { 
    CostCenter, 
    SubCenter, 
    Machine, 
    ServiceProvider, 
    Worker, 
    OperationLog, 
    MaintenanceDefinition, 
    OperationType, 
    CPDailyReport, 
    CPWeeklyPlan, 
    PersonalReport, 
    CRDailyReport 
} from '../types';

// ============================================================================
// HELPERS Y UTILIDADES DE CONVERSIÓN
// ============================================================================

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
        case 'NIVELES': return 'LEVELS';
        case 'MANTENIMIENTO': return 'MAINTENANCE';
        case 'PROGRAMADO': return 'SCHEDULED';
        case 'REPOSTAJE': return 'REFUELING';
        default: return type as OperationType;
    }
};

/**
 * Limpia un string para que sea un UUID válido o null.
 * Supabase devuelve 400 si envías "" a una columna UUID.
 */
const cleanUuid = (id: string | undefined | null): string | null => {
    if (!id || id.trim() === '' || id === 'undefined') return null;
    return id;
};

// ============================================================================
// MAPPERS (CONVERSIÓN DE DB A TYPES)
// ============================================================================

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
    tracksProduction: s.es_produccion || false,
    productionField: s.campo_produccion || undefined
});

const mapDef = (d: any): MaintenanceDefinition => ({
    id: d.id,
    machineId: d.maquina_id,
    name: d.nombre,
    maintenanceType: d.tipo_programacion || 'HOURS',
    intervalHours: Number(d.intervalo_horas || 0),
    warningHours: Number(d.horas_preaviso || 0), 
    lastMaintenanceHours: Number(d.ultimas_horas_realizadas || 0),
    remainingHours: Number(d.horas_restantes || 0),
    intervalMonths: Number(d.intervalo_meses || 0),
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
        currentHours: Number(m.horas_actuales || 0),
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
  motorOil: dbLog.aceite_motor_l ? Number(dbLog.aceite_motor_l) : undefined,
  hydraulicOil: dbLog.aceite_hidraulico_l ? Number(dbLog.aceite_hidraulico_l) : undefined,
  coolant: dbLog.refrigerante_l ? Number(dbLog.refrigerante_l) : undefined,
  breakdownCause: dbLog.causa_averia,
  breakdownSolution: dbLog.solucion_averia,
  repairerId: dbLog.reparador_id,
  maintenanceType: dbLog.tipo_mantenimiento,
  description: dbLog.descripcion, 
  materials: dbLog.materiales,
  maintenanceDefId: dbLog.mantenimiento_def_id,
  fuelLitres: dbLog.litros_combustible ? Number(dbLog.litros_combustible) : undefined
});

// ============================================================================
// DIAGNÓSTICO
// ============================================================================

export const getSchemaInfo = async (tables: string[]): Promise<any[]> => {
    if (!isConfigured) return [];
    const results = [];
    for (const table of tables) {
        try {
            const { data, error, status } = await supabase.from(table).select('*').limit(1);
            if (status === 404) { results.push({ name: table, status: 'NOT_FOUND', columns: [] }); }
            else if (error) { results.push({ name: table, status: 'ERROR', message: error.message, columns: [] }); }
            else {
                const cols = data && data[0] ? Object.keys(data[0]) : [];
                results.push({ name: table, status: 'FOUND', columns: cols });
            }
        } catch (e) { results.push({ name: table, status: 'EXCEPTION', message: (e as Error).message }); }
    }
    return results;
};

// ============================================================================
// TRABAJADORES
// ============================================================================

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) { console.error("Error getWorkers:", error); return []; }
    const workers = (data || []).map(mapWorker).sort((a, b) => a.name.localeCompare(b.name));
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

// ============================================================================
// CENTROS Y SUBCENTROS
// ============================================================================

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) return [];
    return (data || []).map((c: any) => ({ id: c.id, name: c.nombre })).sort((a, b) => a.name.localeCompare(b.name));
};

export const getSubCentersByCenter = async (centerId: string): Promise<SubCenter[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_subcentros').select('*').eq('centro_id', centerId);
    if (error) return [];
    return data.map(mapSubCenter).sort((a, b) => a.name.localeCompare(b.name));
};

export const createSubCenter = async (sub: Omit<SubCenter, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').insert({
        centro_id: sub.centerId,
        nombre: sub.name,
        es_produccion: sub.tracksProduction,
        campo_produccion: sub.tracksProduction ? sub.productionField : null
    });
    if (error) throw error;
};

export const deleteSubCenter = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').delete().eq('id', id);
    if (error) throw error;
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    if (!isConfigured) return;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.tracksProduction !== undefined) dbUpdates.es_produccion = updates.tracksProduction;
    if (updates.productionField !== undefined) dbUpdates.campo_produccion = updates.productionField;
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

// ============================================================================
// MÁQUINAS
// ============================================================================

export const getAllMachines = async (onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)');
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const getMachinesByCenter = async (centerId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const getMachinesBySubCenter = async (subCenterId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('subcentro_id', subCenterId);
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    const { data, error } = await supabase.from('mant_maquinas').insert({
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        centro_id: machine.costCenterId,
        subcentro_id: machine.subCenterId,
        responsable_id: cleanUuid(machine.responsibleWorkerId),
        horas_actuales: machine.currentHours,
        requiere_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses,
        es_parte_trabajo: machine.selectableForReports,
        activo: machine.active ?? true,
        vinculada_produccion: machine.vinculadaProduccion
    }).select().single();
    if (error) throw error;
    return mapMachine({ ...data, mant_mantenimientos_def: [] });
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.companyCode !== undefined) dbUpdates.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) dbUpdates.centro_id = updates.costCenterId;
    if (updates.subCenterId !== undefined) dbUpdates.subcentro_id = cleanUuid(updates.subCenterId);
    if (updates.responsibleWorkerId !== undefined) dbUpdates.responsable_id = cleanUuid(updates.responsibleWorkerId);
    if (updates.currentHours !== undefined) dbUpdates.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) dbUpdates.requiere_horas = updates.requiresHours;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    if (updates.vinculadaProduccion !== undefined) dbUpdates.vinculada_produccion = updates.vinculadaProduccion;
    if (updates.selectableForReports !== undefined) dbUpdates.es_parte_trabajo = updates.selectableForReports;
    const { error } = await supabase.from('mant_maquinas').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

// ============================================================================
// REGISTROS (AUDITADOS CONTRA SQL REAL)
// ============================================================================

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    
    // Limpiamos los UUIDs para evitar Error 400 (Bad Request)
    const payload = {
        fecha: toLocalDateString(log.date),
        trabajador_id: cleanUuid(log.workerId),
        maquina_id: cleanUuid(log.machineId),
        horas_registro: Number(log.hoursAtExecution),
        tipo_operacion: toDbOperationType(log.type),
        aceite_motor_l: log.motorOil ? Number(log.motorOil) : null,
        aceite_hidraulico_l: log.hydraulicOil ? Number(log.hydraulicOil) : null,
        refrigerante_l: log.coolant ? Number(log.coolant) : null,
        causa_averia: log.breakdownCause || null,
        solucion_averia: log.breakdownSolution || null,
        reparador_id: cleanUuid(log.repairerId),
        tipo_mantenimiento: log.maintenanceType || null,
        descripcion: log.description || null,
        materiales: log.materials || null,
        litros_combustible: log.fuelLitres ? Number(log.fuelLitres) : null,
        mantenimiento_def_id: cleanUuid(log.maintenanceDefId)
    };

    const { data, error } = await supabase.from('mant_registros').insert(payload).select().single();

    if (error) {
        console.error("Error al guardar en mant_registros:", error);
        throw error;
    }

    // Actualizamos las horas actuales de la máquina
    await supabase.from('mant_maquinas')
        .update({ horas_actuales: Number(log.hoursAtExecution) })
        .eq('id', log.machineId)
        .lt('horas_actuales', Number(log.hoursAtExecution));

    return mapLogFromDb(data);
};

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return mock.getMachineLogs(machineId, startDate, endDate, types);
    let query = supabase.from('mant_registros').select('*').eq('maquina_id', machineId);
    if (startDate) query = query.gte('fecha', toLocalDateString(startDate));
    if (endDate) query = query.lte('fecha', toLocalDateString(endDate));
    if (types && types.length > 0) query = query.in('tipo_operacion', types.map(toDbOperationType));
    const { data, error } = await query.order('fecha', { ascending: false }).order('horas_registro', { ascending: false });
    if (error) return [];
    return (data || []).map(mapLogFromDb);
};

// ============================================================================
// MANTENIMIENTOS DEFINICIÓN
// ============================================================================

export const addMaintenanceDef = async (def: MaintenanceDefinition, _currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, _currentMachineHours);
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: Number(def.intervalHours || 0),
        horas_preaviso: Number(def.warningHours || 0),
        intervalo_meses: Number(def.intervalMonths || 0),
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
        intervalo_horas: Number(def.intervalHours || 0),
        horas_preaviso: Number(def.warningHours || 0),
        intervalo_meses: Number(def.intervalMonths || 0),
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

// ============================================================================
// PRODUCCIÓN (CP / CR)
// ============================================================================

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { 
        id: data.id, 
        date: new Date(data.fecha), 
        workerId: data.trabajador_id, 
        crusherStart: Number(data.machacadora_inicio), 
        crusherEnd: Number(data.machacadora_fin), 
        millsStart: Number(data.molinos_inicio), 
        millsEnd: Number(data.molinos_fin), 
        comments: data.comentarios, 
        aiAnalysis: data.ai_analisis 
    };
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCPReport(report);
    const { error } = await supabase.from('cp_partes_diarios').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: cleanUuid(report.workerId),
        machacadora_inicio: Number(report.crusherStart),
        machacadora_fin: Number(report.crusherEnd),
        molinos_inicio: Number(report.millsStart),
        molinos_fin: Number(report.millsEnd),
        comentarios: report.comments || null
    });
    if (error) throw error;
};

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return mock.getLastCRReport();
    const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { 
        id: data.id, 
        date: new Date(data.fecha), 
        workerId: data.trabajador_id, 
        washingStart: Number(data.lavado_inicio), 
        washingEnd: Number(data.lavado_fin), 
        triturationStart: Number(data.trituration_inicio), 
        triturationEnd: Number(data.trituracion_fin), 
        comments: data.comentarios,
        aiAnalysis: data.ai_analisis
    };
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCRReport(report);
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: cleanUuid(report.workerId),
        lavado_inicio: Number(report.washingStart),
        lavado_fin: Number(report.washingEnd),
        trituration_inicio: Number(report.triturationStart),
        trituracion_fin: Number(report.triturationEnd),
        comentarios: report.comments || null
    });
    if (error) throw error;
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return mock.getCPReportsByRange(startDate, endDate);
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').gte('fecha', toLocalDateString(startDate)).lte('fecha', toLocalDateString(endDate)).order('fecha', { ascending: true });
    if (error) return [];
    return (data || []).map(r => ({ 
        id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, 
        crusherStart: Number(r.machacadora_inicio), crusherEnd: Number(r.machacadora_fin), 
        millsStart: Number(r.molinos_inicio), millsEnd: Number(r.molinos_fin), 
        comments: r.comentarios, aiAnalysis: r.ai_analisis 
    }));
};

export const updateCPReportAnalysis = async (id: string, analysis: string): Promise<void> => {
    if (!isConfigured) return mock.updateCPReportAnalysis(id, analysis);
    const { error } = await supabase.from('cp_partes_diarios').update({ ai_analisis: analysis }).eq('id', id);
    if (error) throw error;
};

// ============================================================================
// PLANIFICACIÓN SEMANAL
// ============================================================================

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
    const { data, error } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', mondayDate).maybeSingle();
    if (error || !data) return null;
    return { id: data.id, mondayDate: data.fecha_lunes, hoursMon: data.horas_lunes, hoursTue: data.horas_martes, hoursWed: data.horas_miercoles, hoursThu: data.horas_jueves, hoursFri: data.horas_viernes };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);
    const { error } = await supabase.from('cp_planificacion').upsert({ 
        fecha_lunes: plan.mondayDate, 
        horas_lunes: Number(plan.hoursMon), 
        horas_martes: Number(plan.hoursTue), 
        horas_miercoles: Number(plan.hoursWed), 
        horas_jueves: Number(plan.hoursThu), 
        horas_viernes: Number(plan.hoursFri) 
    }, { onConflict: 'fecha_lunes' });
    if (error) throw error;
};

// ============================================================================
// PROVEEDORES
// ============================================================================

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('mant_proveedores').select('*').order('nombre');
    if (error) return [];
    return (data || []).map((p: any) => ({ id: p.id, name: p.nombre }));
};

export const createServiceProvider = async (name: string): Promise<void> => {
    if (!isConfigured) return mock.createServiceProvider(name);
    await supabase.from('mant_proveedores').insert({ nombre: name });
};

export const updateServiceProvider = async (id: string, name: string): Promise<void> => {
    if (!isConfigured) return mock.updateServiceProvider(id, name);
    await supabase.from('mant_proveedores').update({ nombre: name }).eq('id', id);
};

export const deleteServiceProvider = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteServiceProvider(id);
    await supabase.from('mant_proveedores').delete().eq('id', id);
};

// ============================================================================
// REPORTES PERSONALES (TABLA: partes_trabajo)
// ============================================================================

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured) return mock.getPersonalReports(workerId);
    const { data, error } = await supabase.from('partes_trabajo')
        .select('*, mant_maquinas(nombre, codigo_empresa)')
        .eq('trabajador_id', workerId)
        .order('fecha', { ascending: false })
        .limit(15);
    if (error) return [];
    return (data || []).map(r => ({ 
        id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, 
        hours: Number(r.horas), machineId: r.maquina_id, 
        machineName: r.mant_maquinas?.nombre, description: r.comentarios 
    }));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.savePersonalReport(report);
    const { error } = await supabase.from('partes_trabajo').insert({ 
        fecha: new Date(report.date).toISOString(), 
        trabajador_id: cleanUuid(report.workerId), 
        horas: Number(report.hours), 
        maquina_id: cleanUuid(report.machineId), 
        comentarios: report.description || null
    });
    if (error) throw error;
};

// ============================================================================
// AUDITORÍA Y SISTEMA
// ============================================================================

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[] }> => {
    if (!isConfigured) return mock.getDailyAuditLogs(date);
    const dateStr = toLocalDateString(date);
    const [opsRes, personalRes] = await Promise.all([
        supabase.from('mant_registros').select('*').eq('fecha', dateStr),
        supabase.from('partes_trabajo').select('*, mant_maquinas(nombre)').eq('fecha', dateStr)
    ]);
    return {
        ops: (opsRes.data || []).map(mapLogFromDb),
        personal: (personalRes.data || []).map(r => ({ 
            id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, 
            hours: Number(r.horas), machineId: r.maquina_id, 
            machineName: r.mant_maquinas?.nombre, description: r.comentarios 
        }))
    };
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return machine;
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', machine.id).single();
    if (error || !data) return machine;
    return mapMachine(data);
};

export const deleteMachine = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMachine(id);
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

export const getMachineDependencyCount = async (machineId: string) => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    const { count: ops } = await supabase.from('mant_registros').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId);
    const { count: reports } = await supabase.from('partes_trabajo').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId);
    return { logs: ops || 0, reports: reports || 0 };
};

export const syncPendingData = async () => {
    if (!isConfigured) return { synced: 0, errors: 0 };
    const queue = offline.getQueue();
    if (queue.length === 0) return { synced: 0, errors: 0 };
    let synced = 0, errors = 0;
    for (const item of queue) {
        try {
            if (item.type === 'LOG') await saveOperationLog(item.payload);
            else if (item.type === 'CP_REPORT') await saveCPReport(item.payload);
            else if (item.type === 'CR_REPORT') await saveCRReport(item.payload);
            else if (item.type === 'PERSONAL_REPORT') await savePersonalReport(item.payload);
            offline.removeFromQueue(item.id);
            synced++;
        } catch (e) { console.error("Error syncing", item, e); errors++; }
    }
    return { synced, errors };
};
