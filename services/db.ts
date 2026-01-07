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
    return type; 
};

const fromDbOperationType = (type: string): OperationType => {
    const upperType = (type || '').toUpperCase();
    const map: Record<string, OperationType> = {
        'AVERIA': 'BREAKDOWN',
        'AVERÍA': 'BREAKDOWN',
        'NIVELES': 'LEVELS',
        'MANTENIMIENTO': 'MAINTENANCE',
        'PROGRAMADO': 'SCHEDULED',
        'REPOSTAJE': 'REFUELING',
        'COMBUSTIBLE': 'REFUELING'
    };
    return map[upperType] || (upperType as OperationType);
};

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const cleanUuid = (id: any): string | null => {
    if (!id || typeof id !== 'string' || id === 'null' || id === 'undefined') return null;
    const trimmed = id.trim();
    return isUuid(trimmed) ? trimmed : null;
};

const cleanNum = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
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
  description: dbLog.descripcion, 
  materials: dbLog.materiales,
  maintenanceDefId: dbLog.mantenimiento_def_id,
  fuelLitres: dbLog.litros_combustible ? Number(dbLog.litros_combustible) : undefined
});

// ============================================================================
// FUNCIONES DE ACCESO
// ============================================================================

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) return [];
    const workers = (data || []).map(mapWorker).sort((a, b) => a.name.localeCompare(b.name));
    return onlyActive ? workers.filter(w => w.active !== false) : workers;
};

export const createWorker = async (w: Omit<Worker, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveWorker(w);
    const { error } = await supabase.from('mant_trabajadores').insert({
        nombre: w.name,
        dni: w.dni,
        telefono: w.phone,
        rol: w.role,
        activo: w.active
    });
    if (error) throw error;
};

export const updateWorker = async (id: string, updates: Partial<Worker>): Promise<void> => {
    if (!isConfigured) return mock.updateWorker(id, updates);
    const payload: any = {};
    if (updates.name !== undefined) payload.nombre = updates.name;
    if (updates.dni !== undefined) payload.dni = updates.dni;
    if (updates.phone !== undefined) payload.telefono = updates.phone;
    if (updates.role !== undefined) payload.rol = updates.role;
    if (updates.active !== undefined) payload.activo = updates.active;
    
    const { error } = await supabase.from('mant_trabajadores').update(payload).eq('id', id);
    if (error) throw error;
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) return [];
    return (data || []).map((c: any) => ({ id: c.id, name: c.nombre }));
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
    }));
};

export const createSubCenter = async (s: Omit<SubCenter, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').insert({
        centro_id: cleanUuid(s.centerId),
        nombre: s.name,
        es_produccion: s.tracksProduction,
        campo_produccion: s.productionField
    });
    if (error) throw error;
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    if (!isConfigured) return;
    const payload: any = {};
    if (updates.name !== undefined) payload.nombre = updates.name;
    if (updates.tracksProduction !== undefined) payload.es_produccion = updates.tracksProduction;
    if (updates.productionField !== undefined) payload.campo_produccion = updates.productionField;
    
    const { error } = await supabase.from('mant_subcentros').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteSubCenter = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').delete().eq('id', id);
    if (error) throw error;
};

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

export const createMachine = async (m: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(m);
    const payload = {
        centro_id: cleanUuid(m.costCenterId),
        subcentro_id: cleanUuid(m.subCenterId),
        nombre: m.name,
        codigo_empresa: m.companyCode,
        horas_actuales: m.currentHours,
        requiere_horas: m.requiresHours,
        gastos_admin: m.adminExpenses,
        gastos_transporte: m.transportExpenses,
        es_parte_trabajo: m.selectableForReports,
        responsable_id: cleanUuid(m.responsibleWorkerId),
        activo: m.active,
        vinculada_produccion: m.vinculadaProduccion
    };
    const { data, error } = await supabase.from('mant_maquinas').insert(payload).select().single();
    if (error) throw error;
    
    if (m.maintenanceDefs && m.maintenanceDefs.length > 0) {
        for (const def of m.maintenanceDefs) {
            await addMaintenanceDef({ ...def, machineId: data.id }, m.currentHours);
        }
    }
    
    return mapMachine(data);
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    const payload: any = {};
    if (updates.name !== undefined) payload.nombre = updates.name;
    if (updates.companyCode !== undefined) payload.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) payload.centro_id = cleanUuid(updates.costCenterId);
    if (updates.subCenterId !== undefined) payload.subcentro_id = cleanUuid(updates.subCenterId);
    if (updates.responsibleWorkerId !== undefined) payload.responsable_id = cleanUuid(updates.responsibleWorkerId);
    if (updates.currentHours !== undefined) payload.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) payload.requiere_horas = updates.requiresHours;
    if (updates.adminExpenses !== undefined) payload.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) payload.gastos_transporte = updates.transportExpenses;
    if (updates.selectableForReports !== undefined) payload.es_parte_trabajo = updates.selectableForReports;
    if (updates.active !== undefined) payload.activo = updates.active;
    if (updates.vinculadaProduccion !== undefined) payload.vinculada_produccion = updates.vinculadaProduccion;

    const { error } = await supabase.from('mant_maquinas').update(payload).eq('id', id);
    if (error) throw error;
};

export const deleteMachine = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMachine(id);
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

export const getMachineDependencyCount = async (id: string): Promise<{ logs: number, reports: number }> => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    const [logsRes, reportsRes] = await Promise.all([
        supabase.from('mant_registros').select('id', { count: 'exact', head: true }).eq('maquina_id', id),
        supabase.from('partes_trabajo').select('id', { count: 'exact', head: true }).eq('maquina_id', id)
    ]);
    return { 
        logs: logsRes.count || 0, 
        reports: reportsRes.count || 0 
    };
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    const payload = {
        maquina_id: cleanUuid(def.machineId),
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks,
        ultimas_horas_realizadas: def.lastMaintenanceHours || 0,
        pendiente: !!def.pending
    };
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert(payload).select().single();
    if (error) throw error;
    return mapDef(data);
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) return mock.updateMaintenanceDef(def);
    const payload = {
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null,
        tareas: def.tasks,
        ultimas_horas_realizadas: def.lastMaintenanceHours || 0,
        pendiente: !!def.pending
    };
    const { error } = await supabase.from('mant_mantenimientos_def').update(payload).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMaintenanceDef(defId);
    const { error } = await supabase.from('mant_mantenimientos_def').delete().eq('id', defId);
    if (error) throw error;
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    
    const trabajadorId = cleanUuid(log.workerId);
    const maquinaId = cleanUuid(log.machineId);

    if (!trabajadorId || !maquinaId) {
        throw new Error("ID de Trabajador o Máquina inválido. Cierra sesión y entra de nuevo.");
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

    const { data, error } = await supabase.from('mant_registros').insert(payload).select().single();

    if (error) {
        console.error("DEBUG - Payload enviado:", payload);
        console.error("DEBUG - Error de DB:", error);
        throw new Error(`Error de Base de Datos: ${error.message}. Verifica que el tipo de operación '${payload.tipo_operacion}' sea permitido.`);
    }

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
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) return [];
    return (data || []).map(mapLogFromDb);
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data } = await supabase.from('mant_proveedores').select('*').order('nombre');
    return (data || []).map(p => ({ id: p.id, name: p.nombre }));
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

export const calculateAndSyncMachineStatus = async (m: Machine): Promise<Machine> => {
    if (!isConfigured) return m;
    const { data } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', m.id).single();
    return data ? mapMachine(data) : m;
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured || !isUuid(workerId)) return [];
    // No usamos centro_id aquí ya que el error dice que no existe la columna
    const { data } = await supabase.from('partes_trabajo').select('*, mant_maquinas(nombre)').eq('trabajador_id', workerId).order('fecha', { ascending: false }).limit(10);
    return (data || []).map(r => ({ 
        id: r.id, 
        date: new Date(r.fecha), 
        workerId: r.trabajador_id, 
        hours: Number(r.horas), 
        machineId: r.maquina_id, 
        machineName: r.mant_maquinas?.nombre 
    }));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    // Eliminado campo 'centro_id' por error schema cache (no existe en tabla)
    const { error } = await supabase.from('partes_trabajo').insert({ 
        fecha: toLocalDateString(report.date), 
        trabajador_id: cleanUuid(report.workerId), 
        horas: cleanNum(report.hours), 
        maquina_id: cleanUuid(report.machineId), 
        comentarios: report.description || null
    });
    if (error) throw error;
};

export const getSchemaInfo = async (tables: string[]): Promise<any[]> => {
    if (!isConfigured) return [];
    const results = [];
    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) results.push({ name: table, status: 'ERROR', message: error.message });
            else results.push({ name: table, status: 'FOUND', columns: data && data[0] ? Object.keys(data[0]) : [] });
        } catch (e) { results.push({ name: table, status: 'EXCEPTION', message: (e as Error).message }); }
    }
    return results;
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return null;
    const { data } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    return data ? { id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, crusherStart: data.machacadora_inicio, crusherEnd: data.machacadora_fin, millsStart: data.molinos_inicio, millsEnd: data.molinos_fin } : null;
};

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

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return null;
    const { data } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    return data ? { id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, washingStart: data.lavado_inicio, washingEnd: data.lavado_fin, triturationStart: data.trituracion_inicio, triturationEnd: data.trituracion_fin } : null;
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    // Corregido trituracion_end -> trituracion_fin por consistencia schema
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(report.date),
        trabajador_id: cleanUuid(report.workerId),
        lavado_inicio: cleanNum(report.washingStart),
        lavado_fin: cleanNum(report.washingEnd),
        trituracion_inicio: cleanNum(report.triturationStart),
        trituracion_fin: cleanNum(report.triturationEnd),
        comentarios: report.comments || null
    });
    if (error) throw error;
};

export const getCPReportsByRange = async (start: Date, end: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return [];
    const { data } = await supabase.from('cp_partes_diarios').select('*').gte('fecha', toLocalDateString(start)).lte('fecha', toLocalDateString(end));
    return (data || []).map(r => ({ id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, crusherStart: r.machacadora_inicio, crusherEnd: r.machacadora_fin, millsStart: r.molinos_inicio, millsEnd: r.molinos_fin, aiAnalysis: r.ai_analisis }));
};

export const updateCPReportAnalysis = async (id: string, a: string) => { await supabase.from('cp_partes_diarios').update({ ai_analisis: a }).eq('id', id); };

export const getCPWeeklyPlan = async (monday: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return null;
    const { data } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', monday).maybeSingle();
    return data ? { id: data.id, mondayDate: data.fecha_lunes, hoursMon: data.horas_lunes, hoursTue: data.horas_martes, hoursWed: data.horas_miercoles, hoursThu: data.horas_jueves, hoursFri: data.horas_viernes } : null;
};

export const saveCPWeeklyPlan = async (p: CPWeeklyPlan) => {
    if (!isConfigured) return;
    await supabase.from('cp_planificacion').upsert({ fecha_lunes: p.mondayDate, horas_lunes: p.hoursMon, horas_martes: p.hoursTue, horas_miercoles: p.hoursWed, horas_jueves: p.hoursThu, horas_viernes: p.hoursFri });
};

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[] }> => {
    if (!isConfigured) return { ops: [], personal: [] };
    const dateStr = toLocalDateString(date);
    const [ops, pers] = await Promise.all([
        supabase.from('mant_registros').select('*').eq('fecha', dateStr),
        supabase.from('partes_trabajo').select('*, mant_maquinas(nombre)').eq('fecha', dateStr)
    ]);
    return { ops: (ops.data || []).map(mapLogFromDb), personal: (pers.data || []).map(r => ({ id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, hours: Number(r.horas), machineId: r.maquina_id, machineName: r.mant_maquinas?.nombre })) };
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
