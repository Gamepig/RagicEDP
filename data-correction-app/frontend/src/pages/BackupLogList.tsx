import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Card, DatePicker, Space, Spin, Alert, Tag, Typography, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import {
  CloudServerOutlined,
  CalendarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useDailyBackupList } from '../hooks/useQueries'
import type { DailyBackupSummary } from '../services/api'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function BackupLogList() {
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  })

  // 構建查詢參數
  const queryParams = useMemo(() => {
    const params: {
      date_from?: string
      date_to?: string
      limit: number
      offset: number
    } = {
      limit: pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }

    if (dateRange[0]) {
      params.date_from = dateRange[0].format('YYYY-MM-DD')
    }
    if (dateRange[1]) {
      params.date_to = dateRange[1].format('YYYY-MM-DD')
    }
    return params
  }, [dateRange, pagination])

  // React Query hook
  const { data: backupData, isLoading: loading, error } = useDailyBackupList(queryParams)

  const records = backupData?.records || []
  const total = backupData?.total || 0

  const handleDateChange = useCallback((dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates || [null, null])
    setPagination((prev) => ({ ...prev, current: 1 }))
  }, [])

  const handlePageChange = useCallback((page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.pageSize
    const newPage = pageSize && pageSize !== pagination.pageSize ? 1 : page
    setPagination({ current: newPage, pageSize: newPageSize })
  }, [pagination.pageSize])

  const columns: ColumnsType<DailyBackupSummary> = [
    {
      title: '備份日期',
      dataIndex: 'backup_date',
      key: 'backup_date',
      width: 120,
      render: (date: string) => (
        <Text strong style={{ fontFamily: 'var(--font-display)' }}>{date}</Text>
      ),
    },
    {
      title: '備份數',
      dataIndex: 'total_fetched',
      key: 'total_fetched',
      width: 100,
      render: (count: number) => (
        <Tag style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
          color: '#3B82F6',
          border: 'none',
          fontWeight: 600,
        }}>
          {count.toLocaleString()}
        </Tag>
      ),
    },
    {
      title: '自動修正',
      key: 'auto_fixed',
      width: 100,
      render: (_, record) => {
        const total = record.auto_fixed + record.ai_fixed
        return (
          <Space size={4}>
            <ToolOutlined style={{ color: '#10B981' }} />
            <Text style={{ color: '#10B981', fontWeight: 500 }}>{total}</Text>
          </Space>
        )
      },
    },
    {
      title: '需人工',
      dataIndex: 'manual_required',
      key: 'manual_required',
      width: 100,
      render: (count: number) => (
        <Space size={4}>
          <ExclamationCircleOutlined style={{ color: count > 0 ? '#F59E0B' : '#9CA3AF' }} />
          <Text style={{ color: count > 0 ? '#F59E0B' : '#9CA3AF', fontWeight: 500 }}>
            {count}
          </Text>
        </Space>
      ),
    },
    {
      title: '備份狀態',
      key: 'status',
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          <CheckCircleOutlined style={{ color: '#10B981' }} />
          <Text style={{ color: '#10B981' }}>{record.success_count}</Text>
          {record.failed_count > 0 && (
            <>
              <span style={{ color: 'var(--color-border)' }}>/</span>
              <ExclamationCircleOutlined style={{ color: '#EF4444' }} />
              <Text style={{ color: '#EF4444' }}>{record.failed_count}</Text>
            </>
          )}
        </Space>
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
          onClick={() => navigate(`/backup-logs/${record.backup_date}`)}
          style={{ borderRadius: 8 }}
        >
          詳情
        </Button>
      ),
    },
  ]

  if (error) {
    return <Alert type="error" message="載入備份記錄失敗" showIcon />
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          每日備份記錄
        </Title>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          查看每日資料備份與清洗處理狀態
        </Text>
      </div>

      <Card
        styles={{ body: { padding: '0' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <CloudServerOutlined style={{ color: 'var(--color-accent)' }} />
            <span>備份記錄</span>
          </div>
        }
        extra={
          <RangePicker
            onChange={handleDateChange}
            placeholder={['開始日期', '結束日期']}
            suffixIcon={<CalendarOutlined style={{ color: 'var(--color-accent)' }} />}
          />
        }
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={records}
            rowKey="backup_date"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              onChange: handlePageChange,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (t) => (
                <Text style={{ color: 'var(--color-text-muted)' }}>
                  共 <Text strong style={{ color: 'var(--color-accent)' }}>{t}</Text> 天
                </Text>
              ),
            }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default BackupLogList
