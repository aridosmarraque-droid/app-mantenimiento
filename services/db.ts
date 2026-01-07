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
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toDbOperationType = (type: OperationType): string => {
    const map: Record<string, string> = {
        'BREAKDOWN': 'AVERIA',
        'LEVELS': 'NIVELES',
        'MAINTENANCE': 'MANTENIMIENTO',
        'SCHEDULED': 'PROGRAMADO',
        'REFUELING': 'REPOSTAJE'
    };
    return map[type] || type;
};

const fromDbOperationType = (type: string): OperationType => {
    const map: Record<string, OperationType> = {
        'AVERIA': 'BREAKDOWN',
        'NIVELES': 'LEVELS',
        'MANTENIMIENTO': 'MAINTENANCE',
        'PROGRAMADO': 'SCHEDULED',
        'REPOSTAJE': 'REFUELING'
    };
    return map[type] || (type as OperationType);
};

/**
 * Valida si un string tiene formato UUID.
 */
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Limpia un ID para asegurar que sea un UUID válido o NULL.
 */
const cleanUuid = (id: any): string | null => {
    if (!id || typeof id !== 'string') return null;
    const trimmed = id.trim();
    return isUuid(trimmed) ? trimmed : null;
};

/**
 * Asegura que un valor sea un número válido para la DB o NULL.
 */
const cleanNum = (val: any): number | null => {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
};

// ============================================================================
// MAPPERS
// ============================================================================

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre || 'Sin nombre',
    dni: w.dni || '',
    phone: w.telefono || '',
    positionIds: [], 
    role: w.rol || 'worker',
    active: w.activo !== undefined ? w.activo : true
});

// Added mapDef helper to fix "Cannot find name 'mapDef'" error
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
    tasks: d.tareas || '',
    pending: !!d.pendiente,
});

const mapMachine = (m: any): Machine => {
    const defs = m.mant_mantenimientos_def || []; 
    return {
        id: m.id,
        costCenterId: m.centro_id, 
        subCenterId: m.subcentro_id,
        name: m.nombre,
        companyCode: m.codigo_empresa,
        currentHours: Number(m.horas_actuales || 0),
        requiresHours: !!m.requiere_horas, 
        adminExpenses: !!m.gastos_admin,
        transportExpenses: !!m.gastos_transporte,
        maintenanceDefs: defs.map(mapDef),
        selectableForReports: !!m.es_parte_trabajo,
        responsibleWorkerId: m.responsable_id,
        active: m.activo !== undefined ? m.activo : true,
        vinculadaProduccion: !!m.vinculada_produccion
    };
};

const mapLogFromDb = (dbLog: any): OperationLog => ({
  id: dbLog.id,
  date: new Date(dbLog.fecha),
  workerId: dbLog.trabajador_id,
  machineId: dbLog.maquina_id,
  hoursAtExecution: Number(dbLog.horas_registro || 0),
  type: fromDbOperationType(dbLog.tipo_operacion),
  motorOil: dbLog.aceite_motor_l ? Number(dbLog.aceite_motor_l) : undefined,
  hydraulicOil: dbLog.aceite_hidraulico_l ? Number(dbLog.aceite_hidraulico_l) : undefined,
  coolant: dbLog.refrigerante_l ? Number(dbLog.refrigerante_l) : undefined,
  breakdownCause: dbLog.causa_averia,
  breakdownSolution: dbLog.solucion_averia,
  repairerId: dbLog.reparador_id,
  maintenanceType: dbLog.tipo_mantenimiento,
  description: dbLog.description, 
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
            if (status === 404) results.push({ name: table, status: 'NOT_FOUND', columns: [] });
            else if (error) results.push({ name: table, status: 'ERROR', message: error.message, columns: [] });
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
    if (error) return [];
    const workers = (data || []).map(mapWorker).sort((a, b) => a.name.localeCompare(b.name));
    return onlyActive ? workers.filter(w => w.active !== false) : workers;
};

export const createWorker = async (worker: Omit<Worker, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveWorker(worker);
    await supabase.from('mant_trabajadores').insert({
        nombre: worker.name,
        dni: worker.dni,
        telefono: worker.phone,
        rol: worker.role,
        activo: worker.active ?? true
    });
};

export const updateWorker = async (id: string, updates: Partial<Worker>): Promise<void> => {
    if (!isConfigured) return mock.updateWorker(id, updates);
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.dni !== undefined) dbUpdates.dni = updates.dni;
    if (updates.phone !== undefined) dbUpdates.telefono = updates.phone;
    if (updates.role !== undefined) dbUpdates.rol = updates.role;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    await supabase.from('mant_trabajadores').update(dbUpdates).eq('id', id);
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
    if (!isConfigured || !isUuid(centerId)) return [];
    const { data, error } = await supabase.from('mant_subcentros').select('*').eq('centro_id', centerId);
    if (error) return [];
    return data.map(s => ({
        id: s.id,
        centerId: s.centro_id,
        name: s.nombre,
        tracksProduction: !!s.es_produccion,
        productionField: s.campo_produccion
    })).sort((a, b) => a.name.localeCompare(b.name));
};

export const createSubCenter = async (sub: Omit<SubCenter, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    await supabase.from('mant_subcentros').insert({
        centro_id: sub.centerId,
        nombre: sub.name,
        es_produccion: sub.tracksProduction,
        campo_produccion: sub.tracksProduction ? sub.productionField : null
    });
};

export const deleteSubCenter = async (id: string): Promise<void> => {
    if (!isConfigured || !isUuid(id)) return;
    await supabase.from('mant_subcentros').delete().eq('id', id);
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    if (!isConfigured || !isUuid(id)) return;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.tracksProduction !== undefined) dbUpdates.es_produccion = updates.tracksProduction;
    if (updates.productionField !== undefined) dbUpdates.campo_produccion = updates.productionField;
    await supabase.from('mant_subcentros').update(dbUpdates).eq('id', id);
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name);
    const { data, error } = await supabase.from('mant_centros').insert({ nombre: name }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.nombre };
};

export const updateCostCenter = async (id: string, name: string): Promise<void> => {
    if (!isConfigured || !isUuid(id)) return;
    await supabase.from('mant_centros').update({ nombre: name }).eq('id', id);
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    if (!isConfigured || !isUuid(id)) return;
    await supabase.from('mant_centros').delete().eq('id', id);
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
    if (!isConfigured || !isUuid(centerId)) return mock.getMachinesByCenter(centerId);
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const getMachinesBySubCenter = async (subCenterId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured || !isUuid(subCenterId)) return [];
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
        centro_id: cleanUuid(machine.costCenterId),
        subcentro_id: cleanUuid(machine.subCenterId),
        responsable_id: cleanUuid(machine.responsibleWorkerId),
        horas_actuales: cleanNum(machine.currentHours) || 0,
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
    if (!isConfigured || !isUuid(id)) return;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.companyCode !== undefined) dbUpdates.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) dbUpdates.centro_id = cleanUuid(updates.costCenterId);
    if (updates.subCenterId !== undefined) dbUpdates.subcentro_id = cleanUuid(updates.subCenterId);
    if (updates.responsibleWorkerId !== undefined) dbUpdates.responsable_id = cleanUuid(updates.responsibleWorkerId);
    if (updates.currentHours !== undefined) dbUpdates.horas_actuales = cleanNum(updates.currentHours);
    if (updates.requiresHours !== undefined) dbUpdates.requiere_horas = updates.requiresHours;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    if (updates.vinculadaProduccion !== undefined) dbUpdates.vinculada_produccion = updates.vinculadaProduccion;
    if (updates.selectableForReports !== undefined) dbUpdates.es_parte_trabajo = updates.selectableForReports;
    await supabase.from('mant_maquinas').update(dbUpdates).eq('id', id);
};

// ============================================================================
// REGISTROS (MANT_REGISTROS) - ROBUSTEZ MÁXIMA
// ============================================================================

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    
    // Validación de IDs Críticos para evitar 400
    const trabajadorId = cleanUuid(log.workerId);
    const maquinaId = cleanUuid(log.machineId);

    if (!trabajadorId || !maquinaId) {
        const errorMsg = `Error: IDs de sesión inválidos. Trab: ${log.workerId}, Maq: ${log.machineId}. Por favor, cierra sesión y vuelve a entrar.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const payload = {
        fecha: toLocalDateString(log.date),
        trabajador_id: trabajadorId,
        maquina_id: maquinaId,
        horas_registro: cleanNum(log.hoursAtExecution) || 0,
        tipo_operacion: toDbOperationType(log.type),
        aceite_motor_l: cleanNum(log.motorOil),
        aceite_hidraulico_l: cleanNum(log.hydraulicOil),
        refrigerante_l: cleanNum(log.coolant),
        causa_averia: log.breakdownCause || null,
        solucion_averia: log.breakdownSolution || null,
        reparador_id: cleanUuid(log.repairerId),
        tipo_mantenimiento: log.maintenanceType || null,
        descripcion: log.description || null,
        materiales: log.materials || null,
        litros_combustible: cleanNum(log.fuelLitres),
        mantenimiento_def_id: cleanUuid(log.maintenanceDefId)
    };

    console.log("Intentando guardar log con payload:", payload);

    const { data, error } = await supabase.from('mant_registros').insert(payload).select().single();

    if (error) {
        const fullError = `DB Error: ${error.message} | Detalles: ${error.details || 'ninguno'} | Hint: ${error.hint || 'ninguno'}`;
        console.error(fullError, error);
        throw new Error(fullError);
    }

    // Actualizar horas de la máquina
    const h = cleanNum(log.hoursAtExecution);
    if (h !== null) {
        await supabase.from('mant_maquinas')
            .update({ horas_actuales: h })
            .eq('id', maquinaId)
            .lt('horas_actuales', h);
    }

    return mapLogFromDb(data);
};

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured || !isUuid(machineId)) return [];
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

export const addMaintenanceDef = async (def: MaintenanceDefinition, _currentHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, _currentHours);
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: cleanUuid(def.machineId),
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: cleanNum(def.intervalHours) || 0,
        horas_preaviso: cleanNum(def.warningHours) || 0,
        intervalo_meses: cleanNum(def.intervalMonths) || 0,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks
    }).select().single();
    if (error) throw error;
    return mapDef(data);
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured || !isUuid(def.id)) return;
    await supabase.from('mant_mantenimientos_def').update({
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: cleanNum(def.intervalHours) || 0,
        horas_preaviso: cleanNum(def.warningHours) || 0,
        intervalo_meses: cleanNum(def.intervalMonths) || 0,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks
    }).eq('id', def.id);
};

export const deleteMaintenanceDef = async (id: string): Promise<void> => {
    if (!isConfigured || !isUuid(id)) return;
    await supabase.from('mant_mantenimientos_def').delete().eq('id', id);
};

// ============================================================================
// PRODUCCIÓN (CP / CR / PERSONAL)
// ============================================================================

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('cp_partes_diarios').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: cleanUuid(report.workerId),
        machacadora_inicio: cleanNum(report.crusherStart),
        machacadora_fin: cleanNum(report.crusherEnd),
        molinos_inicio: cleanNum(report.millsStart),
        molinos_fin: cleanNum(report.millsEnd),
        comentarios: report.comments || null
    });
    if (error) throw error;
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: cleanUuid(report.workerId),
        lavado_inicio: cleanNum(report.washingStart),
        lavado_fin: cleanNum(report.washingEnd),
        trituration_inicio: cleanNum(report.triturationStart),
        trituration_fin: cleanNum(report.triturationEnd),
        comentarios: report.comments || null
    });
    if (error) throw error;
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('partes_trabajo').insert({ 
        fecha: new Date(report.date).toISOString(), 
        trabajador_id: cleanUuid(report.workerId), 
        horas: cleanNum(report.hours), 
        maquina_id: cleanUuid(report.machineId), 
        comentarios: report.description || null
    });
    if (error) throw error;
};

// Se mantienen el resto de funciones auxiliares...
export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return null;
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, crusherStart: Number(data.machacadora_inicio), crusherEnd: Number(data.machacadora_fin), millsStart: Number(data.molinos_inicio), millsEnd: Number(data.molinos_fin), comments: data.comentarios, aiAnalysis: data.ai_analisis };
};

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return null;
    const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return { id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, washingStart: Number(data.lavado_inicio), washingEnd: Number(data.lavado_fin), triturationStart: Number(data.trituration_inicio), triturationEnd: Number(data.trituration_fin), comments: data.comentarios };
};

export const getCPReportsByRange = async (start: Date, end: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('cp_partes_diarios').select('*').gte('fecha', toLocalDateString(start)).lte('fecha', toLocalDateString(end));
    return (data || []).map(r => ({ id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, crusherStart: Number(r.machacadora_inicio), crusherEnd: Number(r.machacadora_fin), millsStart: Number(r.molinos_inicio), millsEnd: Number(r.molinos_fin), comments: r.comentarios, aiAnalysis: r.ai_analisis }));
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return null;
    const { data } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', mondayDate).maybeSingle();
    if (!data) return null;
    return { id: data.id, mondayDate: data.fecha_lunes, hoursMon: data.hoursMon, hoursTue: data.hoursTue, hoursWed: data.hoursWed, hoursThu: data.hoursThu, hoursFri: data.hoursFri };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return;
    await supabase.from('cp_planificacion').upsert({ fecha_lunes: plan.mondayDate, horas_lunes: plan.hoursMon, horas_martes: plan.hoursTue, horas_miercoles: plan.hoursWed, horas_jueves: plan.hoursThu, horas_viernes: plan.hoursFri });
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured || !isUuid(workerId)) return [];
    const { data } = await supabase.from('partes_trabajo').select('*, mant_maquinas(nombre)').eq('trabajador_id', workerId).order('fecha', { ascending: false }).limit(10);
    return (data || []).map(r => ({ id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, hours: Number(r.horas), machineId: r.maquina_id, machineName: r.mant_maquinas?.nombre, description: r.comentarios }));
};

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[] }> => {
    if (!isConfigured) return { ops: [], personal: [] };
    const dateStr = toLocalDateString(date);
    const [resOps, resPers] = await Promise.all([
        supabase.from('mant_registros').select('*').eq('fecha', dateStr),
        supabase.from('partes_trabajo').select('*, mant_maquinas(nombre)').eq('fecha', dateStr)
    ]);
    return { ops: (resOps.data || []).map(mapLogFromDb), personal: (resPers.data || []).map(r => ({ id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, hours: Number(r.horas), machineId: r.maquina_id, machineName: r.mant_maquinas?.nombre, description: r.comentarios })) };
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data } = await supabase.from('mant_proveedores').select('*').order('nombre');
    return (data || []).map(p => ({ id: p.id, name: p.nombre }));
};

export const createServiceProvider = async (name: string) => { await supabase.from('mant_proveedores').insert({ nombre: name }); };
export const updateServiceProvider = async (id: string, name: string) => { await supabase.from('mant_proveedores').update({ nombre: name }).eq('id', id); };
export const deleteServiceProvider = async (id: string) => { await supabase.from('mant_proveedores').delete().eq('id', id); };

export const calculateAndSyncMachineStatus = async (m: Machine): Promise<Machine> => {
    if (!isConfigured) return m;
    const { data } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', m.id).single();
    return data ? mapMachine(data) : m;
};

export const deleteMachine = async (id: string) => { await supabase.from('mant_maquinas').delete().eq('id', id); };
export const getMachineDependencyCount = async (id: string) => { 
    const [res1, res2] = await Promise.all([
        supabase.from('mant_registros').select('*', { count: 'exact', head: true }).eq('maquina_id', id),
        supabase.from('partes_trabajo').select('*', { count: 'exact', head: true }).eq('maquina_id', id)
    ]);
    return { logs: res1.count || 0, reports: res2.count || 0 };
};

export const syncPendingData = async () => {
    if (!isConfigured) return { synced: 0, errors: 0 };
    const queue = offline.getQueue();
    let synced = 0, errors = 0;
    for (const item of queue) {
        try {
            if (item.type === 'LOG') await saveOperationLog(item.payload);
            else if (item.type === 'CP_REPORT') await saveCPReport(item.payload);
            else if (item.type === 'CR_REPORT') await saveCRReport(item.payload);
            else if (item.type === 'PERSONAL_REPORT') await savePersonalReport(item.payload);
            offline.removeFromQueue(item.id); synced++;
        } catch (e) { errors++; }
    }
    return { synced, errors };
};

export const updateCPReportAnalysis = async (id: string, a: string) => { await supabase.from('cp_partes_diarios').update({ ai_analisis: a }).eq('id', id); };
