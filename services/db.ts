
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan, PersonalReport } from '../types';

// --- MAPPERS (Traducción DB -> App) ---

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre,
    dni: w.dni,
    phone: w.telefono,
    // La tabla mant_trabajadores no parece tener una columna de array 'posiciones', 
    // pero existe mant_trabajadores_puestos. Por simplicidad y rendimiento, 
    // devolvemos array vacío o lo gestionamos si es crítico más adelante.
    positionIds: [], 
    role: w.rol
});

const mapDef = (d: any): MaintenanceDefinition => ({
    id: d.id,
    machineId: d.maquina_id,
    name: d.nombre,
    intervalHours: d.intervalo_horas,
    tasks: d.tareas,
    warningHours: d.horas_preaviso, // DB: horas_preaviso
    // La DB tiene columnas de estado, las usamos si existen
    pending: d.pendiente || false,
    remainingHours: d.horas_restantes !== undefined ? d.horas_restantes : 0,
    lastMaintenanceHours: d.ultimas_horas_realizadas
});

const mapMachine = (m: any): Machine => {
    // La relación en supabase suele devolver el nombre de la tabla relacionada
    const defs = m.mant_mantenimientos_def; 
    return {
        id: m.id,
        costCenterId: m.centro_id, // DB: centro_id
        name: m.nombre,
        companyCode: m.codigo_empresa,
        currentHours: m.horas_actuales,
        requiresHours: m.requiere_horas, // DB: requiere_horas
        adminExpenses: m.gastos_admin,
        transportExpenses: m.gastos_transporte,
        maintenanceDefs: defs ? defs.map(mapDef) : [],
        selectableForReports: m.es_parte_trabajo // DB: es_parte_trabajo
    };
};

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
    if (!isConfigured) return mock.getWorkers();
    
    // Tabla: mant_trabajadores
    const { data, error } = await supabase.from('mant_trabajadores').select('*').eq('activo', true);
    if (error) { 
        console.error("DB Error getWorkers:", error); 
        return []; 
    }
    return data ? data.map(mapWorker) : [];
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    
    // Tabla: mant_centros
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) { console.error("getCostCenters", error); return []; }
    return data.map((c: any) => ({ id: c.id, name: c.nombre }));
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name);
    
    const { data, error } = await supabase
        .from('mant_centros')
        .insert({ nombre: name })
        .select()
        .single();
        
    if (error) throw error;
    return { id: data.id, name: data.nombre };
};

export const deleteCostCenter = async (id: string): Promise<void> => {
    if (!isConfigured) return mock.deleteCostCenter(id);
    const { error } = await supabase.from('mant_centros').delete().eq('id', id);
    if (error) throw error;
};

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    
    // Tabla: mant_maquinas, Relación: mant_mantenimientos_def
    const { data, error } = await supabase
        .from('mant_maquinas')
        .select('*, mant_mantenimientos_def(*)')
        .eq('centro_id', centerId);
        
    if (error) { console.error("getMachinesByCenter", error); return []; }
    return data.map(mapMachine);
};

export const getAllMachines = async (): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    const { data, error } = await supabase
        .from('mant_maquinas')
        .select('*, mant_mantenimientos_def(*)');
    if (error) { console.error("getAllMachines", error); return []; }
    return data.map(mapMachine);
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    
    // 1. Insert Machine en mant_maquinas
    const { data: mData, error: mError } = await supabase.from('mant_maquinas').insert({
        centro_id: machine.costCenterId,
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        horas_actuales: machine.currentHours,
        requiere_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses,
        es_parte_trabajo: machine.selectableForReports
    }).select().single();

    if (mError) throw mError;

    // 2. Insert Defs en mant_mantenimientos_def
    if (machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: mData.id,
            nombre: d.name,
            intervalo_horas: d.intervalHours,
            tareas: d.tasks,
            horas_preaviso: d.warningHours,
            pendiente: false
        }));
        const { error: dError } = await supabase.from('mant_mantenimientos_def').insert(defsToInsert);
        if (dError) console.error("Error creating defs", dError);
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

    const { error } = await supabase.from('mant_maquinas').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    
    const { data, error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        horas_preaviso: def.warningHours,
        pendiente: false // Default
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
    // Tabla: mant_proveedores
    const { data, error } = await supabase.from('mant_proveedores').select('*');
    if (error) { console.error("getServiceProviders", error); return []; }
    return data.map((p: any) => ({ id: p.id, name: p.nombre }));
};

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
    if (!isConfigured) return mock.getLastMaintenanceLog(machineId, defId);
    
    // Tabla: mant_registros
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

        // Actualizar horas máquina
        const { data: mData } = await supabase.from('mant_maquinas').select('horas_actuales').eq('id', log.machineId).single();
        if (mData && log.hoursAtExecution > mData.horas_actuales) {
            await supabase.from('mant_maquinas').update({ horas_actuales: log.hoursAtExecution }).eq('id', log.machineId);
        }
        
        // Si es un mantenimiento programado, actualizar la definición (ultimas_horas_realizadas)
        if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
             await supabase.from('mant_mantenimientos_def')
                .update({ ultimas_horas_realizadas: log.hoursAtExecution, pendiente: false })
                .eq('id', log.maintenanceDefId);
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
    
    // Aunque la DB tiene campos calculados, hacemos el cálculo en cliente para la UI inmediata
    // y para asegurarnos de que el usuario ve el estado real basado en las horas actuales.
    // Opcionalmente podríamos actualizar la DB aquí si quisiéramos persistir el estado "pendiente".

    try {
        const updatedDefs = await Promise.all(machine.maintenanceDefs.map(async (def) => {
            // Usamos ultimas_horas_realizadas si viene de DB, o buscamos el log si no.
            let lastHours = def.lastMaintenanceHours;
            
            if (lastHours === undefined || lastHours === null) {
                // Fallback si no vino mapeado correctamente
                const lastLog = await getLastMaintenanceLog(machine.id, def.id!);
                lastHours = lastLog ? lastLog.hoursAtExecution : 0;
            }

            let remaining;
            if (lastHours && lastHours > 0) {
                const nextDue = Number(lastHours) + Number(def.intervalHours);
                remaining = nextDue - machine.currentHours;
            } else {
                // Nunca se ha hecho, basamos en intervalo cíclico puro desde 0
                const hoursInCycle = machine.currentHours % def.intervalHours;
                remaining = def.intervalHours - hoursInCycle;
            }

            const pending = remaining <= def.warningHours;
            
            // Si estamos online, actualizamos el estado en DB para otros usuarios
            if (navigator.onLine) {
                 await supabase.from('mant_mantenimientos_def').update({
                     horas_restantes: remaining,
                     pendiente: pending
                 }).eq('id', def.id);
            }

            return {
                ...def,
                lastMaintenanceHours: lastHours,
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
    if (!navigator.onLine) return null;

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
        const { data, error } = await supabase
            .from('cp_partes_diarios')
            .select('*')
            .gte('fecha', startDate.toISOString())
            .lte('fecha', endDate.toISOString())
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

// --- PERSONAL REPORT SERVICE ---

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured) return mock.getPersonalReports(workerId);
    
    // Tabla: partes_trabajo
    // Relaciones: maquina_id -> mant_maquinas(nombre), NO hay centro_coste_id en esta tabla
    const { data, error } = await supabase
        .from('partes_trabajo')
        .select(`
            *,
            maquina:mant_maquinas(nombre, centro_id)
        `)
        .eq('trabajador_id', workerId)
        .order('fecha', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching personal reports", error);
        return [];
    }
    
    return data.map((d: any) => ({
        id: d.id,
        date: new Date(d.fecha),
        workerId: d.trabajador_id,
        hours: d.horas,
        machineId: d.maquina_id,
        machineName: d.maquina?.nombre,
        description: d.comentarios, // Mapeamos comentarios a description
        // Tratamos de obtener el centro ID desde la máquina relacionada si es posible
        costCenterId: d.maquina?.centro_id
    }));
};

export const savePersonalReport = async (report: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.savePersonalReport(report);

    if (!navigator.onLine) {
        offline.addToQueue('PERSONAL_REPORT', report);
        return;
    }

    try {
        // Tabla partes_trabajo columnas: fecha, trabajador_id, maquina_id, horas, comentarios
        // NO tiene centro_coste_id
        const { error } = await supabase.from('partes_trabajo').insert({
            fecha: report.date.toISOString(),
            trabajador_id: report.workerId,
            horas: report.hours,
            maquina_id: report.machineId,
            comentarios: report.description // Mapeamos descripción a comentarios
        });

        if (error) {
            console.warn("Error guardando parte personal en DB:", error);
            throw error;
        }
    } catch (e) {
        console.warn("Excepción guardando parte personal", e);
        throw e;
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
                 
                  if (log.type === 'SCHEDULED' && log.maintenanceDefId) {
                        await supabase.from('mant_mantenimientos_def')
                            .update({ ultimas_horas_realizadas: log.hoursAtExecution, pendiente: false })
                            .eq('id', log.maintenanceDefId);
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
            
            } else if (item.type === 'PERSONAL_REPORT') {
                const report = item.payload;
                const { error } = await supabase.from('partes_trabajo').insert({
                    fecha: report.date,
                    trabajador_id: report.workerId,
                    horas: report.hours,
                    maquina_id: report.machineId,
                    comentarios: report.description
                });
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
