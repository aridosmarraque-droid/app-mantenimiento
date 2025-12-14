
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, SubCenter, PersonalWorkReport } from '../types';

// --- MAPPERS ---

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre,
    dni: w.dni,
    phone: w.telefono,
    positionIds: w.posiciones || [],
    role: w.rol
});

const mapDef = (d: any): MaintenanceDefinition => ({
    id: d.id,
    machineId: d.maquina_id,
    name: d.nombre,
    intervalHours: d.intervalo_horas,
    tasks: d.tareas,
    warningHours: d.horas_preaviso, 
    pending: d.pendiente ?? false,
    remainingHours: d.horas_restantes ?? 0,
    lastMaintenanceHours: d.ultimas_horas_realizadas ?? null
});

const mapMachine = (m: any): Machine => ({
    id: m.id,
    costCenterId: m.centro_id || m.centro_coste_id,
    subCenterId: m.subcentro_id,
    name: m.nombre,
    companyCode: m.codigo_empresa,
    currentHours: m.horas_actuales,
    requiresHours: m.requiere_control_horas ?? m.control_horas ?? false,
    adminExpenses: m.gastos_admin,
    transportExpenses: m.gastos_transporte,
    isForWorkReport: m.es_parte_trabajo ?? false,
    maintenanceDefs: m.mant_mantenimientos_def ? m.mant_mantenimientos_def.map(mapDef) : []
});

const mapLogFromDb = (dbLog: any): OperationLog => ({
  id: dbLog.id,
  date: new Date(dbLog.fecha),
  workerId: dbLog.trabajador_id,
  machineId: dbLog.maquina_id,
  hoursAtExecution: Number(dbLog.horas_registro),
  type: dbLog.tipo_operacion,
  motorOil: dbLog.aceite_motor_l,
  hydraulicOil: dbLog.aceite_hidraulico_l,
  coolant: dbLog.refrigerante_l,
  breakdownCause: dbLog.causa_averia,
  breakdownSolution: dbLog.solucion_averia,
  repairerId: dbLog.reparador_id,
  maintenanceType: dbLog.tipo_mantenimiento,
  description: dbLog.descripcion,
  materials: dbLog.materiales,
  maintenanceDefId: dbLog.mantenimiento_def_id,
  fuelLitres: dbLog.litros_combustible
});

// --- HELPERS ---

// Convierte cadenas vacías a null para evitar errores 400 en columnas UUID/Int/Date
const sanitizeValue = (value: any) => {
    if (value === '') return null;
    if (value === undefined) return null;
    return value;
};

// --- SERVICES ---

export const getWorkers = async (): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers();
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) { console.error("DB Error getWorkers:", error); return []; }
    return data ? data.map(mapWorker) : [];
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) { console.error("getCostCenters", error); return []; }
    return data.map((c: any) => ({ 
        id: c.id, 
        name: c.nombre,
        code: c.codigo_interno 
    }));
};

export const getSubCenters = async (): Promise<SubCenter[]> => {
    if (!isConfigured) return mock.getSubCenters();
    const { data, error } = await supabase.from('mant_subcentros').select('*');
    if (error) { console.error("getSubCenters", error); return []; }
    return data.map((sc: any) => ({ id: sc.id, centerId: sc.centro_id, name: sc.nombre }));
}

export const createCostCenter = async (name: string, code?: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name, code);
    const { data, error } = await supabase.from('mant_centros').insert({ 
        nombre: name,
        codigo_interno: sanitizeValue(code) 
    }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.nombre, code: data.codigo_interno };
};

export const createSubCenter = async (centerId: string, name: string): Promise<SubCenter> => {
    if (!isConfigured) return mock.createSubCenter(centerId, name);
    const { data, error } = await supabase.from('mant_subcentros').insert({
        centro_id: centerId,
        nombre: name
    }).select().single();
    if (error) throw error;
    return { id: data.id, centerId: data.centro_id, name: data.nombre };
};

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    
    let query = supabase.from('mant_maquinas').select('*').eq('centro_id', centerId);
    let { data: machines, error } = await query;

    if (error) {
        const retry = await supabase.from('mant_maquinas').select('*').eq('centro_coste_id', centerId);
        machines = retry.data;
        error = retry.error;
    }

    if (error || !machines) {
        console.error("Error getMachinesByCenter:", error);
        return [];
    }

    const machineIds = machines.map((m: any) => m.id);
    let defs: any[] = [];
    
    if (machineIds.length > 0) {
        const { data: dData, error: dError } = await supabase
            .from('mant_mantenimientos_def')
            .select('*')
            .in('maquina_id', machineIds);
        if (!dError && dData) defs = dData;
    }

    return machines.map((m: any) => {
        const myDefs = defs.filter(d => d.maquina_id === m.id);
        return mapMachine({ ...m, mant_mantenimientos_def: myDefs });
    });
};

export const getAllMachines = async (): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    const { data: machines, error } = await supabase.from('mant_maquinas').select('*');
    if (error) { console.error("getAllMachines", error); return []; }

    const { data: defs } = await supabase.from('mant_mantenimientos_def').select('*');
    return machines.map((m: any) => {
        const myDefs = defs ? defs.filter((d: any) => d.maquina_id === m.id) : [];
        return mapMachine({ ...m, mant_mantenimientos_def: myDefs });
    });
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    
    // Convertir empty strings a null para evitar 400 Bad Request en UUIDs
    const machinePayload: any = {
        centro_id: sanitizeValue(machine.costCenterId), 
        subcentro_id: sanitizeValue(machine.subCenterId),
        nombre: machine.name,
        codigo_empresa: sanitizeValue(machine.companyCode),
        horas_actuales: machine.currentHours,
        requiere_control_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses,
        es_parte_trabajo: machine.isForWorkReport
    };

    let { data: mData, error: mError } = await supabase.from('mant_maquinas').insert(machinePayload).select().single();

    if (mError) {
        console.warn("Create machine error, trying recovery...", mError.message);
        // Fallback for older schema column names if needed
        if (mError.message?.includes('requiere_control_horas')) {
            delete machinePayload.requiere_control_horas;
            machinePayload.control_horas = machine.requiresHours;
        }
        if (mError.message?.includes('centro_id')) {
             delete machinePayload.centro_id;
             machinePayload.centro_coste_id = sanitizeValue(machine.costCenterId);
        }
        if (mError.message?.includes('es_parte_trabajo')) {
             delete machinePayload.es_parte_trabajo;
        }
        if (mError.message?.includes('subcentro_id')) {
             delete machinePayload.subcentro_id;
        }

        const retry = await supabase.from('mant_maquinas').insert(machinePayload).select().single();
        mData = retry.data;
        mError = retry.error;
    }

    if (mError || !mData) throw mError;

    if (machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: mData.id,
            nombre: d.name,
            intervalo_horas: d.intervalHours,
            tareas: d.tasks,
            horas_preaviso: d.warningHours
        }));
        await supabase.from('mant_mantenimientos_def').insert(defsToInsert);
    }

    return { ...machine, id: mData.id };
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    
    // --- BUILD PAYLOAD ---
    let payload: any = {};
    if (updates.name !== undefined) payload.nombre = updates.name;
    if (updates.companyCode !== undefined) payload.codigo_empresa = sanitizeValue(updates.companyCode);
    if (updates.currentHours !== undefined) payload.horas_actuales = updates.currentHours;
    if (updates.adminExpenses !== undefined) payload.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) payload.gastos_transporte = updates.transportExpenses;
    
    if (updates.isForWorkReport !== undefined) payload.es_parte_trabajo = updates.isForWorkReport;
    if (updates.subCenterId !== undefined) payload.subcentro_id = sanitizeValue(updates.subCenterId);
    if (updates.costCenterId !== undefined) payload.centro_id = sanitizeValue(updates.costCenterId);
    if (updates.requiresHours !== undefined) payload.requiere_control_horas = updates.requiresHours;

    console.log("🚀 [UpdateMachine] Payload inicial:", payload);

    const tryRequest = async (p: any) => {
        const { error } = await supabase.from('mant_maquinas').update(p).eq('id', id);
        return error;
    }

    let error = await tryRequest(payload);
    let attempts = 0;
    const maxAttempts = 5; // Allow enough attempts to fix multiple column issues one by one

    while (error && attempts < maxAttempts) {
        attempts++;
        console.warn(`⚠️ [UpdateMachine] Fallo intento ${attempts}:`, error.message);
        
        const msg = error.message ? error.message.toLowerCase() : '';
        let modified = false;

        // 1. Rename 'requiere_control_horas' -> 'control_horas'
        if (msg.includes('requiere_control_horas')) {
             delete payload.requiere_control_horas;
             if (updates.requiresHours !== undefined) payload.control_horas = updates.requiresHours;
             modified = true;
             console.log("🔄 Fix: Usando control_horas");
        }
        
        // 2. Rename 'centro_id' -> 'centro_coste_id' (Solo si el error lo pide)
        if (msg.includes('centro_id')) {
             delete payload.centro_id;
             if (updates.costCenterId !== undefined) payload.centro_coste_id = sanitizeValue(updates.costCenterId);
             modified = true;
             console.log("🔄 Fix: Usando centro_coste_id");
        }

        // 3. Remove 'es_parte_trabajo' if missing
        if (msg.includes('es_parte_trabajo')) {
            delete payload.es_parte_trabajo;
            modified = true;
            console.log("🔄 Fix: Eliminando es_parte_trabajo");
        }

        // 4. Remove 'subcentro_id' if missing
        if (msg.includes('subcentro_id')) {
            delete payload.subcentro_id;
            modified = true;
            console.log("🔄 Fix: Eliminando subcentro_id");
        }

        if (modified) {
            error = await tryRequest(payload);
        } else {
            console.error("No se pudo determinar una corrección automática para el error:", msg);
            // Fallback: If generic error and we haven't stripped optional new columns, try that.
            if (attempts === 1 && (payload.es_parte_trabajo !== undefined || payload.subcentro_id !== undefined)) {
                 console.log("🔄 Fallback: Eliminando columnas nuevas (es_parte_trabajo, subcentro_id) por si acaso.");
                 delete payload.es_parte_trabajo;
                 delete payload.subcentro_id;
                 error = await tryRequest(payload);
            } else {
                 break;
            }
        }
    }

    if (error) {
        console.error("❌ [UpdateMachine] Error fatal:", error);
        throw error;
    } else {
        console.log("✅ [UpdateMachine] Actualización exitosa");
    }
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        horas_preaviso: def.warningHours 
    }).select().single();
    if (error) throw error;
    return mapDef(data);
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) return mock.updateMaintenanceDef(def);
    const { error } = await supabase.from('mant_mantenimientos_def').update({
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        horas_preaviso: def.warningHours 
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
    const { data, error } = await supabase.from('mant_proveedores').select('*');
    if (error) return []; 
    return data.map((p: any) => ({ id: p.id, name: p.nombre }));
};

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
    if (!isConfigured) return mock.getLastMaintenanceLog(machineId, defId);
    const { data, error } = await supabase.from('mant_registros')
        .select('*')
        .eq('maquina_id', machineId)
        .eq('tipo_operacion', 'SCHEDULED')
        .eq('mantenimiento_def_id', defId)
        .order('horas_registro', { ascending: false })
        .limit(1)
        .single();
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
            tipo_operacion: log.type,
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
        return mapLogFromDb(data);
    } catch (error) {
        offline.addToQueue('LOG', log);
        return { ...log, id: 'OFFLINE_ERR_' + Date.now() };
    }
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    if (machine.maintenanceDefs.some(d => d.lastMaintenanceHours !== undefined)) return machine; 
    try {
        const updatedDefs = await Promise.all(machine.maintenanceDefs.map(async (def) => {
            const lastLog = await getLastMaintenanceLog(machine.id, def.id!);
            let remaining;
            if (lastLog) {
                const nextDue = Number(lastLog.hoursAtExecution) + Number(def.intervalHours);
                remaining = nextDue - machine.currentHours;
            } else {
                const hoursInCycle = machine.currentHours % def.intervalHours;
                remaining = def.intervalHours - hoursInCycle;
            }
            const pending = remaining <= def.warningHours;
            return {
                ...def,
                lastMaintenanceHours: lastLog ? lastLog.hoursAtExecution : undefined,
                remainingHours: remaining,
                pending
            };
        }));
        return { ...machine, maintenanceDefs: updatedDefs };
    } catch (e) {
        return machine;
    }
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
        if (types && types.length > 0) query = query.in('tipo_operacion', types);
        const { data, error } = await query.order('fecha', { ascending: false });
        if (error) throw error;
        return data.map(mapLogFromDb);
    } catch (error) {
        return [];
    }
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    if (!navigator.onLine) return null; 
    try {
        const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1).single();
        if (error || !data) return null;
        return {
            id: data.id, date: new Date(data.fecha), workerId: data.trabajador_id,
            crusherStart: data.machacadora_inicio, crusherEnd: data.machacadora_fin,
            millsStart: data.molinos_inicio, millsEnd: data.molinos_fin, comments: data.comentarios
        };
    } catch (e) { return null; }
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return mock.getCPReportsByRange(startDate, endDate);
    if (!navigator.onLine) return [];
    try {
         const { data } = await supabase.from('cp_partes_diarios').select('*'); 
         return data ? data.map((d: any) => ({
             id: d.id, date: new Date(d.fecha), workerId: d.trabajador_id,
             crusherStart: d.machacadora_inicio, crusherEnd: d.machacadora_fin,
             millsStart: d.molinos_inicio, millsEnd: d.molinos_fin, comments: d.comentarios
         })) : [];
    } catch { return []; }
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCPReport(report);
    if (!navigator.onLine) { offline.addToQueue('CP_REPORT', report); return; }
    await supabase.from('cp_partes_diarios').insert({
        fecha: report.date.toISOString(), trabajador_id: report.workerId,
        machacadora_inicio: report.crusherStart, machacadora_fin: report.crusherEnd,
        molinos_inicio: report.millsStart, molinos_fin: report.millsEnd, comentarios: report.comments
    });
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
     if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
     if (!navigator.onLine) return null;
     const { data } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', mondayDate).single();
     return data ? {
         id: data.id, mondayDate: data.fecha_lunes,
         hoursMon: data.horas_lunes, hoursTue: data.horas_martes, hoursWed: data.horas_miercoles,
         hoursThu: data.horas_jueves, hoursFri: data.horas_viernes
     } : null;
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);
    if (!navigator.onLine) { offline.addToQueue('CP_PLAN', plan); return; }
    await supabase.from('cp_planificacion').upsert({
        fecha_lunes: plan.mondayDate, horas_lunes: plan.hoursMon, horas_martes: plan.hoursTue,
        horas_miercoles: plan.hoursWed, horas_jueves: plan.hoursThu, horas_viernes: plan.hoursFri
    }, { onConflict: 'fecha_lunes' });
};

export const savePersonalWorkReport = async (report: Omit<PersonalWorkReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.savePersonalWorkReport(report);
    
    const { error } = await supabase.from('partes_trabajo').insert({
        fecha: report.date.toISOString(),
        trabajador_id: report.workerId,
        maquina_id: report.machineId,
        horas: report.hours,
        comentarios: report.comments
    });

    if (error) {
        console.error("Error saving personal report", error);
        alert("Error al guardar: Posiblemente falta la tabla 'partes_trabajo' en la BD.");
        throw error;
    }
};

export const syncPendingData = async (): Promise<{ synced: number, errors: number }> => {
    if (!isConfigured) return { synced: 0, errors: 0 };
    return { synced: 0, errors: 0 }; 
};
