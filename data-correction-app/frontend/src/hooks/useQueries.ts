/**
 * React Query Hooks
 *
 * 封裝所有 API 調用，提供自動去重、快取、loading 狀態管理
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPendingRecords,
  getRecordDetail,
  getStatistics,
  getTables,
  submitCorrection,
  getCorrectionHistory,
  getSchemaMermaid,
  getSchemaStats,
  refreshSchema,
  getDailyBackupList,
  getDailyBackupDetail,
} from '../services/api'

// ==================== Query Keys ====================
// 集中管理 query keys，便於 invalidate

export const queryKeys = {
  // 資料相關
  tables: ['tables'] as const,
  statistics: ['statistics'] as const,
  pendingRecords: (params: { table_code?: string; limit?: number; offset?: number }) =>
    ['pendingRecords', params] as const,
  recordDetail: (recordId: string) => ['recordDetail', recordId] as const,

  // 修正歷史
  correctionHistory: (params: { table_code?: string; date_from?: string; date_to?: string; limit?: number }) =>
    ['correctionHistory', params] as const,

  // 星狀模型
  schemaMermaid: (level: 'overview' | 'detailed') => ['schemaMermaid', level] as const,
  schemaStats: ['schemaStats'] as const,

  // 備份日誌
  dailyBackupList: (params: { date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
    ['dailyBackupList', params] as const,
  dailyBackupDetail: (date: string, params?: { records_limit?: number; records_offset?: number }) =>
    ['dailyBackupDetail', date, params] as const,
}

// ==================== Data Queries ====================

/** 獲取表格列表 */
export function useTables() {
  return useQuery({
    queryKey: queryKeys.tables,
    queryFn: getTables,
    staleTime: 5 * 60 * 1000, // 表格列表 5 分鐘內視為新鮮
  })
}

/** 獲取統計資訊 */
export function useStatistics() {
  return useQuery({
    queryKey: queryKeys.statistics,
    queryFn: getStatistics,
  })
}

/** 獲取待處理記錄 */
export function usePendingRecords(params: {
  table_code?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.pendingRecords(params),
    queryFn: () => getPendingRecords(params),
  })
}

/** 獲取記錄詳情 */
export function useRecordDetail(recordId: string) {
  return useQuery({
    queryKey: queryKeys.recordDetail(recordId),
    queryFn: () => getRecordDetail(recordId),
    enabled: !!recordId, // 只有有 recordId 時才執行
  })
}

// ==================== Correction Queries ====================

/** 獲取修正歷史 */
export function useCorrectionHistory(params: {
  table_code?: string
  date_from?: string
  date_to?: string
  limit?: number
}) {
  return useQuery({
    queryKey: queryKeys.correctionHistory(params),
    queryFn: () => getCorrectionHistory(params),
  })
}

/** 提交修正 (Mutation) */
export function useSubmitCorrection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitCorrection,
    onSuccess: () => {
      // 成功後 invalidate 相關查詢
      queryClient.invalidateQueries({ queryKey: ['pendingRecords'] })
      queryClient.invalidateQueries({ queryKey: ['statistics'] })
      queryClient.invalidateQueries({ queryKey: ['correctionHistory'] })
    },
  })
}

// ==================== Schema Queries ====================

/** 獲取星狀模型 Mermaid 圖 */
export function useSchemaMermaid(level: 'overview' | 'detailed' = 'overview') {
  return useQuery({
    queryKey: queryKeys.schemaMermaid(level),
    queryFn: () => getSchemaMermaid(level),
    staleTime: 5 * 60 * 1000, // 5 分鐘
  })
}

/** 獲取星狀模型統計 */
export function useSchemaStats() {
  return useQuery({
    queryKey: queryKeys.schemaStats,
    queryFn: getSchemaStats,
    staleTime: 5 * 60 * 1000, // 5 分鐘
  })
}

/** 刷新 Schema (Mutation) */
export function useRefreshSchema() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: refreshSchema,
    onSuccess: () => {
      // 成功後 invalidate schema 相關查詢
      queryClient.invalidateQueries({ queryKey: ['schemaMermaid'] })
      queryClient.invalidateQueries({ queryKey: ['schemaStats'] })
    },
  })
}

// ==================== Backup Log Queries ====================

/** 獲取每日備份列表 */
export function useDailyBackupList(params: {
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.dailyBackupList(params),
    queryFn: () => getDailyBackupList(params),
  })
}

/** 獲取每日備份詳情 */
export function useDailyBackupDetail(
  backupDate: string,
  params?: {
    records_limit?: number
    records_offset?: number
  }
) {
  return useQuery({
    queryKey: queryKeys.dailyBackupDetail(backupDate, params),
    queryFn: () => getDailyBackupDetail(backupDate, params),
    enabled: !!backupDate, // 只有有日期時才執行
  })
}
