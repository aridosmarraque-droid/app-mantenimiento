
import { OperationLog, CPDailyReport, CPWeeklyPlan, PersonalReport, CRDailyReport } from '../types';

export type OfflineActionType = 'LOG' | 'CP_REPORT' | 'CR_REPORT' | 'CP_PLAN' | 'PERSONAL_REPORT';

export interface PendingAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'gmao_offline_queue';

export const getQueue = (): PendingAction[] => {
  try {
    const str = localStorage.getItem(STORAGE_KEY);
    return str ? JSON.parse(str) : [];
  } catch (e) {
    return [];
  }
};

export const addToQueue = (type: OfflineActionType, payload: any) => {
  const queue = getQueue();
  const newAction: PendingAction = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0
  };
  queue.push(newAction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  console.log(`[Offline] Acción guardada en cola: ${type}`, payload);
};

export const removeFromQueue = (id: string) => {
  let queue = getQueue();
  queue = queue.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const clearQueue = () => {
  localStorage.removeItem(STORAGE_KEY);
};
