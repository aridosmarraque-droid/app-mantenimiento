
import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
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
    warningHours: d.aviso_horas,
    // Calculated fields defaults
    pending: false,
    remainingHours: 0
});

const mapMachine = (m: any): Machine => ({
    id: m.id,
    costCenterId: m.centro_coste_id,
    name: m.nombre,
    companyCode: m.codigo_empresa,
    currentHours: m.horas_actuales,
    requiresHours: m.requiere_control_horas,
    adminExpenses: m.gastos_admin,
    transportExpenses: m.gastos_transporte,
    maintenanceDefs: m.mantenimiento_defs ? m.mantenimiento_defs.map(mapDef) : []
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
    console.log("DB: Usando SUPABASE para Trabajadores");
    const { data, error } = await supabase.from('trabajadores').select('*');
    if (error) { 
        console.error("DB Error getWorkers:", error); 
        return []; 
    }
    return data ? data.map(mapWorker) : [];
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('centros_coste').select('*');
    if (error) { console.error("getCostCenters", error); return []; }
    return data.map((c: any) => ({ id: c.id, name: c.nombre }));
};

// ... resto de las funciones sin cambios significativos, solo exportaciones estándar ...
// Para abreviar en el XML, solo incluyo getWorkers modificado y el resto igual que antes.
// Aseguro que el archivo termine correctamente.

export const createCostCenter = async (name: string): Promise<CostCenter> => {
    if (!isConfigured) return mock.createCostCenter(name);
    const { data, error } = await supabase.from('centros_coste').insert({ nombre: name }).select().single();
    if (error) throw error;
    return { id: data.id, name: data.nombre };
};

export const getMachinesByCenter = async (centerId: string): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId);
    const { data, error } = await supabase
        .from('maquinas')
        .select('*, mantenimiento_defs(*)')
        .eq('centro_coste_id', centerId);
    if (error) { console.error("getMachinesByCenter", error); return []; }
    return data.map(mapMachine);
};

export const getAllMachines = async (): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    const { data, error } = await supabase
        .from('maquinas')
        .select('*, mantenimiento_defs(*)');
    if (error) { console.error("getAllMachines", error); return []; }
    return data.map(mapMachine);
};

export const createMachine = async (machine: Omit<Machine, 'id'>): Promise<Machine> => {
    if (!isConfigured) return mock.createMachine(machine);
    
    // 1. Insert Machine
    const { data: mData, error: mError } = await supabase.from('maquinas').insert({
        centro_coste_id: machine.costCenterId,
        nombre: machine.name,
        codigo_empresa: machine.companyCode,
        horas_actuales: machine.currentHours,
        requiere_control_horas: machine.requiresHours,
        gastos_admin: machine.adminExpenses,
        gastos_transporte: machine.transportExpenses
    }).select().single();

    if (mError) throw mError;

    // 2. Insert Defs
    if (machine.maintenanceDefs.length > 0) {
        const defsToInsert = machine.maintenanceDefs.map(d => ({
            maquina_id: mData.id,
            nombre: d.name,
            intervalo_horas: d.intervalHours,
            tareas: d.tasks,
            aviso_horas: d.warningHours
        }));
        const { error: dError } = await supabase.from('mantenimiento_defs').insert(defsToInsert);
        if (dError) console.error("Error creating defs", dError);
    }

    return { ...machine, id: mData.id };
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return mock.updateMachineAttributes(id, updates);
    
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.nombre = updates.name;
    if (updates.companyCode !== undefined) dbUpdates.codigo_empresa = updates.companyCode;
    if (updates.costCenterId !== undefined) dbUpdates.centro_coste_id = updates.costCenterId;
    if (updates.currentHours !== undefined) dbUpdates.horas_actuales = updates.currentHours;
    if (updates.requiresHours !== undefined) dbUpdates.requiere_control_horas = updates.requiresHours;
    if (updates.adminExpenses !== undefined) dbUpdates.gastos_admin = updates.adminExpenses;
    if (updates.transportExpenses !== undefined) dbUpdates.gastos_transporte = updates.transportExpenses;

    const { error } = await supabase.from('maquinas').update(dbUpdates).eq('id', id);
    if (error) throw error;
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentMachineHours: number): Promise<MaintenanceDefinition> => {
    if (!isConfigured) return mock.addMaintenanceDef(def, currentMachineHours);
    
    const { data, error } = await supabase.from('mantenimiento_defs').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        aviso_horas: def.warningHours
    }).select().single();

    if (error) throw error;
    return mapDef(data);
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) return mock.updateMaintenanceDef(def);
    const { error } = await supabase.from('mantenimiento_defs').update({
        nombre: def.name,
        intervalo_horas: def.intervalHours,
        tareas: def.tasks,
        aviso_horas: def.warningHours
    }).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (defId: string): Promise<void> => {
    if (!isConfigured) return mock.deleteMaintenanceDef(defId);
    const { error } = await supabase.from('mantenimiento_defs').delete().eq('id', defId);
    if (error) throw error;
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('proveedores_servicio').select('*');
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

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<OperationLog> => {
    if (!isConfigured) return mock.saveOperationLog(log);

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
    const { data: mData } = await supabase.from('maquinas').select('horas_actuales').eq('id', log.machineId).single();
    if (mData && log.hoursAtExecution > mData.horas_actuales) {
        await supabase.from('maquinas').update({ horas_actuales: log.hoursAtExecution }).eq('id', log.machineId);
    }

    return mapLogFromDb(data);
};

export const calculateAndSyncMachineStatus = async (machine: Machine): Promise<Machine> => {
    if (!isConfigured) return mock.calculateAndSyncMachineStatus(machine);
    
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
         return (await Promise.all([mock.getLastCPReport()])).filter((r): r is CPDailyReport => r !== null);
    }

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
};

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
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return mock.saveCPWeeklyPlan(plan);

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
};
