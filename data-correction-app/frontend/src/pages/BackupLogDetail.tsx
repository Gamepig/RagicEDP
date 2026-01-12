import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Typography,
  Statistic,
  Collapse,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
  RobotOutlined,
  DatabaseOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import {
  getDailyBackupDetail,
  type DailyBackupDetailResponse,
  type SheetBackupDetail,
  type CleaningStatsByTable,
  type FixedRecordSummary,
} from '../services/api'

const { Title, Text } = Typography

// 表格名稱對照
const TABLE_NAMES: Record<string, string> = {
  '10': '品牌表',
  '20': '通路表',
  '30': '金流表',
  '40': '物流表',
  '41': '郵遞區號表',
  '50': '訂單表',
  '60': '客戶表',
  '70': '商品表',
  '80': '活動管理表',
  '99': '訂單明細表',
}

/**
 * 解析錯誤訊息，產生使用者友善的說明
 */
function parseErrorMessage(errorMessage: string, sheetName: string): {
  userMessage: string
  technicalDetail: string
} {
  const msg = errorMessage.toLowerCase()

  // 表格不存在
  if (msg.includes('not found') && msg.includes('table')) {
    return {
      userMessage: `「${sheetName}」的目標資料表尚未建立，請聯繫系統管理員處理。`,
      technicalDetail: errorMessage,
    }
  }

  // 權限不足
  if (msg.includes('permission') || msg.includes('access denied') || msg.includes('403')) {
    return {
      userMessage: `備份服務沒有權限存取「${sheetName}」的資料表，請檢查服務帳號權限設定。`,
      technicalDetail: errorMessage,
    }
  }

  // 連線逾時
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      userMessage: `備份「${sheetName}」時連線逾時，可能是網路問題或資料量過大，系統會自動重試。`,
      technicalDetail: errorMessage,
    }
  }

  // API 限流
  if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('429')) {
    return {
      userMessage: `備份「${sheetName}」時超過 API 使用限制，請稍後再試或聯繫管理員調整配額。`,
      technicalDetail: errorMessage,
    }
  }

  // 資料格式錯誤
  if (msg.includes('invalid') || msg.includes('schema') || msg.includes('type mismatch')) {
    return {
      userMessage: `「${sheetName}」的資料格式與目標表格不符，可能是欄位結構有變更。`,
      technicalDetail: errorMessage,
    }
  }

  // 服務不可用
  if (msg.includes('unavailable') || msg.includes('503') || msg.includes('500')) {
    return {
      userMessage: `備份服務暫時無法使用，請稍後再試。`,
      technicalDetail: errorMessage,
    }
  }

  // 預設訊息
  return {
    userMessage: `備份「${sheetName}」時發生錯誤，請聯繫系統管理員查看詳情。`,
    technicalDetail: errorMessage,
  }
}

function BackupLogDetail() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DailyBackupDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordsPagination, setRecordsPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  })

  const fetchDetail = async (recordsPage = 1) => {
    if (!date) return
    setLoading(true)
    try {
      const data = await getDailyBackupDetail(date, {
        records_limit: recordsPagination.pageSize,
        records_offset: (recordsPage - 1) * recordsPagination.pageSize,
      })
      setDetail(data)
      setRecordsPagination((prev) => ({
        ...prev,
        current: recordsPage,
        total: data.fixed_records_total,
      }))
    } catch (err) {
      setError('載入備份詳情失敗')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [date])

  const handleRecordsPageChange = (page: number) => {
    fetchDetail(page)
  }

  // 備份日誌表格欄位
  const logColumns: ColumnsType<SheetBackupDetail> = [
    {
      title: '表格',
      dataIndex: 'sheet_name',
      key: 'sheet_name',
      width: 120,
      render: (name: string, record) => (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          color: '#8B5CF6',
          border: 'none',
          fontWeight: 500,
        }}>
          {name || TABLE_NAMES[record.sheet_code] || record.sheet_code}
        </Tag>
      ),
    },
    {
      title: '抓取',
      dataIndex: 'records_fetched',
      key: 'records_fetched',
      width: 80,
      align: 'right',
    },
    {
      title: '新增',
      dataIndex: 'records_inserted',
      key: 'records_inserted',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#10B981' : 'inherit' }}>{count}</Text>
      ),
    },
    {
      title: '更新',
      dataIndex: 'records_updated',
      key: 'records_updated',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#3B82F6' : 'inherit' }}>{count}</Text>
      ),
    },
    {
      title: '過濾',
      dataIndex: 'records_filtered',
      key: 'records_filtered',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#F59E0B' : 'inherit' }}>{count}</Text>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
          success: { color: '#10B981', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: '#EF4444', icon: <CloseCircleOutlined />, text: '失敗' },
          skipped: { color: '#9CA3AF', icon: <ExclamationCircleOutlined />, text: '跳過' },
        }
        const { color, icon, text } = config[status] || { color: '#9CA3AF', icon: null, text: status }

        return (
          <Space size={4}>
            {icon}
            <Text style={{ color }}>{text}</Text>
          </Space>
        )
      },
    },
    {
      title: '耗時',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 80,
      render: (seconds: number) => (
        <Text style={{ color: 'var(--color-text-muted)' }}>
          {seconds.toFixed(1)}s
        </Text>
      ),
    },
  ]

  // 清洗統計表格欄位
  const cleaningColumns: ColumnsType<CleaningStatsByTable> = [
    {
      title: '表格',
      dataIndex: 'table_name',
      key: 'table_name',
      width: 120,
      render: (name: string, record) => (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          color: '#8B5CF6',
          border: 'none',
          fontWeight: 500,
        }}>
          {name || TABLE_NAMES[record.table_code] || record.table_code}
        </Tag>
      ),
    },
    {
      title: '總數',
      dataIndex: 'total_records',
      key: 'total_records',
      width: 80,
      align: 'right',
    },
    {
      title: '自動修正',
      dataIndex: 'auto_fixed',
      key: 'auto_fixed',
      width: 90,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#10B981' : 'inherit' }}>{count}</Text>
      ),
    },
    {
      title: 'AI 修正',
      dataIndex: 'ai_fixed',
      key: 'ai_fixed',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#7C3AED' : 'inherit' }}>{count}</Text>
      ),
    },
    {
      title: '需人工',
      dataIndex: 'manual',
      key: 'manual',
      width: 80,
      align: 'right',
      render: (count: number) => (
        <Text style={{ color: count > 0 ? '#F59E0B' : 'inherit', fontWeight: count > 0 ? 600 : 400 }}>
          {count}
        </Text>
      ),
    },
  ]

  // 修正記錄表格欄位
  const recordsColumns: ColumnsType<FixedRecordSummary> = [
    {
      title: '記錄 ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 120,
      render: (id: string) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/pending/${id}`)}
          style={{ padding: 0, fontFamily: 'var(--font-display)' }}
        >
          {id}
        </Button>
      ),
    },
    {
      title: '表格',
      dataIndex: 'table_code',
      key: 'table_code',
      width: 100,
      render: (code: string) => (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          color: '#8B5CF6',
          border: 'none',
          fontWeight: 500,
        }}>
          {TABLE_NAMES[code] || code}
        </Tag>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode }> = {
          auto_fixed: { color: '#10B981', icon: <ToolOutlined /> },
          ai_fixed: { color: '#7C3AED', icon: <RobotOutlined /> },
          manual: { color: '#F59E0B', icon: <ExclamationCircleOutlined /> },
          completed: { color: '#3B82F6', icon: <CheckCircleOutlined /> },
        }
        const { color, icon } = config[status] || { color: '#9CA3AF', icon: null }

        return (
          <Space size={4}>
            {icon}
            <Text style={{ color }}>{status}</Text>
          </Space>
        )
      },
    },
    {
      title: '違規數',
      dataIndex: 'violation_count',
      key: 'violation_count',
      width: 80,
      render: (count: number) => (
        <Tag color={count > 0 ? 'red' : 'green'}>{count}</Tag>
      ),
    },
    {
      title: '清洗時間',
      dataIndex: 'cleaned_at',
      key: 'cleaned_at',
      width: 160,
      render: (time: string) => (
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          {time ? new Date(time).toLocaleString('zh-TW') : '-'}
        </Text>
      ),
    },
  ]

  if (loading && !detail) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !detail) {
    return <Alert type="error" message={error || '記錄不存在'} />
  }

  const { summary, sheet_logs, cleaning_stats, fixed_records } = detail

  return (
    <div>
      {/* 返回按鈕 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/backup-logs')}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        返回列表
      </Button>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          {date} 備份詳情
        </Title>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          查看當日備份執行詳情與清洗統計
        </Text>
      </div>

      {/* 統計卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="備份筆數"
              value={summary.total_fetched}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#3B82F6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="自動修正"
              value={summary.auto_fixed + summary.ai_fixed}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#10B981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="需人工處理"
              value={summary.manual_required}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: summary.manual_required > 0 ? '#F59E0B' : '#9CA3AF' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="備份狀態"
              value={`${summary.success_count} / ${summary.success_count + summary.failed_count}`}
              prefix={summary.failed_count > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              valueStyle={{ color: summary.failed_count > 0 ? '#F59E0B' : '#10B981' }}
              suffix="表"
            />
          </Card>
        </Col>
      </Row>

      {/* 備份日誌 */}
      <Card
        title={
          <Space>
            <DatabaseOutlined style={{ color: 'var(--color-accent)' }} />
            <span>備份執行日誌</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={logColumns}
          dataSource={sheet_logs}
          rowKey="sheet_code"
          pagination={false}
          size="small"
          expandable={{
            expandedRowRender: (record) => {
              if (!record.error_message) return null
              const sheetName = record.sheet_name || TABLE_NAMES[record.sheet_code] || record.sheet_code
              const { userMessage, technicalDetail } = parseErrorMessage(record.error_message, sheetName)
              return (
                <Alert
                  type="error"
                  message={userMessage}
                  description={
                    <Collapse
                      ghost
                      size="small"
                      items={[{
                        key: 'technical',
                        label: (
                          <Space size={4}>
                            <CodeOutlined />
                            <span style={{ fontSize: 12 }}>技術細節（供工程師除錯）</span>
                          </Space>
                        ),
                        children: (
                          <pre style={{
                            fontSize: 11,
                            margin: 0,
                            padding: 8,
                            background: 'var(--color-surface)',
                            borderRadius: 4,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}>
                            {technicalDetail}
                          </pre>
                        ),
                      }]}
                    />
                  }
                />
              )
            },
            rowExpandable: (record) => !!record.error_message,
          }}
        />
      </Card>

      {/* 清洗統計 */}
      {cleaning_stats.length > 0 && (
        <Card
          title={
            <Space>
              <ToolOutlined style={{ color: 'var(--color-accent)' }} />
              <span>清洗統計（按表）</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Table
            columns={cleaningColumns}
            dataSource={cleaning_stats}
            rowKey="table_code"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 修正記錄 */}
      {fixed_records.length > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: 'var(--color-accent)' }} />
              <span>修正記錄</span>
              <Tag>{recordsPagination.total} 筆</Tag>
            </Space>
          }
        >
          <Spin spinning={loading}>
            <Table
              columns={recordsColumns}
              dataSource={fixed_records}
              rowKey="record_id"
              pagination={{
                ...recordsPagination,
                onChange: handleRecordsPageChange,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 筆`,
              }}
              size="small"
            />
          </Spin>
        </Card>
      )}
    </div>
  )
}

export default BackupLogDetail
