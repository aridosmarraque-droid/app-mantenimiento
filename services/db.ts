import { supabase, isConfigured } from './client';
import * as mock from './mockDb';
import * as offline from './offlineQueue';
import { checkMaintenanceThresholds } from './notifications';
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
    WorkerDocument,
    SpecificCostRule
} from '../types';

// --- HELPERS ---

export const toLocalDateString = (date: Date | string): string => {
    if (!date) {
        throw new Error("Fecha no proporcionada.");
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
        throw new Error("Fecha inválida proporcionada al sistema.");
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- MAPPERS ---

const mapWorker = (w: any): Worker => ({
    id: w.id,
    name: w.nombre || 'Sin nombre',
    dni: w.dni || '',
    phone: w.telefono || '',
    positionIds: [], 
    role: w.rol || 'worker', 
    activo: w.activo !== undefined ? w.activo : true,
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
        description: dbLog.descripcion || dbLog.description, 
        materials: dbLog.materiales,
        maintenanceDefId: dbLog.mantenimiento_def_id,
        fuelLitres: dbLog.litros_combustible != null ? Number(dbLog.litros_combustible) : undefined
    };
};

const mapMachine = (m: any): Machine => {
    const currentHours = Number(m.horas_actuales || 0);
    const defsRaw = m.mant_mantenimientos_def || [];
    
    return {
        id: m.id,
        costCenterId: m.centro_id, 
        subCenterId: m.subcentro_id,
        name: m.nombre,
        companyCode: m.codigo_empresa,
        currentHours,
        requiresHours: !!m.requiere_horas, 
        adminExpenses: !!m.gastos_admin,
        transportExpenses: !!m.gastos_transporte,
        maintenanceDefs: defsRaw.map((d: any) => {
            const interval = Number(d.intervalo_horas || 0);
            const lastHours = Number(d.ultimas_horas_realizadas || 0);
            const warning = Number(d.horas_preaviso || 0);
            const nextDueHours = lastHours + interval;
            const remaining = nextDueHours - currentHours;
            const isActuallyPending = d.tipo_programacion === 'HOURS' ? (remaining <= warning) : !!d.pendiente;

            return {
                id: d.id,
                machineId: d.maquina_id,
                name: d.nombre,
                maintenanceType: d.tipo_programacion || 'HOURS',
                intervalHours: interval,
                warningHours: warning, 
                lastMaintenanceHours: lastHours,
                remainingHours: remaining,
                intervalMonths: Number(d.intervalo_meses || 0),
                nextDate: d.proxima_fecha ? new Date(d.proxima_fecha) : undefined,
                lastMaintenanceDate: d.ultima_fecha ? new Date(d.ultima_fecha) : undefined,
                tasks: d.tareas || '',
                pending: isActuallyPending,
                notifiedWarning: !!d.notificado_preaviso,
                notifiedOverdue: !!d.notificado_vencido
            };
        }),
        selectableForReports: !!m.es_parte_trabajo,
        responsibleWorkerId: m.responsable_id,
        activo: m.activo !== undefined ? m.activo : true,
        vinculadaProduccion: !!m.vinculada_produccion
    };
};

const mapCostCenter = (c: any): CostCenter => ({
    id: c.id,
    name: c.nombre,
    companyCode: c.codigo_empresa,
    selectableForReports: c.es_parte_trabajo !== undefined ? c.es_parte_trabajo : true
});

// --- FUNCIONES DE SINCRONIZACIÓN AUTOMÁTICA ---

/**
 * Busca máquinas vinculadas a producción y actualiza sus horas 
 * basándose en los campos del parte diario de planta.
 */
const syncMachineHoursFromProduction = async (type: 'CP' | 'CR', report: any) => {
    console.log(`[SYNC] Iniciando sincronización de horas desde parte ${type}`);
    
    // 1. Obtener todas las máquinas marcadas para sincronización
    const { data: machines, error: mError } = await supabase
        .from('mant_maquinas')
        .select('id, subcentro_id, nombre')
        .eq('vinculada_produccion', true);

    if (mError || !machines || machines.length === 0) return;

    // 2. Obtener los subcentros para saber a qué campo de producción están vinculados
    const { data: subcenters, error: sError } = await supabase
        .from('mant_subcentros')
        .select('id, campo_produccion');

    if (sError || !subcenters) return;

    for (const machine of machines) {
        const sub = subcenters.find(s => s.id === machine.subcentro_id);
        if (!sub || !sub.campo_produccion) continue;

        let newHours = 0;
        
        // Mapeo de campos: Subcentro -> Reporte
        if (type === 'CP') {
            if (sub.campo_produccion === 'MACHACADORA') newHours = report.crusherEnd;
            if (sub.campo_produccion === 'MOLINOS') newHours = report.millsEnd;
        } else if (type === 'CR') {
            if (sub.campo_produccion === 'LAVADO') newHours = report.washingEnd;
            if (sub.campo_produccion === 'TRITURACION') newHours = report.trituracion_fin;
        }

        if (newHours > 0) {
            console.log(`[SYNC] Actualizando ${machine.nombre} a ${newHours}h (Vía Producción)`);
            await updateMachineAttributes(machine.id, { currentHours: newHours });
            
            // Comprobar si esta actualización dispara algún mantenimiento
            const { data: mFull } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', machine.id).single();
            if (mFull) {
                await checkMaintenanceThresholds(mapMachine(mFull), newHours);
            }
        }
    }
};

// --- FUNCIONES CORE ---

export const getWorkers = async (onlyActive: boolean = true): Promise<Worker[]> => {
    if (!isConfigured) return mock.getWorkers(onlyActive);
    const { data, error } = await supabase.from('mant_trabajadores').select('*');
    if (error) {
        console.error("Error cargando trabajadores:", error);
        return [];
    }
    const workers = (data || []).map(mapWorker).sort((a, b) => a.name.localeCompare(b.name));
    return onlyActive ? workers.filter(w => w.activo !== false) : workers;
};

export const createWorker = async (w: Omit<Worker, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_trabajadores').insert({
        nombre: w.name, dni: w.dni, telefono: w.phone, rol: w.role, activo: w.activo,
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
    if (updates.activo !== undefined) p.activo = updates.activo;
    if (updates.expectedHours !== undefined) p.horas_programadas = updates.expectedHours;
    if (updates.requiresReport !== undefined) p.requiere_parte = updates.requiresReport;
    const { error } = await supabase.from('mant_trabajadores').update(p).eq('id', id);
    if (error) throw error;
};

export const getCostCenters = async (): Promise<CostCenter[]> => {
    if (!isConfigured) return mock.getCostCenters();
    const { data, error } = await supabase.from('mant_centros').select('*');
    if (error) return [];
    return (data || []).map(mapCostCenter);
};

export const createCostCenter = async (center: Omit<CostCenter, 'id'>): Promise<CostCenter> => {
    const { data, error } = await supabase.from('mant_centros').insert({ 
        nombre: center.name,
        codigo_empresa: center.companyCode,
        es_parte_trabajo: center.selectableForReports
    }).select().single();
    if (error) throw error;
    return mapCostCenter(data);
};

export const updateCostCenter = async (id: string, updates: Partial<CostCenter>): Promise<void> => {
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.companyCode !== undefined) p.codigo_empresa = updates.companyCode;
    if (updates.selectableForReports !== undefined) p.es_parte_trabajo = updates.selectableForReports;
    
    const { error } = await supabase.from('mant_centros').update(p).eq('id', id);
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
        tracksProduction: s.campo_produccion !== null && s.campo_produccion !== undefined,
        productionField: s.campo_produccion
    }));
};

export const createSubCenter = async (sub: Omit<SubCenter, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').insert({
        centro_id: sub.centerId,
        nombre: sub.name,
        campo_produccion: sub.tracksProduction ? sub.productionField : null
    });
    if (error) throw error;
};

export const updateSubCenter = async (id: string, updates: Partial<SubCenter>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.tracksProduction !== undefined) {
        p.campo_produccion = updates.tracksProduction ? updates.productionField : null;
    }
    const { error } = await supabase.from('mant_subcentros').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteSubCenter = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_subcentros').delete().eq('id', id);
    if (error) throw error;
};

export const getMachinesBySubCenter = async (subId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return [];
    try {
        let query = supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('subcentro_id', subId);
        if (onlyActive) query = query.eq('activo', true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapMachine);
    } catch (e) {
        let fallback = supabase.from('mant_maquinas').select('*').eq('subcentro_id', subId);
        if (onlyActive) fallback = fallback.eq('activo', true);
        const { data } = await fallback;
        return (data || []).map(m => mapMachine({...m, mant_mantenimientos_def: []}));
    }
};

export const getMachinesByCenter = async (centerId: string, onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getMachinesByCenter(centerId, onlyActive);
    try {
        let query = supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('centro_id', centerId);
        if (onlyActive) query = query.eq('activo', true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapMachine);
    } catch (e) {
        let fallback = supabase.from('mant_maquinas').select('*').eq('centro_id', centerId);
        if (onlyActive) fallback = fallback.eq('activo', true);
        const { data } = await fallback;
        return (data || []).map(m => mapMachine({...m, mant_mantenimientos_def: []}));
    }
};

export const getAllMachines = async (onlyActive: boolean = true): Promise<Machine[]> => {
    if (!isConfigured) return mock.getAllMachines();
    try {
        const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)');
        if (error) throw error;
        const machines = (data || []).map(mapMachine);
        return onlyActive ? machines.filter(m => m.activo !== false) : machines;
    } catch (e) {
        const { data } = await supabase.from('mant_maquinas').select('*');
        const machines = (data || []).map(m => mapMachine({...m, mant_mantenimientos_def: []}));
        return onlyActive ? machines.filter(m => m.activo !== false) : machines;
    }
};

export const createMachine = async (m: Omit<Machine, 'id' | 'maintenanceDefs'> & { maintenanceDefs: MaintenanceDefinition[] }): Promise<void> => {
    if (!isConfigured) return;
    const { data: machineData, error: machineError } = await supabase.from('mant_maquinas').insert({
        nombre: m.name,
        codigo_empresa: m.companyCode,
        centro_id: m.costCenterId,
        subcentro_id: m.subCenterId,
        responsable_id: m.responsibleWorkerId,
        horas_actuales: m.currentHours,
        requiere_horas: m.requiresHours,
        gastos_admin: m.adminExpenses,
        gastos_transporte: m.transportExpenses,
        es_parte_trabajo: m.selectableForReports,
        activo: m.activo,
        vinculada_produccion: m.vinculadaProduccion
    }).select().single();

    if (machineError) throw machineError;

    if (m.maintenanceDefs && m.maintenanceDefs.length > 0) {
        const defs = m.maintenanceDefs.map(d => ({
            maquina_id: machineData.id,
            nombre: d.name,
            tipo_programacion: d.maintenanceType,
            intervalo_horas: d.intervalHours,
            horas_preaviso: d.warningHours,
            intervalo_meses: d.intervalMonths,
            proxima_fecha: d.nextDate,
            tareas: d.tasks,
            ultimas_horas_realizadas: machineData.horas_actuales
        }));
        const { error: defError } = await supabase.from('mant_mantenimientos_def').insert(defs);
        if (defError) throw defError;
    }
};

export const updateMachineAttributes = async (id: string, updates: Partial<Machine>): Promise<void> => {
    if (!isConfigured) return;
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
    if (updates.activo !== undefined) p.activo = updates.activo;
    if (updates.vinculadaProduccion !== undefined) p.vinculada_produccion = updates.vinculadaProduccion;

    const { error } = await supabase.from('mant_maquinas').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteMachine = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_maquinas').delete().eq('id', id);
    if (error) throw error;
};

export const getMachineDependencyCount = async (id: string): Promise<{ logs: number, reports: number }> => {
    if (!isConfigured) return { logs: 0, reports: 0 };
    const [logsRes, reportsRes] = await Promise.all([
        supabase.from('mant_registros').select('id', { count: 'exact', head: true }).eq('maquina_id', id),
        supabase.from('partes_trabajo').select('id', { count: 'exact', head: true }).eq('maquina_id', id)
    ]);
    return { logs: logsRes.count || 0, reports: reportsRes.count || 0 };
};

export const addMaintenanceDef = async (def: MaintenanceDefinition, currentHours: number): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_mantenimientos_def').insert({
        maquina_id: def.machineId,
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate,
        tareas: def.tasks,
        ultimas_horas_realizadas: currentHours
    });
    if (error) throw error;
};

export const updateMaintenanceDef = async (def: MaintenanceDefinition): Promise<void> => {
    if (!isConfigured) {
        await mock.updateMaintenanceDef(def);
        return;
    }
    const p: any = {
        nombre: def.name,
        tipo_programacion: def.maintenanceType,
        intervalo_horas: def.intervalHours,
        horas_preaviso: def.warningHours,
        intervalo_meses: def.intervalMonths,
        proxima_fecha: def.nextDate,
        tareas: def.tasks,
        notificado_preaviso: def.notifiedWarning,
        notificado_vencido: def.notifiedOverdue
    };
    const { error } = await supabase.from('mant_mantenimientos_def').update(p).eq('id', def.id);
    if (error) throw error;
};

export const deleteMaintenanceDef = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_mantenimientos_def').delete().eq('id', id);
    if (error) throw error;
};

export const calculateAndSyncMachineStatus = async (m: Machine): Promise<Machine> => {
    if (!isConfigured) return m;
    try {
        const { data, error } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', m.id).single();
        if (error || !data) throw error;
        return mapMachine(data);
    } catch (e) {
        const { data } = await supabase.from('mant_maquinas').select('*').eq('id', m.id).single();
        return data ? mapMachine({...data, mant_mantenimientos_def: []}) : m;
    }
};

export const saveOperationLog = async (log: Omit<OperationLog, 'id'>): Promise<void> => {
    if (!isConfigured) {
        offline.addToQueue('LOG', log);
        return;
    }

    console.log("[DATABASE] Iniciando saveOperationLog para máquina:", log.machineId);

    // 1. Insertar el registro técnico principal
    const { error: insertError } = await supabase.from('mant_registros').insert({
        fecha: toLocalDateString(log.date),
        trabajador_id: log.workerId,
        maquina_id: log.machineId,
        horas_registro: Number(log.hoursAtExecution),
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
    });
    
    if (insertError) {
        console.error("[DATABASE] Error crítico en inserción mant_registros:", insertError);
        throw new Error(`Error al guardar el registro: ${insertError.message}`);
    }

    // 2. REINICIO DE CICLO (SI ES PROGRAMADO)
    if (log.maintenanceDefId) {
        console.log("[DATABASE] Detectado mantenimiento programado ID:", log.maintenanceDefId);
        
        try {
            // Obtenemos configuración para el recálculo (especialmente si es por fecha)
            const { data: defData, error: fetchError } = await supabase
                .from('mant_mantenimientos_def')
                .select('tipo_programacion, intervalo_meses')
                .eq('id', log.maintenanceDefId)
                .single();
            
            if (fetchError) throw fetchError;

            const updatePayload: any = {
                ultimas_horas_realizadas: Number(log.hoursAtExecution),
                pendiente: false,
                notificado_preaviso: false,
                notificado_vencido: false,
                ultima_fecha: toLocalDateString(log.date)
            };

            // Recálculo de próxima fecha si aplica
            if (defData && defData.tipo_programacion === 'DATE' && defData.intervalo_meses) {
                const nextDate = new Date(log.date);
                nextDate.setMonth(nextDate.getMonth() + defData.intervalo_meses);
                updatePayload.proxima_fecha = toLocalDateString(nextDate);
            }

            console.log("[DATABASE] Enviando actualización a mant_mantenimientos_def:", updatePayload);

            const { error: updateError, count } = await supabase
                .from('mant_mantenimientos_def')
                .update(updatePayload, { count: 'exact' })
                .eq('id', log.maintenanceDefId);

            if (updateError) throw updateError;
            
            if (count === 0) {
                console.warn("[DATABASE] ADVERTENCIA: No se actualizó ninguna fila. ¿El ID es correcto?");
            } else {
                console.log("[DATABASE] ÉXITO: mant_mantenimientos_def actualizado.");
            }
        } catch (e: any) {
            console.error("[DATABASE] Falló el reinicio de ciclo de mantenimiento:", e);
            throw new Error(`El registro técnico se guardó, pero NO se pudo resetear la tarea programada: ${e.message}`);
        }
    }

    // 3. ACTUALIZACIÓN DE HORAS GLOBALES DE MÁQUINA
    if (log.hoursAtExecution) {
        try {
            await updateMachineAttributes(log.machineId, { currentHours: Number(log.hoursAtExecution) });
            console.log(`[DATABASE] Horas de máquina ${log.machineId} actualizadas a ${log.hoursAtExecution}h`);
            
            // Verificación de umbrales para el resto de tareas de esta máquina
            const { data: mData } = await supabase.from('mant_maquinas').select('*, mant_mantenimientos_def(*)').eq('id', log.machineId).single();
            if (mData) {
                const mappedMachine = mapMachine(mData);
                await checkMaintenanceThresholds(mappedMachine, Number(log.hoursAtExecution));
            }
        } catch (e) {
            console.error("[DATABASE] Error no crítico actualizando horas globales:", e);
        }
    }
};

export const getMachineLogs = async (machineId: string, start?: Date, end?: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('mant_registros').select('*').eq('maquina_id', machineId);
    if (start) query = query.gte('fecha', toLocalDateString(start));
    if (end) query = query.lte('fecha', toLocalDateString(end));
    if (types && types.length > 0) query = query.in('tipo_operacion', types);
    query = query.order('fecha', { ascending: false }).order('horas_registro', { ascending: false });
    
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(mapLogFromDb);
};

// --- 8. PREVENCIÓN DE RIESGOS LABORALES (PRL) ---

export const getPRLDocumentTypes = async (onlyActive: boolean = true): Promise<PRLDocumentType[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('prl_tipos_documento').select('*');
    if (onlyActive) query = query.eq('activo', true);
    const { data, error } = await query.order('nombre');
    if (error) return [];
    return (data || []).map(d => ({
        id: d.id,
        name: d.nombre,
        category: d.categoria as PRLCategory,
        periodicityMonths: d.periodicidad_meses,
        warningDays: d.dias_preaviso,
        activo: d.activo
    }));
};

export const createPRLDocumentType = async (d: Omit<PRLDocumentType, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_tipos_documento').insert({
        nombre: d.name,
        categoria: d.category,
        periodicidad_meses: d.periodicityMonths,
        dias_preaviso: d.warningDays,
        activo: d.activo
    });
    if (error) throw error;
};

export const updatePRLDocumentType = async (id: string, updates: Partial<PRLDocumentType>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.category !== undefined) p.categoria = updates.category;
    if (updates.periodicityMonths !== undefined) p.periodicidad_meses = updates.periodicityMonths;
    if (updates.warningDays !== undefined) p.dias_preaviso = updates.warningDays;
    if (updates.activo !== undefined) p.activo = updates.activo;
    const { error } = await supabase.from('prl_tipos_documento').update(p).eq('id', id);
    if (error) throw error;
};

export const getSubcontractors = async (onlyActive: boolean = true): Promise<Subcontractor[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('prl_subcontratas').select('*');
    if (onlyActive) query = query.eq('activo', true);
    const { data, error } = await query.order('nombre');
    if (error) return [];
    return (data || []).map(s => ({
        id: s.id,
        name: s.nombre,
        cif: s.cif,
        contactName: s.contacto_nombre,
        phone: s.telefono,
        email: s.email,
        activo: s.activo
    }));
};

export const createSubcontractor = async (s: Omit<Subcontractor, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_subcontratas').insert({
        nombre: s.name,
        cif: s.cif,
        contacto_nombre: s.contactName,
        telefono: s.phone,
        email: s.email,
        activo: s.activo
    });
    if (error) throw error;
};

export const updateSubcontractor = async (id: string, updates: Partial<Subcontractor>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.cif !== undefined) p.cif = updates.cif;
    if (updates.contactName !== undefined) p.contacto_nombre = updates.contactName;
    if (updates.phone !== undefined) p.telefono = updates.phone;
    if (updates.email !== undefined) p.email = updates.email;
    if (updates.activo !== undefined) p.activo = updates.activo;
    const { error } = await supabase.from('prl_subcontratas').update(p).eq('id', id);
    if (error) throw error;
};

export const getSubcontractorWorkers = async (subId: string, onlyActive: boolean = true): Promise<SubcontractorWorker[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('prl_trabajadores_subcontrata').select('*').eq('subcontrata_id', subId);
    if (onlyActive) query = query.eq('activo', true);
    const { data, error } = await query.order('nombre');
    if (error) return [];
    return (data || []).map(w => ({
        id: w.id,
        subcontractorId: w.subcontrata_id,
        name: w.nombre,
        dni: w.dni,
        phone: w.telefono,
        email: w.email,
        activo: w.activo
    }));
};

export const createSubcontractorWorker = async (w: Omit<SubcontractorWorker, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_trabajadores_subcontrata').insert({
        subcontrata_id: w.subcontractorId,
        nombre: w.name,
        dni: w.dni,
        telefono: w.phone,
        email: w.email,
        activo: w.activo
    });
    if (error) throw error;
};

export const updateSubcontractorWorker = async (id: string, updates: Partial<SubcontractorWorker>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.dni !== undefined) p.dni = updates.dni;
    if (updates.phone !== undefined) p.telefono = updates.phone;
    if (updates.email !== undefined) p.email = updates.email;
    if (updates.activo !== undefined) p.activo = updates.activo;
    const { error } = await supabase.from('prl_trabajadores_subcontrata').update(p).eq('id', id);
    if (error) throw error;
};

export const getPRLAssignments = async (workerId?: string, subWorkerId?: string): Promise<PRLAssignment[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('prl_asignaciones').select('*, prl_tipos_documento(nombre, categoria)');
    if (workerId) query = query.eq('trabajador_id', workerId);
    if (subWorkerId) query = query.eq('trabajador_sub_id', subWorkerId);
    
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(a => ({
        id: a.id,
        workerId: a.trabajador_id,
        subcontractorWorkerId: a.trabajador_sub_id,
        documentTypeId: a.tipo_documento_id,
        issueDate: new Date(a.fecha_emision),
        expiryDate: a.fecha_vencimiento ? new Date(a.fecha_vencimiento) : undefined,
        fileUrl: a.url_archivo,
        notified: a.notificado,
        documentTypeName: a.prl_tipos_documento?.nombre,
        category: a.prl_tipos_documento?.categoria as PRLCategory
    }));
};

export const savePRLAssignment = async (a: Omit<PRLAssignment, 'id' | 'documentTypeName' | 'workerName' | 'category'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_asignaciones').insert({
        trabajador_id: a.workerId,
        trabajador_sub_id: a.subcontractorWorkerId,
        tipo_documento_id: a.documentTypeId,
        fecha_emision: toLocalDateString(a.issueDate),
        fecha_vencimiento: a.expiryDate ? toLocalDateString(a.expiryDate) : null,
        url_archivo: a.fileUrl,
        notificado: a.notified
    });
    if (error) throw error;
};

export const updatePRLAssignment = async (id: string, updates: Partial<PRLAssignment>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.issueDate) p.fecha_emision = toLocalDateString(updates.issueDate);
    if (updates.expiryDate !== undefined) p.fecha_vencimiento = updates.expiryDate ? toLocalDateString(updates.expiryDate) : null;
    if (updates.fileUrl !== undefined) p.url_archivo = updates.fileUrl;
    if (updates.notified !== undefined) p.notificado = updates.notified;
    const { error } = await supabase.from('prl_asignaciones').update(p).eq('id', id);
    if (error) throw error;
};

export const deletePRLAssignment = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_asignaciones').delete().eq('id', id);
    if (error) throw error;
};

export const getCompanyPRLDocuments = async (subId?: string): Promise<CompanyPRLDocument[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('prl_documentos_empresa').select('*');
    if (subId) query = query.eq('subcontrata_id', subId);
    else query = query.is('subcontrata_id', null);
    
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(d => ({
        id: d.id,
        subcontractorId: d.subcontrata_id,
        name: d.nombre,
        issueDate: new Date(d.fecha_emision),
        expiryDate: d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : undefined,
        fileUrl: d.url_archivo,
        warningDays: d.dias_preaviso,
        notified: d.notificado
    }));
};

export const saveCompanyPRLDocument = async (d: Omit<CompanyPRLDocument, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_documentos_empresa').insert({
        subcontrata_id: d.subcontractorId,
        nombre: d.name,
        fecha_emision: toLocalDateString(d.issueDate),
        fecha_vencimiento: d.expiryDate ? toLocalDateString(d.expiryDate) : null,
        url_archivo: d.fileUrl,
        dias_preaviso: d.warningDays,
        notificado: d.notified
    });
    if (error) throw error;
};

export const updateCompanyPRLDocument = async (id: string, updates: Partial<CompanyPRLDocument>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (updates.name !== undefined) p.nombre = updates.name;
    if (updates.issueDate) p.fecha_emision = toLocalDateString(updates.issueDate);
    if (updates.expiryDate !== undefined) p.fecha_vencimiento = updates.expiryDate ? toLocalDateString(updates.expiryDate) : null;
    if (updates.fileUrl !== undefined) p.url_archivo = updates.fileUrl;
    if (updates.warningDays !== undefined) p.dias_preaviso = updates.warningDays;
    if (updates.notified !== undefined) p.notificado = updates.notified;
    const { error } = await supabase.from('prl_documentos_empresa').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteCompanyPRLDocument = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('prl_documentos_empresa').delete().eq('id', id);
    if (error) throw error;
};

export const updateOperationLog = async (id: string, log: Partial<OperationLog>): Promise<void> => {
    if (!isConfigured) {
        await mock.updateOperationLog(id, log);
        return;
    }
    const p: any = {};
    if (log.date) p.fecha = toLocalDateString(log.date);
    if (log.machineId) p.maquina_id = log.machineId;
    if (log.workerId) p.trabajador_id = log.workerId;
    if (log.hoursAtExecution !== undefined) p.horas_registro = log.hoursAtExecution;
    if (log.motorOil !== undefined) p.aceite_motor_l = log.motorOil;
    if (log.hydraulicOil !== undefined) p.aceite_hidraulico_l = log.hydraulicOil;
    if (log.coolant !== undefined) p.refrigerante_l = log.coolant;
    if (log.fuelLitres !== undefined) p.litros_combustible = log.fuelLitres;
    if (log.breakdownCause !== undefined) p.causa_averia = log.breakdownCause;
    if (log.breakdownSolution !== undefined) p.solucion_averia = log.breakdownSolution;
    if (log.description !== undefined) p.descripcion = log.description;
    if (log.materials !== undefined) p.materiales = log.materials;

    const { error } = await supabase.from('mant_registros').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteOperationLog = async (id: string): Promise<void> => {
    if (!isConfigured) {
        await mock.deleteOperationLog(id);
        return;
    }
    const { error } = await supabase.from('mant_registros').delete().eq('id', id);
    if (error) throw error;
};

export const getServiceProviders = async (): Promise<ServiceProvider[]> => {
    if (!isConfigured) return mock.getServiceProviders();
    const { data, error } = await supabase.from('mant_proveedores').select('*').order('nombre');
    if (error) return [];
    return (data || []).map(p => ({ id: p.id, name: p.nombre }));
};

export const createServiceProvider = async (name: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_proveedores').insert({ nombre: name });
    if (error) throw error;
};

export const updateServiceProvider = async (id: string, name: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_proveedores').update({ nombre: name }).eq('id', id);
    if (error) throw error;
};

export const deleteServiceProvider = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_proveedores').delete().eq('id', id);
    if (error) throw error;
};

export const getLastCPReport = async (): Promise<CPDailyReport | null> => {
    if (!isConfigured) return mock.getLastCPReport();
    const { data, error } = await supabase.from('cp_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;
    const r = data[0];
    return {
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        crusherStart: Number(r.machacadora_inicio || 0),
        crusherEnd: Number(r.machacadora_fin || 0),
        millsStart: Number(r.molinos_inicio || 0),
        millsEnd: Number(r.molinos_fin || 0),
        comments: r.comentarios
    };
};

export const saveCPReport = async (r: Omit<CPDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) {
        offline.addToQueue('CP_REPORT', r);
        return;
    }
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

    // Sincronizar horas de máquinas vinculadas
    await syncMachineHoursFromProduction('CP', r);
};

export const getCPReportsByRange = async (start: Date, end: Date): Promise<CPDailyReport[]> => {
    if (!isConfigured) return mock.getCPReportsByRange(start, end);
    const { data, error } = await supabase.from('cp_partes_diarios')
        .select('*')
        .gte('fecha', toLocalDateString(start))
        .lte('fecha', toLocalDateString(end))
        .order('fecha');
    
    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        crusherStart: Number(r.machacadora_inicio || 0),
        crusherEnd: Number(r.machacadora_fin || 0),
        millsStart: Number(r.molinos_inicio || 0),
        millsEnd: Number(r.molinos_fin || 0),
        comments: r.comentarios
    }));
};

export const getLastCRReport = async (): Promise<CRDailyReport | null> => {
    if (!isConfigured) return mock.getLastCRReport();
    const { data, error } = await supabase.from('cr_partes_diarios').select('*').order('fecha', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;
    const r = data[0];
    return {
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        washingStart: Number(r.lavado_inicio || 0),
        washingEnd: Number(r.lavado_fin || 0),
        trituracion_inicio: Number(r.trituracion_inicio || 0),
        trituracion_fin: Number(r.trituracion_fin || 0),
        comments: r.comentarios
    };
};

export const saveCRReport = async (r: Omit<CRDailyReport, 'id'>): Promise<void> => {
    if (!isConfigured) {
        offline.addToQueue('CR_REPORT', r);
        return;
    }
    const { error } = await supabase.from('cr_partes_diarios').insert({
        fecha: toLocalDateString(r.date),
        trabajador_id: r.workerId,
        lavado_inicio: r.washingStart,
        lavado_fin: r.washingEnd,
        trituracion_inicio: r.trituracion_inicio,
        trituracion_fin: r.trituracion_fin,
        comentarios: r.comments
    });
    if (error) throw error;

    // Sincronizar horas de máquinas vinculadas
    await syncMachineHoursFromProduction('CR', r);
};

export const getCRReportsByRange = async (start: Date, end: Date): Promise<CRDailyReport[]> => {
    if (!isConfigured) return mock.getCRReportsByRange(start, end);
    const { data, error } = await queryReports('cr_partes_diarios', start, end);
    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        washingStart: Number(r.lavado_inicio || 0),
        washingEnd: Number(r.lavado_fin || 0),
        trituracion_inicio: Number(r.trituracion_inicio || 0),
        trituracion_fin: Number(r.trituracion_fin || 0),
        comments: r.comentarios
    }));
};

// Helper genérico para evitar duplicación
const queryReports = async (table: string, start: Date, end: Date) => {
    return supabase.from(table)
        .select('*')
        .gte('fecha', toLocalDateString(start))
        .lte('fecha', toLocalDateString(end))
        .order('fecha');
};

export const getCPWeeklyPlan = async (mondayDate: string): Promise<CPWeeklyPlan | null> => {
    if (!isConfigured) return mock.getCPWeeklyPlan(mondayDate);
    const { data, error } = await supabase.from('cp_planificacion').select('*').eq('fecha_lunes', mondayDate).maybeSingle();
    if (error) return null;
    if (!data) return null;
    return {
        id: data.id,
        mondayDate: data.fecha_lunes,
        hoursMon: data.horas_lunes,
        hoursTue: data.horas_martes,
        hoursWed: data.horas_miercoles,
        hoursThu: data.horas_jueves,
        hoursFri: data.horas_viernes
    };
};

export const saveCPWeeklyPlan = async (plan: CPWeeklyPlan): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('cp_planificacion').upsert({
        fecha_lunes: plan.mondayDate,
        horas_lunes: plan.hoursMon,
        horas_martes: plan.hoursTue,
        horas_miercoles: plan.hoursWed,
        horas_jueves: plan.hoursThu,
        horas_viernes: plan.hoursFri
    }, { onConflict: 'fecha_lunes' });
    if (error) throw error;
};

export const getPersonalReports = async (workerId: string): Promise<PersonalReport[]> => {
    if (!isConfigured) return mock.getPersonalReports(workerId);
    const { data, error } = await supabase.from('partes_trabajo')
        .select('*')
        .eq('trabajador_id', workerId)
        .order('fecha', { ascending: false })
        .limit(20);
    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        hours: Number(r.horas || 0),
        costCenterId: r.centro_id,
        machineId: r.maquina_id
    }));
};

export const getAllPersonalReportsByRange = async (start: Date, end: Date): Promise<PersonalReport[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('partes_trabajo')
        .select('*')
        .gte('fecha', toLocalDateString(start))
        .lte('fecha', toLocalDateString(end))
        .order('fecha');
    
    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        date: new Date(r.fecha),
        workerId: r.trabajador_id,
        hours: Number(r.horas || 0),
        costCenterId: r.centro_id,
        machineId: r.maquina_id
    }));
};

export const savePersonalReport = async (r: Omit<PersonalReport, 'id'>): Promise<void> => {
    if (!isConfigured) {
        offline.addToQueue('PERSONAL_REPORT', r);
        return;
    }
    const { error } = await supabase.from('partes_trabajo').insert({
        fecha: toLocalDateString(r.date),
        trabajador_id: r.workerId,
        horas: r.hours,
        centro_id: r.costCenterId,
        maquina_id: r.machineId
    });
    if (error) throw error;
};

export const updatePersonalReport = async (id: string, r: Partial<PersonalReport>): Promise<void> => {
    if (!isConfigured) {
        await mock.updatePersonalReport(id, r);
        return;
    }
    const p: any = {};
    if (r.date) p.fecha = toLocalDateString(r.date);
    if (r.hours !== undefined) p.horas = r.hours;
    if (r.costCenterId !== undefined) p.centro_id = r.costCenterId;
    if (r.machineId !== undefined) p.maquina_id = r.machineId;

    const { error } = await supabase.from('partes_trabajo').update(p).eq('id', id);
    if (error) throw error;
};

export const deletePersonalReport = async (id: string): Promise<void> => {
    if (!isConfigured) {
        await mock.deletePersonalReport(id);
        return;
    }
    const { error } = await supabase.from('partes_trabajo').delete().eq('id', id);
    if (error) throw error;
};

export const getDailyAuditLogs = async (date: Date): Promise<{ ops: OperationLog[], personal: PersonalReport[], cp: CPDailyReport[], cr: CRDailyReport[] }> => {
    if (!isConfigured) return mock.getDailyAuditLogs(date);
    const dateStr = toLocalDateString(date);
    
    const [opsRes, personalRes, cpRes, crRes] = await Promise.all([
        supabase.from('mant_registros').select('*').eq('fecha', dateStr),
        supabase.from('partes_trabajo').select('*').eq('fecha', dateStr),
        supabase.from('cp_partes_diarios').select('*').eq('fecha', dateStr),
        supabase.from('cr_partes_diarios').select('*').eq('fecha', dateStr)
    ]);

    return {
        ops: (opsRes.data || []).map(mapLogFromDb),
        personal: (personalRes.data || []).map(r => ({
            id: r.id,
            date: new Date(r.fecha),
            workerId: r.trabajador_id,
            hours: Number(r.horas || 0),
            costCenterId: r.centro_id,
            machineId: r.maquina_id
        })),
        cp: (cpRes.data || []).map(r => ({
            id: r.id, 
            date: new Date(r.fecha), 
            workerId: r.trabajador_id, 
            crusherStart: Number(r.machacadora_inicio || 0), 
            crusherEnd: Number(r.machacadora_fin || 0),
            millsStart: Number(r.molinos_inicio || 0), 
            millsEnd: Number(r.molinos_fin || 0),
            comments: r.comentarios
        })),
        cr: (crRes.data || []).map(r => ({
            id: r.id, 
            date: new Date(r.fecha), 
            workerId: r.trabajador_id, 
            washingStart: Number(r.lavado_inicio || 0), 
            washingEnd: Number(r.lavado_fin || 0),
            trituracion_inicio: Number(r.trituracion_inicio || 0), 
            trituracion_fin: Number(r.trituracion_fin || 0),
            comments: r.comentarios
        }))
    };
};

export const getSchemaInfo = async (tables: string[]): Promise<any[]> => {
    if (!isConfigured) return [];
    const results = await Promise.all(tables.map(async (t) => {
        const { error } = await supabase.from(t).select('id', { count: 'exact', head: true }).limit(1);
        return { name: t, status: error ? 'ERROR' : 'FOUND' };
    }));
    return results;
};

export const syncPendingData = async (): Promise<{ synced: number }> => {
    if (!isConfigured || !navigator.onLine) return { synced: 0 };
    const queue = offline.getQueue();
    let count = 0;
    for (const item of queue) {
        try {
            if (item.type === 'LOG') await saveOperationLog(item.payload);
            else if (item.type === 'CP_REPORT') await saveCPReport(item.payload);
            else if (item.type === 'CR_REPORT') await saveCRReport(item.payload);
            else if (item.type === 'PERSONAL_REPORT') await savePersonalReport(item.payload);
            offline.removeFromQueue(item.id);
            count++;
        } catch (e) {
            console.error("Error syncing item", item, e);
        }
    }
    return { synced: count };
};

export const getWorkerDocuments = async (workerId: string): Promise<WorkerDocument[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_documentos_trabajador').select('*').eq('trabajador_id', workerId);
    if (error) return [];
    return (data || []).map(d => ({
        id: d.id,
        workerId: d.trabajador_id,
        title: d.titulo,
        category: 'TRABAJADOR',
        issueDate: new Date(d.fecha_emision),
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
        status: d.estado,
        docType: d.tipo_documento
    }));
};

export const saveWorkerDocument = async (doc: Omit<WorkerDocument, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_documentos_trabajador').insert({
        trabajador_id: doc.workerId,
        titulo: doc.title,
        fecha_emision: toLocalDateString(doc.issueDate),
        fecha_vencimiento: doc.expiryDate ? toLocalDateString(doc.expiryDate) : null,
        estado: doc.status,
        tipo_documento: doc.docType
    });
    if (error) throw error;
};

export const getSpecificCostRules = async (): Promise<SpecificCostRule[]> => {
    if (!isConfigured) return [];
    const { data, error } = await supabase.from('mant_costes_especificos').select('*');
    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        machineOriginId: r.maquina_origen_id,
        targetCenterId: r.centro_destino_id,
        targetMachineId: r.maquina_destino_id,
        percentage: r.porcentaje
    }));
};

export const createSpecificCostRule = async (rule: Omit<SpecificCostRule, 'id'>): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_costes_especificos').insert({
        maquina_origen_id: rule.machineOriginId,
        centro_destino_id: rule.targetCenterId,
        maquina_destino_id: rule.targetMachineId || null,
        porcentaje: rule.percentage
    });
    if (error) throw error;
};

export const updateSpecificCostRule = async (id: string, rule: Partial<SpecificCostRule>): Promise<void> => {
    if (!isConfigured) return;
    const p: any = {};
    if (rule.machineOriginId) p.maquina_origen_id = rule.machineOriginId;
    if (rule.targetCenterId) p.centro_destino_id = rule.targetCenterId;
    if (rule.targetMachineId !== undefined) p.maquina_destino_id = rule.targetMachineId;
    if (rule.percentage !== undefined) p.porcentaje = rule.percentage;
    
    const { error } = await supabase.from('mant_costes_especificos').update(p).eq('id', id);
    if (error) throw error;
};

export const deleteSpecificCostRule = async (id: string): Promise<void> => {
    if (!isConfigured) return;
    const { error } = await supabase.from('mant_costes_especificos').delete().eq('id', id);
    if (error) throw error;
};

export const getAllOperationLogsByRange = async (start: Date, end: Date, types?: OperationType[]): Promise<OperationLog[]> => {
    if (!isConfigured) return [];
    let query = supabase.from('mant_registros').select('*')
        .gte('fecha', toLocalDateString(start))
        .lte('fecha', toLocalDateString(end));
    
    if (types && types.length > 0) query = query.in('tipo_operacion', types);
    
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(mapLogFromDb);
};
