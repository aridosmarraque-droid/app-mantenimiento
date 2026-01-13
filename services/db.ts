
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
    CRDailyReport 
} from '../types';

// --- HELPERS ---

const toLocalDateString = (date: Date): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
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
    notifiedWarning: !!d.notificado_preaviso,
    notifiedOverdue: !!d.notificado_vencido
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
        active: m.active !== undefined ? m.active : true,
        vinculadaProduccion: !!m.vinculada_produccion
    };
};

const mapLogFromDb = (dbLog: any): OperationLog => {
    // Si la fecha es null, se mantiene null para que new Date(null) muestre 1970 
    // y así el usuario sepa que el dato está corrupto en la DB en lugar de ver "Hoy".
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
        description: dbLog.descripcion, 
        materials: dbLog.materiales,
        maintenanceDefId: dbLog.mantenimiento_def_id,
        fuelLitres: dbLog.litros_combustible != null ? Number(dbLog.litros_combustible) : undefined
    };
};

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
        nombre: w.name,
        dni: w.dni,
        telefono: w.phone,
        rol: w.role,
        activo: w.active,
        horas_programadas: w.expectedHours,
        requiere_parte: w.requiresReport
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
        id: s.id,
        centerId: s.centro_id,
        name: s.nombre,
        tracksProduction: !!s.registra_produccion,
        productionField: s.campo_produccion
    }));
};

export const createSubCenter = async (s: Omit<SubCenter, 'id'>): Promise<SubCenter> => {
    const { data, error } = await supabase.from('mant_subcentros').insert({
        centro_id: s.centerId,
        nombre: s.name,
        registra_produccion: s.tracksProduction,
        campo_produccion: s.productionField
    }).select().single();
    if (error) throw error;
    return {
        id: data.id,
        centerId: data.centro_id,
        name: data.nombre,
        tracksProduction: data.registra_produccion,
        productionField: data.campo_produccion
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
        centro_id: m.costCenterId,
        subcentro_id: m.subCenterId,
        nombre: m.name,
        codigo_empresa: m.companyCode,
        horas_actuales: m.currentHours,
        requiere_horas: m.requiresHours,
        gastos_admin: m.adminExpenses,
        gastos_transporte: m.transportExpenses,
        es_parte_trabajo: m.selectableForReports,
        responsable_id: m.responsibleWorkerId,
        activo: m.active,
        vinculada_produccion: m.vinculadaProduccion
    }).select().single();
    
    if (error) throw error;

    if (m.maintenanceDefs && m.maintenanceDefs.length > 0) {
        const defs = m.maintenanceDefs.map(d => ({
            maquina_id: data.id,
            nombre: d.name,
            tipo_programacion: d.maintenanceType,
            intervalo_horas: d.intervalHours,
            horas_preaviso: d.warningHours,
            intervalo_meses: d.intervalMonths,
            proxima_fecha: d.nextDate ? toLocalDateString(d.nextDate) : null,
            tareas: d.tasks
        }));
        await supabase.from('mant_mantenimientos_def').insert(defs);
    }

    return mapMachine({ ...data, mant_mantenimientos_def: m.maintenanceDefs });
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

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    return machine;
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
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
    const { error } = await supabase.from('mant_mantenimientos_def').update({
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate ? toLocalDateString(new Date(def.nextDate)) : null,
        tareas: def.tasks,
        notificado_preaviso: def.notifiedWarning,
        notificado_vencido: def.notifiedOverdue
    }).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    const { error } = await supabase.from('mant_mantenimientos_def').delete().eq('id', defId);
    if (error) throw error;
};

export const getMachineDependencyCount = async (machineId: string): Promise<{ logs: number, reports: number }> => {
    const [logs, reports] = await Promise.all([
        supabase.from('mant_registros').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId),
        supabase.from('partes_trabajo').select('*', { count: 'exact', head: true }).eq('maquina_id', machineId)
    ]);
    return { logs: logs.count || 0, reports: reports.count || 0 };
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
 */
export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    
    const trabajadorId = cleanUuid(log.workerId);
    const maquinaId = cleanUuid(log.machineId);
    if (!trabajadorId || !maquinaId) throw new Error("IDs inválidos.");

    // PROTECCIÓN DE DUPLICIDAD
    const dateStr = toLocalDateString(log.date);
    const h = cleanNum(log.hoursAtExecution) || 0;
    
    const { data: existing } = await supabase
        .from('mant_registros')
        .select('id, fecha, horas_registro, tipo_operacion')
        .eq('maquina_id', maquinaId)
        .eq('fecha', dateStr)
        .eq('horas_registro', h)
        .eq('tipo_operacion', log.type)
        .limit(1);

    if (existing && existing.length > 0) {
        console.warn("[DB] Intento de duplicado detectado. Saltando inserción.", log);
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
    
    if (h > 0) {
        await supabase.from('mant_maquinas').update({ horas_actuales: h }).eq('id', maquinaId).lt('horas_actuales', h);
        if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
            await resetNotificationFlags(log.maintenanceDefId);
        } else {
            try {
                const { data: mData } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', maquinaId).single();
                if (mData) {
                    const machineObj = mapMachine(mData);
                    await checkMaintenanceThresholds(machineObj, h);
                }
            } catch (notifErr) {
                console.error("Error en motor de notificaciones:", notifErr);
            }
        }
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
        id: r.id, 
        date: new Date(r.fecha), 
        workerId: r.trabajador_id, 
        crusherStart: r.machacadora_inicio, 
        crusherEnd: r.machacadora_fin, 
        millsStart: r.molinos_inicio, 
        millsEnd: r.molinos_fin, 
        comments: r.comentarios 
    }));
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id,
        date: new Date(data.fecha),
        workerId: data.trabajador_id,
        crusherStart: data.machacadora_inicio,
        crusherEnd: data.machacadora_fin,
        millsStart: data.molinos_inicio,
        millsEnd: data.molinos_fin,
        comments: data.comentarios
    };
};

export const saveCPReport = async (r: Omit<CPDailyReport, 'id'>) => {
    const { error } = await supabase.from('cp_partes_diarios').insert({
        fecha: toLocalDateString(r.date),
        trabajador_id: r.workerId,
        machacadora_inicio: r.crusherStart,
        machacadora_fin: r.crusherEnd,
        molinos_inicio: r.millsStart,
        molinos_fin: r.millsEnd,
        comentarios: r.comments
    });
    if (error) throw error;
};

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id,
        date: new Date(data.fecha),
        workerId: data.trabajador_id,
        washingStart: data.lavado_inicio,
        washingEnd: data.lavado_fin,
        triturationStart: data.trituracion_inicio,
        triturationEnd: data.trituration_fin,
        comments: data.comentarios
    };
};

export const getCRReportsByRange = async (s: Date, e: Date): Promise<CRDailyReport[]> => {
    const { data } = await supabase.from('cr_partes_diarios').select('*').gte('fecha', toLocalDateString(s)).lte('fecha', toLocalDateString(e));
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        washingStart: r.lavado_inicio,
        washingEnd: r.lavado_fin,
        triturationStart: r.trituration_inicio,
        triturationEnd: r.trituration_fin,
        comments: r.comentarios
    }));
};

export const saveCRReport = async (r: Omit<CRDailyReport, 'id'>) => {
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(r.date),
        trabajador_id: r.workerId,
        lavado_inicio: r.washingStart,
        lavado_fin: r.washingEnd,
        triturationStart: r.triturationStart,
        triturationEnd: r.triturationEnd,
        comentarios: r.comments
    });
    if (error) throw error;
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    const { data, error } = await supabase.from('cp_planificacion_semanal').select('*').eq('fecha_lunes', mondayDate).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id,
        mondayDate: data.fecha_lunes,
        hoursMon: data.h_lunes,
        hoursTue: data.h_martes,
        hoursWed: data.h_miercoles,
        hoursThu: data.h_jueves,
        hoursFri: data.h_viernes
    };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    const p = {
        fecha_lunes: plan.mondayDate,
        h_lunes: plan.hoursMon,
        h_martes: plan.hoursTue,
        h_miercoles: plan.hoursWed,
        h_jueves: plan.hoursThu,
        h_viernes: plan.hoursFri
    };
    const { error } = await supabase.from('cp_planificacion_semanal').upsert(p, { onConflict: 'fecha_lunes' });
    if (error) throw error;
};

// --- MÓDULO PERSONAL ---

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    const { data } = await supabase.from('partes_trabajo').select('*, mant_maquinas(nombre), mant_centros(nombre)').eq('trabajador_id', workerId).order('fecha', { ascending: false }).limit(10);
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        hours: Number(r.horas || 0),
        machineId: r.maquina_id,
        machineName: r.mant_maquinas?.nombre,
        costCenterId: r.centro_id,
        costCenterName: r.mant_centros?.nombre,
        description: r.comentarios
    }));
};

export const savePersonalReport = async (r: Omit<PersonalReport, 'id'>) => {
    const { error } = await supabase.from('partes_trabajo').insert({
        fecha: toLocalDateString(r.date),
        trabajador_id: r.workerId,
        hours: r.hours,
        maquina_id: r.machineId,
        centro_id: r.costCenterId,
        comentarios: r.description
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
            console.error("Sync error for item:", item, e);
            errors++;
        }
    }
    return { synced, errors };
};
