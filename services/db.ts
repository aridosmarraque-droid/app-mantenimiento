
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import { CostCenter, Machine, ServiceProvider, Worker, OperationLog, MaintenanceDefinition } from '../types';

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
        remainingHours: Number(def.horas_restantes)
      }))
    }));
  } catch (error) {
    console.error('Error fetching machines (usando fallback):', error);
    return mock.getMachinesByCenter(centerId);
  }
};

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
                // Calcular horas restantes iniciales
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

            if (defsError) {
                console.error("Error inserting defs:", defsError);
                throw defsError; // Throw so UI knows it failed
            }
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

/**
 * LOGIC CORE: Updates the maintenance status for a machine.
 * Recalculates remaining hours and pending status.
 */
export const updateMaintenanceStatus = async (machineId: string, currentHours: number, completedDefId?: string) => {
    if (!isConfigured) return;

    try {
        // 1. Fetch current definitions
        const { data: defs, error } = await supabase
            .from('mant_mantenimientos_def')
            .select('*')
            .eq('maquina_id', machineId);
        
        if (error || !defs) return;

        // 2. Calculate updates
        const updates = defs.map(def => {
            // Calculation: Remaining Hours
            const interval = Number(def.intervalo_horas);
            const hoursInCycle = currentHours % interval;
            const remaining = interval - hoursInCycle;
            
            const isWithinWarning = remaining <= Number(def.horas_preaviso);
            let newPendingState = def.pendiente; // Sticky Logic

            if (completedDefId && def.id === completedDefId) {
                // Explicit reset when completing a maintenance
                newPendingState = false;
            } else if (isWithinWarning) {
                // Mathematical Trigger
                newPendingState = true;
            }
            
            // Only return if there is a change to save DB writes, 
            // BUT since we are recalculating remaining hours every time, we almost always write if hours changed.
            return { 
                id: def.id, 
                pendiente: newPendingState,
                horas_restantes: remaining
            };
        });

        // 3. Perform Updates
        for (const update of updates) {
            await supabase
                .from('mant_mantenimientos_def')
                .update({ 
                    pendiente: update.pendiente,
                    horas_restantes: update.horas_restantes 
                })
                .eq('id', update.id);
        }

    } catch (e) {
        console.error("Error updating maintenance status:", e);
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
      litros_combustible: log.fuelLitres // New field
    };

    // 1. Insert Log
    const { data: logData, error: logError } = await supabase
      .from('mant_registros')
      .insert(dbPayload)
      .select()
      .single();

    if (logError) throw logError;

    // 2. Update Machine Hours & Maintenance Status
    if (log.hoursAtExecution) {
        await supabase
            .from('mant_maquinas')
            .update({ horas_actuales: log.hoursAtExecution })
            .eq('id', log.machineId)
            .lt('horas_actuales', log.hoursAtExecution);
        
        // 3. Update Maintenance Statuses (Centralized Logic)
        await updateMaintenanceStatus(log.machineId, log.hoursAtExecution, log.maintenanceDefId);
    }

    return mapLogFromDb(logData);
  } catch (error) {
    alert("Error de conexión con Supabase. Se guardará en local temporalmente.");
    return mock.saveOperationLog(log);
  }
};

// Helper used by MachineSelector to ensure data is fresh on open
export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    
    await updateMaintenanceStatus(machine.id, machine.currentHours);
    
    // Re-fetch machine to get updated definitions
    const { data, error } = await supabase
      .from('mant_maquinas')
      .select(`*, mant_mantenimientos_def (*)`)
      .eq('id', machine.id)
      .single();
      
    if (error || !data) return machine; // Fallback

    return {
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
        remainingHours: Number(def.horas_restantes)
      }))
    };
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

