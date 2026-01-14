import axios from 'axios'

// 認證配置 - 使用環境變數或預設值
const API_KEY = import.meta.env.VITE_API_KEY || 'ragic-correction-2026'
const USER_ID = import.meta.env.VITE_USER_ID || 'admin'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'X-API-Key': API_KEY,
    'X-User-ID': USER_ID,
  },
})

// 添加時間戳參數防止快取
api.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    _t: Date.now(),
  }
  return config
})

// 型別定義
export interface PendingRecord {
  record_id: string
  table_code: string
  original_values: Record<string, unknown> | null
  fixed_values: Record<string, unknown> | null
  violation_count: number
  ai_suggestion: string | null
  confidence_score: number
  cleaned_at: string | null
}

export interface Violation {
  rule_id: string
  rule_type: string
  field: string
  before: string | null
  after: string | null
  severity: string
  reason: string
  auto_fixable: boolean
}

export interface RecordDetail extends PendingRecord {
  status: string
  violations?: Violation[]
}

export interface PaginatedResponse {
  records: PendingRecord[]
  total: number
  limit: number
  offset: number
}

export interface Statistics {
  pending: number
  manual: number
  completed: number
  auto_fixed: number
  ai_fixed: number
}

export interface CorrectionHistory {
  record_id: string
  table_code: string
  original_values: Record<string, unknown> | null
  fixed_values: Record<string, unknown> | null
  corrected_at: string | null
  corrected_by: string | null
}

export interface TableInfo {
  code: string
  name: string
  bq_table: string
}

// API 函數
export async function getPendingRecords(params: {
  table_code?: string
  limit?: number
  offset?: number
}): Promise<PaginatedResponse> {
  const response = await api.get('/data/pending', { params })
  return response.data
}

export async function getRecordDetail(recordId: string): Promise<RecordDetail> {
  const response = await api.get(`/data/pending/${recordId}`)
  return response.data
}

export async function getStatistics(): Promise<Statistics> {
  const response = await api.get('/data/statistics')
  return response.data
}

export async function getTables(): Promise<TableInfo[]> {
  const response = await api.get('/data/tables')
  return response.data
}

export async function submitCorrection(data: {
  record_id: string
  fixed_values: Record<string, unknown>
  corrected_by?: string
}): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/corrections/submit', data)
  return response.data
}

export async function getCorrectionHistory(params: {
  table_code?: string
  date_from?: string
  date_to?: string
  limit?: number
}): Promise<CorrectionHistory[]> {
  const response = await api.get('/corrections/history', { params })
  return response.data
}

// 星狀模型 API
export interface SchemaStats {
  fact_tables: Record<string, { name: string; count: number; error?: string }>
  dim_tables: Record<string, { name: string; count: number; error?: string }>
  total_records: number
  total_tables: number
  last_updated_at?: number
}

export interface MermaidResponse {
  mermaid: string
  level: string
  last_updated_at?: number
}

export interface CacheStatus {
  cached: boolean
  age_seconds?: number
  ttl_seconds: number
  last_updated_at?: number
}

export interface RefreshResponse {
  success: boolean
  message: string
  last_updated_at: number
}

export async function getSchemaMermaid(
  level: 'overview' | 'detailed' = 'overview'
): Promise<MermaidResponse> {
  const response = await api.get('/schema/mermaid', { params: { level } })
  return response.data
}

export async function getSchemaStats(): Promise<SchemaStats> {
  const response = await api.get('/schema/stats')
  return response.data
}

export async function refreshSchema(): Promise<RefreshResponse> {
  const response = await api.post('/schema/refresh')
  return response.data
}

export async function getSchemaCacheStatus(): Promise<CacheStatus> {
  const response = await api.get('/schema/cache')
  return response.data
}

// ========================================
// 備份日誌相關型別
// ========================================

export interface DailyBackupSummary {
  backup_date: string
  total_fetched: number
  auto_fixed: number
  ai_fixed: number
  manual_required: number
  success_count: number
  failed_count: number
}

export interface DailyBackupListResponse {
  records: DailyBackupSummary[]
  total: number
  limit: number
  offset: number
}

export interface SheetBackupDetail {
  sheet_code: string
  sheet_name: string
  records_fetched: number
  records_inserted: number
  records_updated: number
  records_filtered: number
  status: string
  error_message: string | null
  duration_seconds: number
  backup_time: string | null
}

export interface CleaningStatsByTable {
  table_code: string
  table_name: string
  total_records: number
  auto_fixed: number
  ai_fixed: number
  manual: number
  completed: number
  failed: number
}

export interface FixedRecordSummary {
  record_id: string
  table_code: string
  status: string
  violation_count: number
  confidence_score: number | null
  cleaned_at: string | null
}

export interface DailyBackupDetailResponse {
  backup_date: string
  summary: DailyBackupSummary
  sheet_logs: SheetBackupDetail[]
  cleaning_stats: CleaningStatsByTable[]
  fixed_records: FixedRecordSummary[]
  fixed_records_total: number
}

// ========================================
// 備份日誌 API 函數
// ========================================

export async function getDailyBackupList(params: {
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}): Promise<DailyBackupListResponse> {
  const response = await api.get('/backup-logs/daily', { params })
  return response.data
}

export async function getDailyBackupDetail(
  backupDate: string,
  params?: {
    records_limit?: number
    records_offset?: number
  }
): Promise<DailyBackupDetailResponse> {
  const response = await api.get(`/backup-logs/daily/${backupDate}`, { params })
  return response.data
}

export default api
