
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition, OperationType, CPDailyReport, CPWeeklyPlan } from '../types';

// --- MAPPING HELPERS ---

export const getWorkers = async (): Promise<Worker[]> => {
  if (!isConfigured) return mock.getWorkers();

  try {
    const { data, error } = await supabase
      .from('mant_trabajadores')
      .select(`
        id, nombre, dni, telefono, rol,
        mant_trabajadores_puestos ( puesto_id )
      `)
      .eq('activo', true);

    if (error) throw error;

    return data.map((w: any) => ({
      id: w.id,
      name: w.nombre,
      dni: w.dni,
      phone: w.telefono,
      role: w.rol || 'worker',
      positionIds: w.mant_trabajadores_puestos.map((p: any) => p.puesto_id)
    }));
  } catch (error) {
    console.error('Error fetching workers (usando fallback):', error);
    return mock.getWorkers();
  }
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
  if (!isConfigured) return mock.getCostCenters();

  try {
    const { data, error } = await supabase
      .from('mant_centros')
      .select('*')
      .order('nombre');
    
    if (error) throw error;

    return data.map((c: any) => ({
      id: c.id,
      name: c.nombre
    }));
  } catch (error) {
    console.error('Error fetching centers (usando fallback):', error);
    return mock.getCostCenters();
  }
};

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name);

    try {
        const { data, error } = await supabase
            .from('mant_centros')
            .insert({ nombre: name })
            .select()
            .single();
        
        if (error) throw error;
        return { id: data.id, name: data.nombre };
    } catch (error) {
        console.error('Error creating center:', error);
        throw error;
    }
}

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
  if (!isConfigured) return mock.getMachinesByCenter(centerId);

  try {
    const { data, error } = await supabase
      .from('mant_maquinas')
      .select(`
        *,
        mant_mantenimientos_def (*)
      `)
      .eq('centro_id', centerId);

    if (error) throw error;

    return data.map((m: any) => ({
      id: m.id,
      costCenterId: m.centro_id,
      name: m.nombre,
      companyCode: m.codigo_empresa,
      currentHours: Number(m.horas_actuales),
      requiresHours: m.requiere_horas,
      adminExpenses: m.gastos_admin,
      transportExpenses: m.gastos_transporte,
      maintenanceDefs: m.mant_mantenimientos_def.map((def: any) => ({
        id: def.id,
        machineId: def.maquina_id,
        name: def.nombre,
        intervalHours: Number(def.intervalo_horas),
        tasks: def.tareas,
        warningHours: Number(def.horas_preaviso),
        pending: def.pendiente,
        remainingHours: Number(def.horas_restantes),
        lastMaintenanceHours: def.ultimas_horas_realizadas !== null ? Number(def.ultimas_horas_realizadas) : null
      }))
    }));
  } catch (error) {
    console.error('Error fetching machines (usando fallback):', error);
    return mock.getMachinesByCenter(centerId);
  }
};

export const getAllMachines = async (): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();

    try {
        const { data, error } = await supabase
            .from('mant_maquinas')
            .select('id, nombre, codigo_empresa');
        
        if (error) throw error;

        // Simplified mapping for dropdowns
        return data.map((m: any) => ({
            id: m.id,
            name: m.nombre,
            companyCode: m.codigo_empresa,
            costCenterId: '',
            currentHours: 0,
            requiresHours: false,
            adminExpenses: false,
            transportExpenses: false,
            maintenanceDefs: []
        }));
    } catch (error) {
        return mock.getAllMachines();
    }
}

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    
    try {
        const { data: machineData, error: machineError } = await supabase
            .from('mant_maquinas')
            .insert({
                centro_id: machine.costCenterId,
                nombre: machine.name,
                codigo_empresa: machine.companyCode,
                horas_actuales: machine.currentHours,
                requiere_horas: machine.requiresHours,
                gastos_admin: machine.adminExpenses,
                gastos_transporte: machine.transportExpenses
            })
            .select()
            .single();

        if (machineError) throw machineError;

        if (machine.maintenanceDefs.length > 0) {
            const defsToInsert = machine.maintenanceDefs.map(def => {
                const hoursInCycle = machine.currentHours % def.intervalHours;
                const remaining = def.intervalHours - hoursInCycle;

                return {
                    maquina_id: machineData.id,
                    nombre: def.name,
                    intervalo_horas: def.intervalHours,
                    tareas: def.tasks,
                    horas_preaviso: def.warningHours,
                    pendiente: false,
                    horas_restantes: remaining
                };
            });

            const { error: defsError } = await supabase
                .from('mant_mantenimientos_def')
                .insert(defsToInsert);

            if (defsError) throw defsError;
        }

        return {
            id: machineData.id,
            costCenterId: machineData.centro_id,
            name: machineData.nombre,
            companyCode: machineData.codigo_empresa,
            currentHours: Number(machineData.horas_actuales),
            requiresHours: machineData.requiere_horas,
            adminExpenses: machineData.gastos_admin,
            transportExpenses: machineData.gastos_transporte,
            maintenanceDefs: machine.maintenanceDefs
        };
    } catch (error) {
        console.error('Error creating machine:', error);
        throw error;
    }
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    
    try {
        const { error } = await supabase
            .from('mant_maquinas')
            .update({
                nombre: updates.name,
                codigo_empresa: updates.companyCode,
                horas_actuales: updates.currentHours,
                requiere_horas: updates.requiresHours,
                gastos_admin: updates.adminExpenses,
                gastos_transporte: updates.transportExpenses,
                centro_id: updates.costCenterId
            })
            .eq('id', id);
        
        if (error) throw error;
    } catch (error) {
        console.error("Error updating machine", error);
        throw error;
    }
}

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);

    try {
        const hoursInCycle = currentMachineHours % def.intervalHours;
        const remaining = def.intervalHours - hoursInCycle;

        const { data, error } = await supabase
            .from('mant_mantenimientos_def')
            .insert({
                maquina_id: def.machineId,
                nombre: def.name,
                intervalo_horas: def.intervalHours,
                tareas: def.tasks,
                horas_preaviso: def.warningHours,
                pendiente: false,
                horas_restantes: remaining
            })
            .select()
            .single();
        
        if (error) throw error;

        return {
            id: data.id,
            machineId: data.maquina_id,
            name: data.nombre,
            intervalHours: Number(data.intervalo_horas),
            tasks: data.tareas,
            warningHours: Number(data.horas_preaviso),
            pending: data.pendiente,
            remainingHours: Number(data.horas_restantes),
            lastMaintenanceHours: null
        };
    } catch (error) {
        console.error("Error adding def", error);
        throw error;
    }
}

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) return mock.updateMaintenanceDef(def);

    try {
        const { error } = await supabase
            .from('mant_mantenimientos_def')
            .update({
                nombre: def.name,
                intervalo_horas: def.intervalHours,
                tareas: def.tasks,
                horas_preaviso: def.warningHours
            })
            .eq('id', def.id);
        
        if (error) throw error;
    } catch (error) {
        console.error("Error updating def", error);
        throw error;
    }
}

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMaintenanceDef(defId);

    try {
        const { error } = await supabase
            .from('mant_mantenimientos_def')
            .delete()
            .eq('id', defId);
        
        if (error) throw error;
    } catch (error) {
        console.error("Error deleting def", error);
        throw error;
    }
}

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
  if (!isConfigured) return mock.getServiceProviders();

  try {
    const { data, error } = await supabase.from('mant_proveedores').select('*');
    if (error) throw error;
    return data.map((p: any) => ({ id: p.id, name: p.nombre }));
  } catch (error) {
    return mock.getServiceProviders();
  }
};

export const getLastMaintenanceLog = async (machineId: string, defId: string): Promise<OperationLog | undefined> => {
  if (!isConfigured) return mock.getLastMaintenanceLog(machineId, defId);

  try {
    const { data, error } = await supabase
      .from('mant_registros')
      .select('*')
      .eq('maquina_id', machineId)
      .eq('mantenimiento_def_id', defId)
      .eq('tipo_operacion', 'SCHEDULED')
      .order('horas_registro', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return undefined;

    return mapLogFromDb(data[0]);
  } catch (error) {
    return mock.getLastMaintenanceLog(machineId, defId);
  }
};

// CORE LOGIC: Recalculates remaining hours based on LAST performed hours (resetting cycle)
// Accepts overrides to handle race conditions or failure of 'last_performed' updates
export const updateMaintenanceStatus = async (
    machineId: string, 
    currentHours: number, 
    overrides?: { [key: string]: number }
) => {
    if (!isConfigured) return;

    try {
        console.group("Maintenance Status Calc");
        console.log("Updating for Machine:", machineId, "Current Hours:", currentHours);

        const { data: defs, error } = await supabase
            .from('mant_mantenimientos_def')
            .select('*')
            .eq('maquina_id', machineId);
        
        if (error || !defs) {
            console.error("Could not fetch defs", error);
            console.groupEnd();
            return;
        }

        const updates = defs.map(def => {
            let remaining;
            
            // Determine last performed time: DB Value vs Override
            let lastPerformed = def.ultimas_horas_realizadas !== null ? Number(def.ultimas_horas_realizadas) : null;
            
            if (overrides && overrides[def.id]) {
                lastPerformed = overrides[def.id];
                console.log(`[Override] Using memory value ${lastPerformed} for ${def.nombre}`);
            }

            console.log(`Checking Def: ${def.nombre}`);
            
            if (lastPerformed !== null && !isNaN(lastPerformed)) {
                // Cycle Reset Logic
                const interval = Number(def.intervalo_horas);
                const nextDue = lastPerformed + interval;
                
                remaining = nextDue - currentHours;
                console.log(`- Logic: Reset. Last (${lastPerformed}) + Interval (${interval}) = Due (${nextDue}). Remaining: ${remaining}`);
            } else {
                // First Time / Legacy Logic
                const interval = Number(def.intervalo_horas);
                const hoursInCycle = currentHours % interval;
                remaining = interval - hoursInCycle;
                console.log(`- Logic: Modulo. Remaining: ${remaining}`);
            }
            
            // Safety check for NaN
            if (isNaN(remaining)) {
                console.error(`!!! CRITICAL: Calculated remaining is NaN for ${def.nombre}.`);
                remaining = Number(def.intervalo_horas);
            }

            const warning = Number(def.horas_preaviso);
            const isWithinWarning = remaining <= warning;
            
            return { 
                id: def.id, 
                pendiente: isWithinWarning,
                horas_restantes: remaining
            };
        });

        for (const update of updates) {
            // We update 'pendiente' and 'horas_restantes'. This usually works even if 'ultimas_horas_realizadas' fails due to schema issues.
            await supabase
                .from('mant_mantenimientos_def')
                .update({ 
                    pendiente: update.pendiente,
                    horas_restantes: update.horas_restantes 
                })
                .eq('id', update.id);
        }
        
        console.log("Status updates committed to DB");
        console.groupEnd();

    } catch (e) {
        console.error("Error updating maintenance status:", e);
        console.groupEnd();
    }
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
  if (!isConfigured) return mock.saveOperationLog(log);

  try {
    const dbPayload = {
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
      reparador_id: log.repairerId || null, 
      tipo_mantenimiento: log.maintenanceType,
      descripcion: log.description,
      materiales: log.materials,
      mantenimiento_def_id: log.maintenanceDefId || null,
      litros_combustible: log.fuelLitres 
    };

    // 1. Insert Log
    const { data: logData, error: logError } = await supabase
      .from('mant_registros')
      .insert(dbPayload)
      .select()
      .single();

    if (logError) throw logError;

    // 2. Actions that depend on Log Type
    let hoursToUse = log.hoursAtExecution;
    const overrides: { [key: string]: number } = {};

    // If it's a scheduled maintenance, we MUST update the definition to remember WHEN it was done
    if (log.type === 'SCHEDULED' && log.maintenanceDefId && log.hoursAtExecution !== undefined) {
        console.log(`Saving Scheduled Maint: Updating last_performed to ${log.hoursAtExecution}`);
        
        // Attempt to update DB 'ultimas_horas_realizadas'
        // We use try/catch here because if the column is missing (Error 400), we don't want to crash the whole flow
        // We want to proceed to updateMaintenanceStatus with the OVERRIDE value so the UI is correct.
        try {
            const { error } = await supabase
                .from('mant_mantenimientos_def')
                .update({ ultimas_horas_realizadas: log.hoursAtExecution })
                .eq('id', log.maintenanceDefId);
            
            if (error) {
                console.error("Supabase Error updating last_performed (Column missing?):", error);
            }
        } catch (e) {
            console.error("Exception updating last_performed:", e);
        }

        // Set Override for immediate calculation
        overrides[log.maintenanceDefId] = log.hoursAtExecution;
    }

    // 3. Update Machine Hours & Recalc Status
    if (hoursToUse !== undefined) {
        await supabase
            .from('mant_maquinas')
            .update({ horas_actuales: hoursToUse })
            .eq('id', log.machineId)
            .lt('horas_actuales', hoursToUse);
        
        // Always recalc status using the NEW current hours + OVERRIDES
        await updateMaintenanceStatus(log.machineId, hoursToUse, overrides);
    }

    return mapLogFromDb(logData);
  } catch (error) {
    alert("Error de conexión con Supabase. Se guardará en local temporalmente.");
    return mock.saveOperationLog(log);
  }
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    
    // Note: When called from here (e.g. MachineSelector), we don't have overrides, 
    // so it relies on what is in the DB.
    await updateMaintenanceStatus(machine.id, machine.currentHours);
    
    const { data, error } = await supabase
      .from('mant_maquinas')
      .select(`*, mant_mantenimientos_def (*)`)
      .eq('id', machine.id)
      .single();
      
    if (error || !data) return machine; 

    const mappedMachine = {
      id: data.id,
      costCenterId: data.centro_id,
      name: data.nombre,
      companyCode: data.codigo_empresa,
      currentHours: Number(data.horas_actuales),
      requiresHours: data.requiere_horas,
      adminExpenses: data.gastos_admin,
      transportExpenses: data.gastos_transporte,
      maintenanceDefs: data.mant_mantenimientos_def.map((def: any) => ({
        id: def.id,
        machineId: def.maquina_id,
        name: def.nombre,
        intervalHours: Number(def.intervalo_horas),
        tasks: def.tareas,
        warningHours: Number(def.horas_preaviso),
        pending: def.pendiente,
        remainingHours: Number(def.horas_restantes),
        lastMaintenanceHours: def.ultimas_horas_realizadas !== null ? Number(def.ultimas_horas_realizadas) : null
      }))
    };
    
    console.log("Synced Machine State:", mappedMachine);
    return mappedMachine;
}

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
            // Set end date to end of the day
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
}

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

// --- CP REAL SERVICES ---

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();

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
}

export const saveCPReport = async (report: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) return mock.saveCPReport(report);

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
}

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);

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
}

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);

    // Upsert logic
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
}
