
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport, CRDailyReport } from '../types';

// --- HELPERS ---

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isValidUUID = (id: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
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
    active: w.activo
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
        name: m.nombre,
        companyCode: m.codigo_empresa,
        currentHours: m.horas_actuales,
        requiresHours: m.requiere_horas, 
        adminExpenses: m.gastos_admin,
        transportExpenses: m.gastos_transporte,
        maintenanceDefs: defs ? defs.map(mapDef) : [],
        selectableForReports: m.es_parte_trabajo,
        responsibleWorkerId: m.responsable_id,
        active: m.activo !== undefined ? m.activo : true // Si no existe en DB, asumimos activo
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

// --- SERVICES ---

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    let query = supabase.from('mant_trabajadores').select('*');
    if (onlyActive) {
        // En trabajadores solemos tener la columna ya creada, pero filtramos en JS para ser 100% seguros
        const { data, error } = await query;
        if (error) return [];
        return data.map(mapWorker).filter(w => !onlyActive || w.active !== false);
    }
    const { data, error } = await query;
    if (error) { console.error("DB Error getWorkers:", error); return []; }
    return data ? data.map(mapWorker) : [];
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

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) { console.error("getCostCenters", error); return []; }
    return data.map((c: any) => ({ id: c.id, name: c.nombre }));
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

/**
 * Versión resiliente: Si la columna 'activo' no existe en DB, no fallará.
 */
export const getMachinesByCenter = async (centerId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    // IMPORTANTE: Eliminamos el .eq('activo', true) de la query para evitar el error 400 si la columna no existe.
    // En su lugar, filtramos en el cliente (mapMachine maneja la ausencia de valor).
    let query = supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
    
    const { data, error } = await query;
    if (error) { 
        console.error("getMachinesByCenter Error:", error); 
        return []; 
    }
    
    const all = data.map(mapMachine);
    return onlyActive ? all.filter(m => m.active !== false) : all;
};

/**
 * Versión resiliente para todos los activos.
 */
export const getAllMachines = async (onlyActive: boolean = false): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    let query = supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)');
    
    const { data, error } = await query;
    if (error) { 
        console.error("getAllMachines Error:", error); 
        return []; 
    }
    
    const all = data.map(mapMachine);
    return onlyActive ? all.filter(m => m.active !== false) : all;
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    const { data: mData, error: mError } = await supabase.from('mant_maquinas').insert({
        centro_id: machine.costCenterId,
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        horas_actuales: machine.currentHours,
        requiere_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses,
        es_parte_trabajo: machine.selectableForReports,
        responsable_id: machine.responsibleWorkerId,
        activo: machine.active ?? true
    }).select().single();
    if (mError) throw mError;
    if (machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: mData.id,
            nombre: d.name,
            tipo_programacion: d.maintenanceType,
            intervalo_horas: d.intervalHours,
            horas_preaviso: d.warningHours,
            intervalo_meses: d.intervalMonths,
            proxima_fecha: d.nextDate ? toLocalDateString(d.nextDate) : null,
            tareas: d.tasks,
            pendiente: false
        }));
        await supabase.from('mant_mantenimientos_def').insert(defsToInsert);
    }
    return { ...machine, id: mData.id };
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.companyCode !== undefined) dbUpdates.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) dbUpdates.centro_id = updates.costCenterId;
    if (updates.currentHours !== undefined) dbUpdates.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) dbUpdates.requiere_horas = updates.requiresHours;
    if (updates.adminExpenses !== undefined) dbUpdates.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) dbUpdates.gastos_transporte = updates.transportExpenses;
    if (updates.selectableForReports !== undefined) dbUpdates.es_parte_trabajo = updates.selectableForReports;
    if (updates.responsibleWorkerId !== undefined) dbUpdates.responsable_id = updates.responsibleWorkerId;
    if (updates.active !== undefined) dbUpdates.activo = updates.active;
    const { error } = await supabase.from('mant_maquinas').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const getMachineDependencyCount = async (id: string): Promise<{ logs: number, reports: number }> => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    try {
        const [logsRes, reportsRes] = await Promise.all([
            supabase.from('mant_registros').select('*', { count: 'exact', head: true }).eq('maquina_id', id),
            supabase.from('partes_trabajo').select('*', { count: 'exact', head: true }).eq('maquina_id', id)
        ]);
        return {
            logs: logsRes.count || 0,
            reports: reportsRes.count || 0
        };
    } catch (e) {
        return { logs: 0, reports: 0 };
    }
};

export const deleteMachine = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMachine(id);
    
    // Cascada manual para asegurar integridad total
    await Promise.all([
        supabase.from('mant_mantenimientos_def').delete().eq('maquina_id', id),
        supabase.from('mant_registros').delete().eq('maquina_id', id),
        supabase.from('partes_trabajo').delete().eq('maquina_id', id)
    ]);
    
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

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
        tareas: def.tasks,
        pendiente: false
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

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('mant_proveedores').select('*').order('nombre');
    if (error) { console.error("getServiceProviders", error); return []; }
    return data.map((p: any) => ({ id: p.id, name: p.nombre }));
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

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
    if (!isConfigured) return mock.getLastMaintenanceLog(machineId, defId);
    const { data, error } = await supabase.from('mant_registros').select('*').eq('maquina_id', machineId).eq('tipo_operacion', 'PROGRAMADO').order('horas_registro', { ascending: false }).limit(1).maybeSingle(); 
    if (error || !data) return undefined;
    return mapLogFromDb(data);
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);
    if (!navigator.onLine) {
        offline.addToQueue('LOG', log);
        return { ...log, id: 'OFFLINE_' + Date.now() };
    }
    try {
        const dbLog = {
            fecha: log.date.toISOString(),
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
            descripcion: log.description,
            materiales: log.materials,
            mantenimiento_def_id: log.maintenanceDefId,
            litros_combustible: log.fuelLitres
        };
        const { data, error } = await supabase.from('mant_registros').insert(dbLog).select().single();
        if (error) throw error;
        const { data: mData } = await supabase.from('mant_maquinas').select('horas_actuales').eq('id', log.machineId).single();
        if (mData && log.hoursAtExecution > mData.horas_actuales) {
            await supabase.from('mant_maquinas').update({ horas_actuales: log.hoursAtExecution }).eq('id', log.machineId);
        }
        if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
             const { data: defData } = await supabase.from('mant_mantenimientos_def').select('*').eq('id', log.maintenanceDefId).single();
             if (defData) {
                 const updates: any = { pendiente: false };
                 if (defData.tipo_programacion === 'HOURS') {
                    updates.ultimas_horas_realizadas = log.hoursAtExecution;
                 } else if (defData.tipo_programacion === 'DATE') {
                    updates.ultima_fecha = toLocalDateString(log.date);
                    if (defData.intervalo_meses) {
                        const next = new Date(log.date);
                        next.setMonth(next.getMonth() + defData.intervalo_meses);
                        updates.proxima_fecha = toLocalDateString(next);
                    }
                 }
                 await supabase.from('mant_mantenimientos_def').update(updates).eq('id', log.maintenanceDefId);
             }
        }
        return mapLogFromDb(data);
    } catch (error) {
        offline.addToQueue('LOG', log);
        return { ...log, id: 'OFFLINE_ERR_' + Date.now() };
    }
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    try {
        const updatedDefs = await Promise.all(machine.maintenanceDefs.map(async (def) => {
            if (def.maintenanceType === 'DATE') {
                if (!def.nextDate) return def;
                const today = new Date(); today.setHours(0,0,0,0);
                const target = new Date(def.nextDate); target.setHours(0,0,0,0);
                const isPending = today >= target;
                if (navigator.onLine) await supabase.from('mant_mantenimientos_def').update({ pendiente: isPending }).eq('id', def.id);
                return { ...def, pending: isPending };
            } 
            else {
                let lastHours = def.lastMaintenanceHours;
                if (lastHours === undefined || lastHours === null) {
                    const lastLog = await getLastMaintenanceLog(machine.id, def.id!);
                    lastHours = lastLog ? lastLog.hoursAtExecution : 0;
                }
                let remaining;
                if (lastHours && lastHours > 0) {
                    const nextDue = Number(lastHours) + Number(def.intervalHours);
                    remaining = nextDue - machine.currentHours;
                } else {
                    const hoursInCycle = machine.currentHours % def.intervalHours;
                    remaining = def.intervalHours - hoursInCycle;
                }
                const pending = remaining <= def.warningHours;
                if (navigator.onLine) await supabase.from('mant_mantenimientos_def').update({ horas_restantes: remaining, pendiente: pending }).eq('id', def.id);
                return { ...def, lastMaintenanceHours: lastHours, remainingHours: remaining, pending };
            }
        }));
        return { ...machine, maintenanceDefs: updatedDefs };
    } catch (e) { return machine; }
};

export const getMachineLogs = async (machineId: string, startDate?: Date, endDate?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return mock.getMachineLogs(machineId, startDate, endDate, types);
    try {
        let query = supabase.from('mant_registros').select('*').eq('maquina_id', machineId);
        if (startDate) query = query.gte('fecha', startDate.toISOString());
        if (endDate) {
            const e = new Date(endDate); e.setHours(23, 59, 59, 999);
            query = query.lte('fecha', e.toISOString());
        }
        if (types && types.length > 0) {
            const dbTypes = types.map(toDbOperationType);
            query = query.in('tipo_operacion', dbTypes);
        }
        const { data, error } = await query.order('fecha', { ascending: false });
        if (error) throw error;
        return data.map(mapLogFromDb);
    } catch (error) { console.error("Error fetching logs", error); return []; }
};

/**
 * Obtiene todos los registros relevantes para una auditoría diaria.
 */
export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[] }> => {
    if (!isConfigured) return mock.getDailyAuditLogs(date);
    
    const dateStr = date.toISOString().split('T')[0];
    const start = new Date(dateStr);
    start.setHours(0,0,0,0);
    const end = new Date(dateStr);
    end.setHours(23,59,59,999);

    try {
        const [opsRes, personalRes] = await Promise.all([
            supabase.from('mant_registros').select('*').gte('fecha', start.toISOString()).lte('fecha', end.toISOString()),
            supabase.from('partes_trabajo').select(`*, maquina:mant_maquinas(nombre, centro_id)`).gte('fecha', dateStr).lte('fecha', dateStr)
        ]);

        if (opsRes.error) throw opsRes.error;
        if (personalRes.error) throw personalRes.error;

        return {
            ops: opsRes.data.map(mapLogFromDb),
            personal: personalRes.data.map((d: any) => ({
                id: d.id,
                date: new Date(d.fecha),
                workerId: d.trabajador_id,
                hours: d.hours,
                machineId: d.maquina_id,
                machineName: d.maquina?.nombre,
                description: d.comentarios,
                costCenterId: d.maquina?.centro_id
            }))
        };
    } catch (e) {
        console.error("Error en auditoría diaria:", e);
        return { ops: [], personal: [] };
    }
}

// --- CANTERA PURA REPORTS ---
export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    if (!navigator.onLine) return null;
    try {
        const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1);
        if (error) return null;
        const report = data && data.length > 0 ? data[0] : null;
        if (!report) return null;
        return { id: report.id, date: new Date(report.fecha), workerId: report.trabajador_id, crusherStart: report.machacadora_inicio, crusherEnd: report.machacadora_fin, millsStart: report.molinos_inicio, millsEnd: report.molinos_fin, comments: report.comentarios, aiAnalysis: report.ai_analisis };
    } catch (e) { return null; }
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCPReport(report);
    if (!navigator.onLine) { offline.addToQueue('CP_REPORT', report); return; }
    try {
        const dateStr = toLocalDateString(report.date);
        // Cast supabase.from() call to any to bypass incorrect type inference
        const { error } = await (supabase.from('cp_partes_diarios') as any).insert({ 
            fecha: dateStr, 
            trabajador_id: report.workerId, 
            machacadora_inicio: report.crusherStart, 
            machacadora_fin: report.crusherEnd, 
            molinos_inicio: report.millsStart, 
            molinos_fin: report.millsEnd, 
            comentarios: report.comments, 
            ai_analisis: report.aiAnalysis 
        });
        if (error) throw error;
    } catch (e) { offline.addToQueue('CP_REPORT', report); }
};

// --- CANTO RODADO REPORTS ---
export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return mock.getLastCRReport();
    if (!navigator.onLine) return null;
    try {
        const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1);
        if (error) return null;
        const report = data && data.length > 0 ? data[0] : null;
        if (!report) return null;
        return { 
            id: report.id, 
            date: new Date(report.fecha), 
            workerId: report.trabajador_id, 
            washingStart: Number(report.lavado_inicio), 
            washingEnd: Number(report.lavado_fin), 
            triturationStart: Number(report.trituration_inicio), 
            triturationEnd: Number(report.trituration_fin), 
            comments: report.comentarios, 
            aiAnalysis: report.ai_analisis 
        };
    } catch (e) { return null; }
};

export const saveCRReport = async (report: Omit<CRDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCRReport(report);
    if (!navigator.onLine) { offline.addToQueue('CR_REPORT', report); return; }
    try {
        const dateStr = toLocalDateString(report.date);
        // Cast supabase.from() call to any to bypass incorrect type inference
        const { error } = await (supabase.from('cr_partes_diarios') as any).insert({ 
            fecha: dateStr, 
            trabajador_id: report.workerId, 
            lavado_inicio: report.washingStart, 
            lavado_fin: report.washingEnd, 
            trituracion_inicio: report.triturationStart, 
            trituracion_fin: report.triturationEnd, 
            comentarios: report.comments, 
            ai_analisis: report.aiAnalysis 
        });
        if (error) throw error;
    } catch (e) { offline.addToQueue('CR_REPORT', report); }
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return mock.getCPReportsByRange(startDate, endDate);
    if (!navigator.onLine) return [];
    try {
        const startStr = toLocalDateString(startDate);
        const endStr = toLocalDateString(endDate);
        const { data, error } = await supabase.from('cp_partes_diarios').select('*').gte('fecha', startStr).lte('fecha', endStr).order('fecha', { ascending: true });
        if (error) throw error;
        return data.map((d: any) => ({ id: d.id, date: new Date(d.fecha), workerId: d.trabajador_id, crusherStart: d.machacadora_inicio, crusherEnd: d.machacadora_fin, millsStart: d.molinos_inicio, millsEnd: d.molinos_fin, comments: d.comentarios, aiAnalysis: d.ai_analisis }));
    } catch (error) { console.error("Error fetching CP reports", error); return []; }
};

export const updateCPReportAnalysis = async (id: string, analysis: string): Promise<void> => {
    if (!isConfigured) return mock.updateCPReportAnalysis(id, analysis);
    if (!navigator.onLine) return; 
    if (!isValidUUID(id)) return;
    const { error } = await supabase.from('cp_partes_diarios').update({ ai_analisis: analysis }).eq('id', id);
    if (error) throw error;
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
    if (!navigator.onLine) return null;
    try {
        const { data, error } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', mondayDate).limit(1);
        if (error) return null;
        const plan = data && data.length > 0 ? data[0] : null;
        if (!plan) return null;
        return { id: plan.id, mondayDate: plan.fecha_lunes, hoursMon: plan.horas_lunes, hoursTue: plan.horas_martes, hoursWed: plan.horas_miercoles, hoursThu: plan.horas_jueves, hoursFri: plan.horas_viernes };
    } catch (e) { return null; }
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);
    if (!navigator.onLine) { offline.addToQueue('CP_PLAN', plan); return; }
    try {
        const { error } = await supabase.from('cp_planificacion').upsert({ fecha_lunes: plan.mondayDate, horas_lunes: plan.hoursMon, horas_martes: plan.hoursTue, horas_miercoles: plan.hoursWed, horas_jueves: plan.hoursThu, horas_viernes: plan.hoursFri }, { onConflict: 'fecha_lunes' });
        if (error) throw error;
    } catch (e) { offline.addToQueue('CP_PLAN', plan); }
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured) return mock.getPersonalReports(workerId);
    const { data, error } = await supabase.from('partes_trabajo').select(`*, maquina:mant_maquinas(nombre, centro_id)`).eq('trabajador_id', workerId).order('fecha', { ascending: false }).limit(5);
    if (error) return [];
    return data.map((d: any) => ({ id: d.id, date: new Date(d.fecha), workerId: d.trabajador_id, hours: d.horas, machineId: d.maquina_id, machineName: d.maquina?.nombre, description: d.comentarios, costCenterId: d.maquina?.centro_id }));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.savePersonalReport(report);
    if (!navigator.onLine) { offline.addToQueue('PERSONAL_REPORT', report); return; }
    try {
        const dateStr = toLocalDateString(report.date);
        const { error } = await supabase.from('partes_trabajo').insert({ fecha: dateStr, trabajador_id: report.workerId, hours: report.hours, maquina_id: report.machineId, comentarios: report.description });
        if (error) throw error;
    } catch (e) { throw e; }
};

export const syncPendingData = async (): Promise<{ synced: number, errors: number }> => {
    if (!isConfigured) return { synced: 0, errors: 0 };
    if (!navigator.onLine) return { synced: 0, errors: 0 };
    const queue = offline.getQueue();
    let synced = 0, errors = 0;
    for (const item of queue) {
        try {
            if (item.type === 'LOG') {
                const log = item.payload;
                const dbLog = { fecha: log.date, trabajador_id: log.workerId, maquina_id: log.machineId, horas_registro: log.hoursAtExecution, tipo_operacion: toDbOperationType(log.type), aceite_motor_l: log.motorOil, aceite_hidraulico_l: log.hydraulicOil, refrigerante_l: log.coolant, causa_averia: log.breakdownCause, solucion_averia: log.breakdownSolution, reparador_id: log.repairerId, tipo_mantenimiento: log.maintenanceType, descripcion: log.description, materiales: log.materials, mantenimiento_def_id: log.maintenanceDefId, litros_combustible: log.fuelLitres };
                 const { error } = await supabase.from('mant_registros').insert(dbLog);
                 if (error) throw error;
            } else if (item.type === 'CP_REPORT') {
                const report = item.payload;
                const dateStr = toLocalDateString(new Date(report.date));
                const { error } = await (supabase.from('cp_partes_diarios') as any).insert({ 
                    fecha: dateStr, 
                    trabajador_id: report.workerId, 
                    machacadora_inicio: report.crusherStart, 
                    machacadora_fin: report.crusherEnd, 
                    molinos_inicio: report.millsStart, 
                    molinos_fin: report.millsEnd, 
                    comentarios: report.comments, 
                    ai_analisis: report.aiAnalysis 
                });
                if (error) throw error;
            } else if (item.type === 'CR_REPORT') {
                const report = item.payload;
                const dateStr = toLocalDateString(new Date(report.date));
                const { error } = await (supabase.from('cr_partes_diarios') as any).insert({ 
                    fecha: dateStr, 
                    trabajador_id: report.workerId, 
                    lavado_inicio: report.washingStart, 
                    lavado_fin: report.washingEnd, 
                    trituracion_inicio: report.triturationStart, 
                    trituracion_fin: report.triturationEnd, 
                    comentarios: report.comments, 
                    ai_analisis: report.aiAnalysis 
                });
                if (error) throw error;
            } else if (item.type === 'CP_PLAN') {
                const plan = item.payload;
                 const { error } = await supabase.from('cp_planificacion').upsert({ fecha_lunes: plan.mondayDate, horas_lunes: plan.hoursMon, horas_martes: plan.hoursTue, horas_miercoles: plan.hoursWed, horas_jueves: plan.hoursThu, horas_viernes: plan.hoursFri }, { onConflict: 'fecha_lunes' });
                if (error) throw error;
            } else if (item.type === 'PERSONAL_REPORT') {
                const report = item.payload;
                const dateStr = toLocalDateString(new Date(report.date));
                const { error } = await supabase.from('partes_trabajo').insert({ fecha: dateStr, trabajador_id: report.workerId, hours: report.hours, maquina_id: report.machineId, comentarios: report.description });
                if (error) throw error;
            }
            offline.removeFromQueue(item.id);
            synced++;
        } catch (e) { errors++; }
    }
    return { synced, errors };
};
