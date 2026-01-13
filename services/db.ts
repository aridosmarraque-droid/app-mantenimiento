
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { checkMaintenanceThresholds, resetNotificationFlags } from './notifications';
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
    CRDailyReport,
    WorkerDocument
} from '../types';

// --- HELPERS ---

const toLocalDateString = (date: Date): string => {
    if (!date || isNaN(date.getTime())) {
        throw new Error("Fecha inválida proporcionada al sistema.");
    }
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const cleanUuid = (id: any): string | null => {
    if (!id || typeof id !== 'string' || id === 'null' || id === 'undefined') return null;
    return id.trim().length > 0 ? id.trim() : null;
};

const cleanNum = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
};

// --- MAPPERS ---

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre || 'Sin nombre',
    dni: w.dni || '',
    phone: w.telefono || '',
    positionIds: [], 
    role: w.rol || 'worker',
    active: w.activo !== undefined ? w.activo : true,
    expectedHours: Number(w.horas_programadas || 0),
    requiresReport: w.requiere_parte !== undefined ? w.requiere_parte : true,
    lastMedicalExam: w.ultimo_reconocimiento ? new Date(w.ultimo_reconocimiento) : undefined,
    medicalAptitude: w.aptitud_medica
});

const mapLogFromDb = (dbLog: any): OperationLog => {
    const parsedDate = new Date(dbLog.fecha);
    return {
        id: dbLog.id,
        date: parsedDate,
        workerId: dbLog.trabajador_id,
        machineId: dbLog.maquina_id,
        hoursAtExecution: Number(dbLog.horas_registro || 0),
        type: dbLog.tipo_operacion as OperationType,
        motorOil: dbLog.aceite_motor_l != null ? Number(dbLog.aceite_motor_l) : undefined,
        hydraulicOil: dbLog.aceite_hidraulico_l != null ? Number(dbLog.aceite_hidraulico_l) : undefined,
        coolant: dbLog.refrigerante_l != null ? Number(dbLog.refrigerante_l) : undefined,
        breakdownCause: dbLog.causa_averia,
        breakdownSolution: dbLog.solucion_averia,
        repairerId: dbLog.reparador_id,
        maintenanceType: dbLog.tipo_mantenimiento,
        description: dbLog.description, 
        materials: dbLog.materiales,
        maintenanceDefId: dbLog.mantenimiento_def_id,
        fuelLitres: dbLog.litros_combustible != null ? Number(dbLog.litros_combustible) : undefined
    };
};

const mapMachine = (m: any): Machine => ({
    id: m.id,
    costCenterId: m.centro_id, 
    subCenterId: m.subcentro_id,
    name: m.nombre,
    companyCode: m.codigo_empresa,
    currentHours: Number(m.horas_actuales || 0),
    requiresHours: !!m.requiere_horas, 
    adminExpenses: !!m.gastos_admin,
    transportExpenses: !!m.gastos_transporte,
    maintenanceDefs: (m.mant_mantenimientos_def || []).map((d: any) => ({
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
        notifiedWarning: !!d.notificado_preaviso,
        notifiedOverdue: !!d.notificado_vencido
    })),
    selectableForReports: !!m.es_parte_trabajo,
    responsibleWorkerId: m.responsable_id,
    active: m.activo !== undefined ? m.activo : true,
    vinculadaProduccion: !!m.vinculada_produccion
});

// --- FUNCIONES CORE ---

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) return [];
    const workers = (data || []).map(mapWorker).sort((a, b) => a.name.localeCompare(b.name));
    return onlyActive ? workers.filter(w => w.active !== false) : workers;
};

export const createWorker = async (w: Omit<Worker, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_trabajadores').insert({
        nombre: w.name, dni: w.dni, telefono: w.phone, rol: w.role, activo: w.active,
        horas_programadas: w.expectedHours, requiere_parte: w.requiresReport
    });
    if (error) throw error;
};

export const updateWorker = async (id: string, updates: Partial<Worker>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.dni !== undefined) p.dni = updates.dni;
    if (updates.phone !== undefined) p.telefono = updates.phone;
    if (updates.role !== undefined) p.rol = updates.role;
    if (updates.active !== undefined) p.activo = updates.active;
    if (updates.expectedHours !== undefined) p.horas_programadas = updates.expectedHours;
    if (updates.requiresReport !== undefined) p.requiere_parte = updates.requiresReport;
    const { error } = await supabase.from('mant_trabajadores').update(p).eq('id', id);
    if (error) throw error;
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) return [];
    return (data || []).map((c: any) => ({ id: c.id, name: c.nombre }));
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    const { data, error } = await supabase.from('mant_centros').insert({ nombre: name }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.nombre };
};

export const updateCostCenter = async (id: string, name: string): Promise<void> => {
    const { error } = await supabase.from('mant_centros').update({ nombre: name }).eq('id', id);
    if (error) throw error;
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    const { error } = await supabase.from('mant_centros').delete().eq('id', id);
    if (error) throw error;
};

export const getSubCentersByCenter = async (centerId: string): Promise<SubCenter[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_subcentros').select('*').eq('centro_id', centerId);
    if (error) return [];
    return (data || []).map(s => ({
        id: s.id, centerId: s.centro_id, name: s.nombre, tracksProduction: !!s.registra_produccion,
        productionField: s.campo_produccion
    }));
};

export const createSubCenter = async (s: Omit<SubCenter, 'id'>): Promise<SubCenter> => {
    const { data, error } = await supabase.from('mant_subcentros').insert({
        centro_id: s.centerId, nombre: s.name, registra_produccion: s.tracksProduction, campo_produccion: s.productionField
    }).select().single();
    if (error) throw error;
    return {
        id: data.id, centerId: data.centro_id, name: data.nombre, tracksProduction: data.registra_produccion, productionField: data.campo_produccion
    };
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.tracksProduction !== undefined) p.registra_produccion = updates.tracksProduction;
    if (updates.productionField !== undefined) p.campo_produccion = updates.productionField;
    const { error } = await supabase.from('mant_subcentros').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteSubCenter = async (id: string): Promise<void> => {
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
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const getMachinesBySubCenter = async (subId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('subcentro_id', subId);
    if (error) return [];
    const machines = data.map(mapMachine);
    return onlyActive ? machines.filter(m => m.active !== false) : machines;
};

export const createMachine = async (m: Omit<Machine, 'id'>): Promise<Machine> => {
    const { data, error } = await supabase.from('mant_maquinas').insert({
        centro_id: m.costCenterId, subcentro_id: m.subCenterId, nombre: m.name, codigo_empresa: m.companyCode,
        horas_actuales: m.currentHours, requiere_horas: m.requiresHours, gastos_admin: m.adminExpenses,
        gastos_transporte: m.transportExpenses, es_parte_trabajo: m.selectableForReports, responsable_id: m.responsibleWorkerId,
        activo: m.active, vinculada_produccion: m.vinculadaProduccion
    }).select().single();
    if (error) throw error;
    return mapMachine(data);
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.companyCode !== undefined) p.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) p.centro_id = updates.costCenterId;
    if (updates.subCenterId !== undefined) p.subcentro_id = updates.subCenterId;
    if (updates.responsibleWorkerId !== undefined) p.responsable_id = updates.responsibleWorkerId;
    if (updates.currentHours !== undefined) p.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) p.requiere_horas = updates.requiresHours;
    if (updates.adminExpenses !== undefined) p.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) p.gastos_transporte = updates.transportExpenses;
    if (updates.selectableForReports !== undefined) p.es_parte_trabajo = updates.selectableForReports;
    if (updates.active !== undefined) p.activo = updates.active;
    if (updates.vinculadaProduccion !== undefined) p.vinculada_produccion = updates.vinculadaProduccion;
    const { error } = await supabase.from('mant_maquinas').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteMachine = async (id: string): Promise<void> => {
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId, nombre: def.name, tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours, horas_preaviso: def.warningHours, intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(def.nextDate) : null, tareas: def.tasks
    }).select().single();
    if (error) throw error;
    return data;
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    const { error } = await supabase.from('mant_mantenimientos_def').update({
        nombre: def.name, tipo_programacion: def.maintenanceType, intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours, intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(new Date(def.nextDate)) : null, tareas: def.tasks
    }).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    const { error } = await supabase.from('mant_mantenimientos_def').delete().eq('id', defId);
    if (error) throw error;
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('mant_proveedores').select('*');
    if (error) return [];
    return (data || []).map(p => ({ id: p.id, name: p.nombre, cif: p.cif, contactName: p.contacto, phone: p.telefono, email: p.email }));
};

export const createServiceProvider = async (name: string): Promise<void> => {
    const { error } = await supabase.from('mant_proveedores').insert({ nombre: name });
    if (error) throw error;
};

export const updateServiceProvider = async (id: string, name: string): Promise<void> => {
    const { error } = await supabase.from('mant_proveedores').update({ nombre: name }).eq('id', id);
    if (error) throw error;
};

export const deleteServiceProvider = async (id: string): Promise<void> => {
    const { error } = await supabase.from('mant_proveedores').delete().eq('id', id);
    if (error) throw error;
};

/**
 * GUARDA UN REGISTRO TÉCNICO
 * VALIDACIÓN ESTRICTA: Fecha no puede ser NULL para evitar el error de 1970.
 */
export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    
    // Validación de seguridad
    if (!log.date) throw new Error("Faltan datos críticos: Fecha obligatoria.");
    const dateStr = toLocalDateString(log.date);
    if (!dateStr || dateStr === '1970-01-01') throw new Error("Fecha del registro inválida.");

    const trabajadorId = cleanUuid(log.workerId);
    const maquinaId = cleanUuid(log.machineId);
    if (!trabajadorId || !maquinaId) throw new Error("IDs de trabajador o máquina inválidos.");

    // PROTECCIÓN DE DUPLICIDAD
    const h = cleanNum(log.hoursAtExecution) || 0;
    const { data: existing } = await supabase
        .from('mant_registros')
        .select('id')
        .eq('maquina_id', maquinaId)
        .eq('fecha', dateStr)
        .eq('horas_registro', h)
        .eq('tipo_operacion', log.type)
        .limit(1);

    if (existing && existing.length > 0) {
        console.warn("[DB] Duplicado detectado.");
        const { data: fullRecord } = await supabase.from('mant_registros').select('*').eq('id', existing[0].id).single();
        return mapLogFromDb(fullRecord);
    }

    const payload = {
        fecha: dateStr,
        trabajador_id: trabajadorId,
        maquina_id: maquinaId,
        horas_registro: h,
        tipo_operacion: log.type,
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
    if (error) throw error;
    
    // Sincronizar horas máquina
    if (h > 0) {
        await supabase.from('mant_maquinas').update({ horas_actuales: h }).eq('id', maquinaId).lt('horas_actuales', h);
    }
    
    return mapLogFromDb(data);
};

export const updateOperationLog = async (id: string, log: Partial<OperationLog>): Promise<void> => {
    const p: any = {};
    if (log.date) p.fecha = toLocalDateString(log.date);
    if (log.hoursAtExecution !== undefined) p.horas_registro = log.hoursAtExecution;
    if (log.motorOil !== undefined) p.aceite_motor_l = log.motorOil;
    if (log.hydraulicOil !== undefined) p.aceite_hidraulico_l = log.hydraulicOil;
    if (log.coolant !== undefined) p.refrigerante_l = log.coolant;
    if (log.breakdownCause !== undefined) p.causa_averia = log.breakdownCause;
    if (log.breakdownSolution !== undefined) p.solucion_averia = log.breakdownSolution;
    if (log.fuelLitres !== undefined) p.litros_combustible = log.fuelLitres;
    if (log.description !== undefined) p.descripcion = log.description;
    const { error } = await supabase.from('mant_registros').update(p).eq('id', id);
    if (error) throw error;
};

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('mant_registros').select('*').eq('maquina_id', machineId);
    if (startDate) query = query.gte('fecha', toLocalDateString(startDate));
    if (endDate) query = query.lte('fecha', toLocalDateString(endDate));
    if (types && types.length > 0) query = query.in('tipo_operacion', types);
    const { data, error } = await query.order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(mapLogFromDb);
};

export const getFuelLogs = async (machineId: string, startDate: Date, endDate: Date): Promise<OperationLog[]> => {
    return getMachineLogs(machineId, startDate, endDate, ['REFUELING']);
};

// --- MÓDULOS DE PRODUCCIÓN ---

export const getCPReportsByRange = async (s: Date, e: Date) => {
    const { data } = await supabase.from('cp_partes_diarios').select('*').gte('fecha', toLocalDateString(s)).lte('fecha', toLocalDateString(e));
    return (data || []).map(r => ({ 
        id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, 
        crusherStart: Number(r.machacadora_inicio || 0), 
        crusherEnd: Number(r.machacadora_fin || 0), 
        millsStart: Number(r.molinos_inicio || 0), 
        millsEnd: Number(r.molinos_fin || 0), 
        comments: r.comentarios 
    }));
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, 
        crusherStart: Number(data.machacadora_inicio || 0), 
        crusherEnd: Number(data.machacadora_fin || 0), 
        millsStart: Number(data.molinos_inicio || 0), 
        millsEnd: Number(data.molinos_fin || 0), 
        comments: data.comentarios
    };
};

export const saveCPReport = async (r: Omit<CPDailyReport, 'id'>) => {
    const { error } = await supabase.from('cp_partes_diarios').insert({
        fecha: toLocalDateString(r.date), trabajador_id: r.workerId, machacadora_inicio: r.crusherStart,
        machacadora_fin: r.crusherEnd, molinos_inicio: r.millsStart, molinos_fin: r.millsEnd, comentarios: r.comments
    });
    if (error) throw error;
};

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id, 
        washingStart: Number(data.lavado_inicio || 0),
        washingEnd: Number(data.lavado_fin || 0), 
        triturationStart: Number(data.trituration_inicio || 0), 
        triturationEnd: Number(data.trituration_fin || 0), 
        comments: data.comentarios
    };
};

export const getCRReportsByRange = async (s: Date, e: Date): Promise<CRDailyReport[]> => {
    const { data } = await supabase.from('cr_partes_diarios').select('*').gte('fecha', toLocalDateString(s)).lte('fecha', toLocalDateString(e));
    return (data || []).map(r => ({
        id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, 
        washingStart: Number(r.lavado_inicio || 0),
        washingEnd: Number(r.lavado_fin || 0), 
        triturationStart: Number(r.trituration_inicio || 0), 
        triturationEnd: Number(r.trituration_fin || 0), 
        comments: r.comentarios
    }));
};

export const saveCRReport = async (r: Omit<CRDailyReport, 'id'>) => {
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(r.date), 
        trabajador_id: r.workerId, 
        lavado_inicio: r.washingStart,
        lavado_fin: r.washingEnd, 
        trituration_inicio: r.triturationStart, 
        trituration_fin: r.triturationEnd, 
        comentarios: r.comments
    });
    if (error) throw error;
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    const { data, error } = await supabase.from('cp_planificacion_semanal').select('*').eq('fecha_lunes', mondayDate).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id, mondayDate: data.fecha_lunes, hoursMon: data.h_lunes, hoursTue: data.h_martes,
        hoursWed: data.h_miercoles, hoursThu: data.h_jueves, hoursFri: data.h_viernes
    };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    const p = {
        fecha_lunes: plan.mondayDate, h_lunes: plan.hoursMon, h_martes: plan.hoursTue,
        h_miercoles: plan.hoursWed, h_jueves: plan.hoursThu, h_viernes: plan.hoursFri
    };
    const { error } = await supabase.from('cp_planificacion_semanal').upsert(p, { onConflict: 'fecha_lunes' });
    if (error) throw error;
};

// --- MÓDULO PERSONAL ---

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    const { data } = await supabase.from('partes_trabajo').select('*, mant_maquinas(nombre), mant_centros(nombre)').eq('trabajador_id', workerId).order('fecha', { ascending: false }).limit(10);
    return (data || []).map(r => ({
        id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, hours: Number(r.horas || 0),
        machineId: r.maquina_id, machineName: r.mant_maquinas?.nombre, costCenterId: r.centro_id,
        costCenterName: r.mant_centros?.nombre, description: r.comentarios
    }));
};

export const savePersonalReport = async (r: Omit<PersonalReport, 'id'>) => {
    const { error } = await supabase.from('partes_trabajo').insert({
        fecha: toLocalDateString(r.date), trabajador_id: r.workerId, horas: r.hours,
        maquina_id: r.machineId, centro_id: r.costCenterId, comentarios: r.description
    });
    if (error) throw error;
};

export const updatePersonalReport = async (id: string, r: Partial<PersonalReport>): Promise<void> => {
    const p: any = {};
    if (r.date) p.fecha = toLocalDateString(r.date);
    if (r.hours !== undefined) p.horas = r.hours;
    if (r.machineId) p.maquina_id = r.machineId;
    if (r.costCenterId) p.centro_id = r.costCenterId;
    if (r.description !== undefined) p.comentarios = r.description;
    const { error } = await supabase.from('partes_trabajo').update(p).eq('id', id);
    if (error) throw error;
};

export const getDailyAuditLogs = async (date: Date) => {
    const dStr = toLocalDateString(date);
    const [ops, pers] = await Promise.all([
        supabase.from('mant_registros').select('*').eq('fecha', dStr),
        supabase.from('partes_trabajo').select('*, mant_maquinas(nombre), mant_centros(nombre)').eq('fecha', dStr)
    ]);
    return { 
        ops: (ops.data || []).map(mapLogFromDb),
        personal: (pers.data || []).map(r => ({ 
            id: r.id, date: new Date(r.fecha), workerId: r.trabajador_id, hours: Number(r.horas || 0), 
            machineId: r.maquina_id, machineName: r.mant_maquinas?.nombre,
            costCenterId: r.centro_id, costCenterName: r.mant_centros?.nombre, description: r.comentarios
        }))
    };
};

export const getSchemaInfo = async (tables: string[]): Promise<any[]> => {
    const results = [];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
        results.push({ name: table, status: error ? 'NOT_FOUND' : 'FOUND' });
    }
    return results;
};

export const getMachineDependencyCount = async (machineId: string): Promise<{ logs: number, reports: number }> => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    
    const [logsRes, reportsRes] = await Promise.all([
        supabase.from('mant_registros').select('id', { count: 'exact', head: true }).eq('maquina_id', machineId),
        supabase.from('partes_trabajo').select('id', { count: 'exact', head: true }).eq('maquina_id', machineId)
    ]);
    
    return {
        logs: logsRes.count || 0,
        reports: reportsRes.count || 0
    };
};

export const syncPendingData = async () => {
    const queue = offline.getQueue();
    let synced = 0;
    let errors = 0;
    for (const item of queue) {
        try {
            if (item.type === 'LOG') await saveOperationLog(item.payload);
            else if (item.type === 'CP_REPORT') await saveCPReport(item.payload);
            else if (item.type === 'CR_REPORT') await saveCRReport(item.payload);
            else if (item.type === 'CP_PLAN') await saveCPWeeklyPlan(item.payload);
            else if (item.type === 'PERSONAL_REPORT') await savePersonalReport(item.payload);
            offline.removeFromQueue(item.id);
            synced++;
        } catch (e) {
            console.error("Sync error:", item, e);
            errors++;
        }
    }
    return { synced, errors };
};

// --- MÓDULO DOCUMENTAL ---

/**
 * Obtiene los documentos registrados para un trabajador específico.
 */
export const getWorkerDocuments = async (workerId: string): Promise<WorkerDocument[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_documentos').select('*').eq('worker_id', workerId);
    if (error) {
        console.error("Error fetching worker documents:", error);
        return [];
    }
    return (data || []).map(d => ({
        id: d.id,
        workerId: d.worker_id,
        title: d.titulo,
        category: d.categoria,
        issueDate: new Date(d.fecha_emision),
        expiryDate: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : undefined,
        fileUrl: d.url_archivo,
        status: d.estado,
        docType: d.tipo_documento,
        notes: d.notas
    }));
};

/**
 * Guarda un nuevo documento para un trabajador.
 */
export const saveWorkerDocument = async (doc: Omit<WorkerDocument, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_documentos').insert({
        worker_id: doc.workerId,
        titulo: doc.title,
        categoria: doc.category,
        fecha_emision: toLocalDateString(doc.issueDate),
        fecha_vencimiento: doc.expiryDate ? toLocalDateString(doc.expiryDate) : null,
        url_archivo: doc.fileUrl,
        estado: doc.status,
        tipo_documento: doc.docType,
        notas: doc.notes
    });
    if (error) throw error;
};

export const calculateAndSyncMachineStatus = async (m: Machine): Promise<Machine> => m;
