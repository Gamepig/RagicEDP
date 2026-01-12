import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, Select, Tag, Space, Button, Spin, Alert, Typography } from 'antd'
import { EyeOutlined, FilterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getPendingRecords,
  getTables,
  type PendingRecord,
  type TableInfo,
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

function PendingList() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<PendingRecord[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | undefined>()
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  // 請求計數器，用於防止競態條件
  const requestIdRef = useRef(0)

  const fetchRecords = useCallback(async (page = 1, tableCode?: string, pageSize = 20) => {
    const currentRequestId = ++requestIdRef.current
    setLoading(true)
    try {
      const data = await getPendingRecords({
        table_code: tableCode,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      // 只有最新的請求才更新狀態
      if (currentRequestId === requestIdRef.current) {
        setRecords(data.records)
        setPagination((prev) => ({
          ...prev,
          current: page,
          pageSize,
          total: data.total,
        }))
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setError('載入待處理記錄失敗')
        console.error(err)
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const data = await getTables()
        setTables(data)
      } catch (err) {
        console.error('載入表格列表失敗', err)
      }
    }
    fetchTables()
    fetchRecords(1, undefined, pagination.pageSize)
  }, [fetchRecords, pagination.pageSize])

  const handleTableChange = useCallback((value: string | undefined) => {
    setSelectedTable(value)
    setPagination((prev) => ({ ...prev, current: 1 }))
    fetchRecords(1, value, pagination.pageSize)
  }, [fetchRecords, pagination.pageSize])

  const handlePageChange = useCallback((page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.pageSize
    // 如果 pageSize 變了，重置到第一頁
    const newPage = pageSize && pageSize !== pagination.pageSize ? 1 : page
    fetchRecords(newPage, selectedTable, newPageSize)
  }, [fetchRecords, selectedTable, pagination.pageSize])

  // 使用 useMemo 避免每次渲染重建 columns
  const columns: ColumnsType<PendingRecord> = useMemo(() => [
    {
      title: '記錄 ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 120,
      render: (id: string) => (
        <Text strong style={{ fontFamily: 'var(--font-display)' }}>{id}</Text>
      ),
    },
    {
      title: '表格',
      dataIndex: 'table_code',
      key: 'table_code',
      width: 120,
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
      title: '違規數',
      dataIndex: 'violation_count',
      key: 'violation_count',
      width: 100,
      render: (count: number) => (
        <Tag
          style={{
            background: count > 0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
            color: count > 0 ? '#EF4444' : '#10B981',
            border: 'none',
            fontWeight: 600,
            minWidth: 32,
            textAlign: 'center',
          }}
        >
          {count || 0}
        </Tag>
      ),
    },
    {
      title: 'AI 信心度',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 120,
      render: (score: number) => {
        const percent = Math.round(score * 100)
        const color = percent >= 80 ? '#10B981' : percent >= 50 ? '#F59E0B' : '#EF4444'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 60,
              height: 6,
              background: 'var(--color-bg-secondary)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: color,
                borderRadius: 3,
              }} />
            </div>
            <Text style={{ fontSize: 13, fontWeight: 500, color }}>{percent}%</Text>
          </div>
        )
      },
    },
    {
      title: '清洗時間',
      dataIndex: 'cleaned_at',
      key: 'cleaned_at',
      width: 180,
      render: (date: string) => (
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          {date ? new Date(date).toLocaleString('zh-TW') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/pending/${record.record_id}`)}
          style={{ borderRadius: 8 }}
        >
          查看
        </Button>
      ),
    },
  ], [navigate])

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          待處理清單
        </Title>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          需要人工審核與修正的資料記錄
        </Text>
      </div>

      <Card
        styles={{ body: { padding: '0' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <FilterOutlined style={{ color: 'var(--color-accent)' }} />
            <span>篩選條件</span>
          </div>
        }
        extra={
          <Space>
            <Select
              style={{ width: 180 }}
              placeholder="選擇表格類型"
              allowClear
              value={selectedTable}
              onChange={handleTableChange}
              options={tables.map((t) => ({
                value: t.code,
                label: t.name,
              }))}
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={records}
            rowKey="record_id"
            pagination={{
              ...pagination,
              onChange: handlePageChange,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => (
                <Text style={{ color: 'var(--color-text-muted)' }}>
                  共 <Text strong style={{ color: 'var(--color-accent)' }}>{total}</Text> 筆
                </Text>
              ),
            }}
            style={{ margin: 0 }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default PendingList
