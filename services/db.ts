
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan } from '../types';

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
    warningHours: d.horas_preaviso, // Corregido según esquema SQL
    // Mapeo directo de columnas de estado de la BD
    pending: d.pendiente ?? false,
    remainingHours: d.horas_restantes ?? 0,
    lastMaintenanceHours: d.ultimas_horas_realizadas ?? null
});

const mapMachine = (m: any): Machine => ({
    id: m.id,
    // Intentar leer ambos posibles nombres de columna para ID de centro
    costCenterId: m.centro_id || m.centro_coste_id,
    name: m.nombre,
    companyCode: m.codigo_empresa,
    currentHours: m.horas_actuales,
    // Intentar leer ambos posibles nombres para control de horas
    requiresHours: m.requiere_control_horas ?? m.control_horas ?? false,
    adminExpenses: m.gastos_admin,
    transportExpenses: m.gastos_transporte,
    // Relación cargada manualmente o por join
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

// --- SERVICES ---

export const getWorkers = async (): Promise<Worker[]> => {
    if (!isConfigured) {
        console.log("DB: Usando MOCK para Trabajadores");
        return mock.getWorkers();
    }
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) { 
        console.error("DB Error getWorkers:", error); 
        return []; 
    }
    return data ? data.map(mapWorker) : [];
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

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    
    // 1. Intentar obtener máquinas (Probamos primero 'centro_id')
    let query = supabase.from('mant_maquinas').select('*').eq('centro_id', centerId);
    let { data: machines, error } = await query;

    // Si falla, probamos con 'centro_coste_id' por si acaso
    if (error) {
        const retry = await supabase.from('mant_maquinas').select('*').eq('centro_coste_id', centerId);
        machines = retry.data;
        error = retry.error;
    }

    if (error || !machines) {
        console.error("Error getMachinesByCenter:", error);
        return [];
    }

    // 2. Obtener definiciones de mantenimiento manualmente
    const machineIds = machines.map((m: any) => m.id);
    let defs: any[] = [];
    
    if (machineIds.length > 0) {
        const { data: dData, error: dError } = await supabase
            .from('mant_mantenimientos_def')
            .select('*')
            .in('maquina_id', machineIds);
        
        if (!dError && dData) {
            defs = dData;
        } else {
            console.error("Error fetching definitions:", dError);
        }
    }

    // 3. Combinar
    return machines.map((m: any) => {
        const myDefs = defs.filter(d => d.maquina_id === m.id);
        return mapMachine({ ...m, mant_mantenimientos_def: myDefs });
    });
};

export const getAllMachines = async (): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    
    // Fetch machines
    const { data: machines, error } = await supabase.from('mant_maquinas').select('*');
    if (error) { console.error("getAllMachines", error); return []; }

    // Fetch defs
    const { data: defs } = await supabase.from('mant_mantenimientos_def').select('*');
    
    return machines.map((m: any) => {
        const myDefs = defs ? defs.filter((d: any) => d.maquina_id === m.id) : [];
        return mapMachine({ ...m, mant_mantenimientos_def: myDefs });
    });
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    
    // Intentamos insertar usando 'centro_id' y 'requiere_control_horas' por defecto
    const machinePayload: any = {
        centro_id: machine.costCenterId, 
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        horas_actuales: machine.currentHours,
        requiere_control_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses
    };

    let { data: mData, error: mError } = await supabase.from('mant_maquinas').insert(machinePayload).select().single();

    // Fallback 1: Si falla 'requiere_control_horas', probamos 'control_horas'
    if (mError && mError.message?.includes('requiere_control_horas')) {
        console.warn("Retrying create with control_horas");
        delete machinePayload.requiere_control_horas;
        machinePayload.control_horas = machine.requiresHours;
        const retry = await supabase.from('mant_maquinas').insert(machinePayload).select().single();
        mData = retry.data;
        mError = retry.error;
    }

    // Fallback 2: Si falla 'centro_id', probamos 'centro_coste_id'
    if (mError && mError.message?.includes('centro_id')) {
         console.warn("Retrying create with centro_coste_id");
         delete machinePayload.centro_id;
         machinePayload.centro_coste_id = machine.costCenterId;
         const retry = await supabase.from('mant_maquinas').insert(machinePayload).select().single();
         mData = retry.data;
         mError = retry.error;
    }

    if (mError || !mData) throw mError;

    // 2. Insert Defs
    if (machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: mData.id,
            nombre: d.name,
            intervalo_horas: d.intervalHours,
            tareas: d.tasks,
            horas_preaviso: d.warningHours // Corregido: horas_preaviso
        }));
        const { error: dError } = await supabase.from('mant_mantenimientos_def').insert(defsToInsert);
        if (dError) console.error("Error creating defs", dError);
    }

    return { ...machine, id: mData.id };
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    
    // Función auxiliar para intentar actualizar y devolver error si falla
    const tryUpdate = async (payload: any) => {
        const { error } = await supabase.from('mant_maquinas').update(payload).eq('id', id);
        return error;
    }

    // Payload base con campos seguros
    const basePayload: any = {};
    if (updates.name !== undefined) basePayload.nombre = updates.name;
    if (updates.companyCode !== undefined) basePayload.codigo_empresa = updates.companyCode;
    if (updates.currentHours !== undefined) basePayload.horas_actuales = updates.currentHours;
    if (updates.adminExpenses !== undefined) basePayload.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) basePayload.gastos_transporte = updates.transportExpenses;

    // Construir primer intento con nombres de columnas estándar
    let payload = { ...basePayload };
    if (updates.costCenterId !== undefined) payload.centro_id = updates.costCenterId;
    if (updates.requiresHours !== undefined) payload.requiere_control_horas = updates.requiresHours;

    // Intento 1
    let error = await tryUpdate(payload);

    if (!error) return; // Éxito

    // --- LÓGICA DE RECUPERACIÓN (Fallback) ---
    const msg = error.message || '';
    console.warn(`Update attempt failed: ${msg}. Retrying...`);

    // Problema 1: 'requiere_control_horas' no existe
    if (msg.includes('requiere_control_horas')) {
        delete payload.requiere_control_horas;
        // Probar nombre alternativo
        if (updates.requiresHours !== undefined) payload.control_horas = updates.requiresHours;
        
        error = await tryUpdate(payload);
        if (!error) return;

        // Si también falla, quitamos el campo para salvar al menos los otros datos
        if (error.message?.includes('control_horas')) {
            console.warn("Skipping control_horas field update");
            delete payload.control_horas;
            error = await tryUpdate(payload);
            if (!error) return;
        }
    }

    // Problema 2: 'centro_id' no existe
    if (error && error.message?.includes('centro_id')) {
        delete payload.centro_id;
        if (updates.costCenterId !== undefined) payload.centro_coste_id = updates.costCenterId;
        error = await tryUpdate(payload);
    }

    if (error) {
        console.error("Final update failure", error);
        throw error;
    }
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        horas_preaviso: def.warningHours // Corregido
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
        horas_preaviso: def.warningHours // Corregido
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
    if (error) { console.error("getServiceProviders", error); return []; }
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

// --- WRAPPED SAVE FUNCTIONS FOR OFFLINE SUPPORT ---

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);

    // 1. Check offline status or optimistic queueing
    if (!navigator.onLine) {
        offline.addToQueue('LOG', log);
        // Return a fake log so the UI continues
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

        // Update machine hours if greater
        const { data: mData } = await supabase.from('mant_maquinas').select('horas_actuales').eq('id', log.machineId).single();
        if (mData && log.hoursAtExecution > mData.horas_actuales) {
            await supabase.from('mant_maquinas').update({ horas_actuales: log.hoursAtExecution }).eq('id', log.machineId);
        }

        return mapLogFromDb(data);
    } catch (error) {
        console.warn("Error saving log, adding to offline queue", error);
        offline.addToQueue('LOG', log);
        return { ...log, id: 'OFFLINE_ERR_' + Date.now() };
    }
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    // Nota: Si la BD ya tiene los cálculos, aquí podríamos simplificar y solo leer,
    // pero mantenemos la lógica local como fallback para offline o inmediatez UI.
    
    // Si la BD tiene valores cacheados, usarlos
    if (machine.maintenanceDefs.some(d => d.lastMaintenanceHours !== undefined)) {
         // Si los datos vinieron de DB (mapDef ya los leyó), devolvemos la máquina tal cual
         // (o podríamos refrescar si quisieramos recalcular en cliente)
         return machine; 
    }

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
        let query = supabase
            .from('mant_registros')
            .select('*')
            .eq('maquina_id', machineId);

        if (startDate) {
            query = query.gte('fecha', startDate.toISOString());
        }
        
        if (endDate) {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            query = query.lte('fecha', e.toISOString());
        }

        if (types && types.length > 0) {
            query = query.in('tipo_operacion', types);
        }

        const { data, error } = await query.order('fecha', { ascending: false });

        if (error) throw error;

        return data.map(mapLogFromDb);
    } catch (error) {
        console.error("Error fetching logs", error);
        return [];
    }
};

// --- CP REAL SERVICES ---

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    if (!navigator.onLine) return null; // Can't fetch if offline

    try {
        const { data, error } = await supabase
            .from('cp_partes_diarios')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(1)
            .single();
        
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
    } catch (e) {
        return null;
    }
};

export const getCPReportsByRange = async (startDate: Date, endDate: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) {
         return mock.getCPReportsByRange(startDate, endDate);
    }
    if (!navigator.onLine) return [];

    try {
        const toUtcMidnightISO = (d: Date) => {
            const year = d.getFullYear();
            const month = d.getMonth();
            const day = d.getDate();
            return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
        };

        const toUtcEndISO = (d: Date) => {
            const year = d.getFullYear();
            const month = d.getMonth();
            const day = d.getDate();
            return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
        };

        const startIso = toUtcMidnightISO(startDate);
        const endIso = toUtcEndISO(endDate);
        
        console.log(`🔎 Query Supabase: ${startIso} -> ${endIso}`);

        const { data, error } = await supabase
            .from('cp_partes_diarios')
            .select('*')
            .gte('fecha', startIso)
            .lte('fecha', endIso)
            .order('fecha', { ascending: true });
        
        if (error) throw error;

        return data.map((d: any) => ({
            id: d.id,
            date: new Date(d.fecha),
            workerId: d.trabajador_id,
            crusherStart: d.machacadora_inicio,
            crusherEnd: d.machacadora_fin,
            millsStart: d.molinos_inicio,
            millsEnd: d.molinos_fin,
            comments: d.comentarios
        }));
    } catch (error) {
        console.error("Error fetching CP reports", error);
        return [];
    }
};

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCPReport(report);

    if (!navigator.onLine) {
        offline.addToQueue('CP_REPORT', report);
        return;
    }

    try {
        const { error } = await supabase
            .from('cp_partes_diarios')
            .insert({
                fecha: report.date.toISOString(),
                trabajador_id: report.workerId,
                machacadora_inicio: report.crusherStart,
                machacadora_fin: report.crusherEnd,
                molinos_inicio: report.millsStart,
                molinos_fin: report.millsEnd,
                comentarios: report.comments
            });
        
        if (error) throw error;
    } catch (e) {
         console.warn("Error saving CP Report, adding to queue", e);
         offline.addToQueue('CP_REPORT', report);
    }
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
    if (!navigator.onLine) return null;

    try {
        const { data, error } = await supabase
            .from('cp_planificacion')
            .select('*')
            .eq('fecha_lunes', mondayDate)
            .single();
        
        if (error || !data) return null;

        return {
            id: data.id,
            mondayDate: data.fecha_lunes,
            hoursMon: data.horas_lunes,
            hoursTue: data.horas_martes,
            hoursWed: data.horas_miercoles,
            hoursThu: data.horas_jueves,
            hoursFri: data.horas_viernes
        };
    } catch (e) {
        return null;
    }
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);
    
    if (!navigator.onLine) {
        offline.addToQueue('CP_PLAN', plan);
        return;
    }

    try {
        const { error } = await supabase
            .from('cp_planificacion')
            .upsert({
                fecha_lunes: plan.mondayDate,
                horas_lunes: plan.hoursMon,
                horas_martes: plan.hoursTue,
                horas_miercoles: plan.hoursWed,
                horas_jueves: plan.hoursThu,
                horas_viernes: plan.hoursFri
            }, { onConflict: 'fecha_lunes' });
        
        if (error) throw error;
    } catch (e) {
        console.warn("Error saving Plan, adding to queue", e);
        offline.addToQueue('CP_PLAN', plan);
    }
};

// --- SYNC MANAGER ---

export const syncPendingData = async (): Promise<{ synced: number, errors: number }> => {
    if (!isConfigured) return { synced: 0, errors: 0 };
    if (!navigator.onLine) return { synced: 0, errors: 0 };

    const queue = offline.getQueue();
    let synced = 0;
    let errors = 0;

    console.log(`[Sync] Iniciando sincronización de ${queue.length} elementos...`);

    for (const item of queue) {
        try {
            if (item.type === 'LOG') {
                const log = item.payload;
                const dbLog = {
                    fecha: log.date, 
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
                 const { error } = await supabase.from('mant_registros').insert(dbLog);
                 if (error) throw error;
                 
                 const { data: mData } = await supabase.from('mant_maquinas').select('horas_actuales').eq('id', log.machineId).single();
                 if (mData && log.hoursAtExecution > mData.horas_actuales) {
                    await supabase.from('mant_maquinas').update({ horas_actuales: log.hoursAtExecution }).eq('id', log.machineId);
                 }

            } else if (item.type === 'CP_REPORT') {
                const report = item.payload;
                const { error } = await supabase.from('cp_partes_diarios').insert({
                    fecha: report.date,
                    trabajador_id: report.workerId,
                    machacadora_inicio: report.crusherStart,
                    machacadora_fin: report.crusherEnd,
                    molinos_inicio: report.millsStart,
                    molinos_fin: report.millsEnd,
                    comentarios: report.comments
                });
                if (error) throw error;

            } else if (item.type === 'CP_PLAN') {
                const plan = item.payload;
                 const { error } = await supabase.from('cp_planificacion').upsert({
                    fecha_lunes: plan.mondayDate,
                    horas_lunes: plan.hoursMon,
                    horas_martes: plan.hoursTue,
                    horas_miercoles: plan.hoursWed,
                    horas_jueves: plan.hoursThu,
                    horas_viernes: plan.hoursFri
                }, { onConflict: 'fecha_lunes' });
                if (error) throw error;
            }

            offline.removeFromQueue(item.id);
            synced++;

        } catch (e) {
            console.error(`[Sync] Error syncing item ${item.id}`, e);
            errors++;
        }
    }

    return { synced, errors };
};
