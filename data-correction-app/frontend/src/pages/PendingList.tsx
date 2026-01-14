import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Tag, Space, Button, Spin, Alert, Typography } from 'antd'
import { EyeOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { usePendingRecords, useTables } from '../hooks/useQueries'
import type { PendingRecord } from '../services/api'

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
  const [selectedTable, setSelectedTable] = useState<string | undefined>()
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  })

  // React Query hooks
  const { data: tables = [] } = useTables()
  const {
    data: recordsData,
    isLoading: loading,
    error,
  } = usePendingRecords({
    table_code: selectedTable,
    limit: pagination.pageSize,
    offset: (pagination.current - 1) * pagination.pageSize,
  })

  const records = recordsData?.records || []
  const total = recordsData?.total || 0

  const handleTableChange = useCallback((value: string | undefined) => {
    setSelectedTable(value)
    setPagination((prev) => ({ ...prev, current: 1 }))
  }, [])

  const handlePageChange = useCallback((page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.pageSize
    // 如果 pageSize 變了，重置到第一頁
    const newPage = pageSize && pageSize !== pagination.pageSize ? 1 : page
    setPagination({ current: newPage, pageSize: newPageSize })
  }, [pagination.pageSize])

  // 使用 useMemo 避免每次渲染重建 columns
  const columns: ColumnsType<PendingRecord> = useMemo(() => [
    {
      title: '記錄 ID',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 120,
      render: (id: string) => (
        <Text strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{id}</Text>
      ),
    },
    {
      title: '表格',
      dataIndex: 'table_code',
      key: 'table_code',
      width: 130,
      render: (code: string) => (
        <Tag className="badge badge-info" style={{ margin: 0 }}>
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
          className={`badge ${count > 0 ? 'badge-error' : 'badge-success'}`}
          style={{ margin: 0, minWidth: 32, justifyContent: 'center' }}
        >
          {count || 0}
        </Tag>
      ),
    },
    {
      title: 'AI 信心度',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 140,
      render: (score: number) => {
        const percent = Math.round(score * 100)
        const color = percent >= 80 ? '#22C55E' : percent >= 50 ? '#F59E0B' : '#EF4444'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="soft-inset" style={{
              width: 70,
              height: 8,
              borderRadius: 4,
              overflow: 'hidden',
              padding: 0,
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <Text style={{
              fontSize: 13,
              fontWeight: 600,
              color,
              fontFamily: 'var(--font-mono)',
            }}>
              {percent}%
            </Text>
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
        >
          查看
        </Button>
      ),
    },
  ], [navigate])

  if (error) {
    return <Alert type="error" message="載入待處理記錄失敗" showIcon />
  }

  return (
    <div className="animate-fade-up">
      {/* Page Header */}
      <div className="soft-card-static" style={{
        padding: '20px 24px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4, fontWeight: 700 }}>
              待處理清單
            </Title>
            <Text style={{ color: 'var(--color-text-muted)' }}>
              需要人工審核與修正的資料記錄
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag className="badge badge-warning" style={{ margin: 0 }}>
              {total} 筆待處理
            </Tag>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="soft-card-static" style={{
        padding: '16px 20px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FilterOutlined style={{ color: 'var(--color-accent)', fontSize: 16 }} />
            <Text style={{ fontWeight: 500, color: 'var(--color-text-heading)' }}>篩選條件</Text>
          </div>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder="選擇表格類型"
              allowClear
              value={selectedTable}
              onChange={handleTableChange}
              suffixIcon={<SearchOutlined />}
              options={tables.map((t) => ({
                value: t.code,
                label: t.name,
              }))}
            />
          </Space>
        </div>
      </div>

      {/* Table */}
      <div className="soft-card-static" style={{ overflow: 'hidden' }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={records}
            rowKey="record_id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              onChange: handlePageChange,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (t) => (
                <Text style={{ color: 'var(--color-text-muted)' }}>
                  共 <Text strong style={{ color: 'var(--color-accent)' }}>{t}</Text> 筆
                </Text>
              ),
              style: { padding: '16px 20px', margin: 0 },
            }}
            style={{ margin: 0 }}
          />
        </Spin>
      </div>
    </div>
  )
}

export default PendingList
