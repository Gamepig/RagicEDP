import { useState, useMemo } from 'react'
import { Table, Card, Select, DatePicker, Space, Spin, Alert, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import { HistoryOutlined, CalendarOutlined } from '@ant-design/icons'
import { useCorrectionHistory, useTables } from '../hooks/useQueries'
import type { CorrectionHistory as CorrectionHistoryType } from '../services/api'

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

const { RangePicker } = DatePicker

function History() {
  const [selectedTable, setSelectedTable] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ])

  // 構建查詢參數
  const queryParams = useMemo(() => {
    const params: {
      table_code?: string
      date_from?: string
      date_to?: string
      limit: number
    } = { limit: 100 }

    if (selectedTable) {
      params.table_code = selectedTable
    }
    if (dateRange[0]) {
      params.date_from = dateRange[0].format('YYYY-MM-DD')
    }
    if (dateRange[1]) {
      params.date_to = dateRange[1].format('YYYY-MM-DD')
    }
    return params
  }, [selectedTable, dateRange])

  // React Query hooks
  const { data: tables = [] } = useTables()
  const { data: history = [], isLoading: loading, error } = useCorrectionHistory(queryParams)

  const handleTableChange = (value: string | undefined) => {
    setSelectedTable(value)
  }

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates || [null, null])
  }

  const columns: ColumnsType<CorrectionHistoryType> = [
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
      title: '修正時間',
      dataIndex: 'corrected_at',
      key: 'corrected_at',
      width: 180,
      render: (date: string) => (
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          {date ? new Date(date).toLocaleString('zh-TW') : '-'}
        </Text>
      ),
    },
    {
      title: '修正者',
      dataIndex: 'corrected_by',
      key: 'corrected_by',
      width: 100,
      render: (by: string) => (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
          color: '#3B82F6',
          border: 'none',
          fontWeight: 500,
        }}>
          {by || 'user'}
        </Tag>
      ),
    },
  ]

  if (error) {
    return <Alert type="error" message="載入修正歷史失敗" showIcon />
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          修正歷史
        </Title>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          查看已完成修正的資料記錄
        </Text>
      </div>

      <Card
        styles={{ body: { padding: '0' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <HistoryOutlined style={{ color: 'var(--color-accent)' }} />
            <span>歷史記錄</span>
          </div>
        }
        extra={
          <Space>
            <Select
              style={{ width: 150 }}
              placeholder="篩選表格"
              allowClear
              value={selectedTable}
              onChange={handleTableChange}
              options={tables.map((t) => ({
                value: t.code,
                label: t.name,
              }))}
            />
            <RangePicker
              onChange={handleDateChange}
              placeholder={['開始日期', '結束日期']}
              suffixIcon={<CalendarOutlined style={{ color: 'var(--color-accent)' }} />}
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={history}
            rowKey="record_id"
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total) => (
                <Text style={{ color: 'var(--color-text-muted)' }}>
                  共 <Text strong style={{ color: 'var(--color-accent)' }}>{total}</Text> 筆
                </Text>
              ),
            }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default History
