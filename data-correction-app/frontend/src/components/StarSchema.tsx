import { useEffect, useState, useRef } from 'react'
import { Card, Select, Spin, Row, Col, Alert, Button, Space, Tooltip, Typography, message } from 'antd'
import {
  TableOutlined,
  DatabaseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import mermaid from 'mermaid'
import DOMPurify from 'dompurify'
import { useSchemaMermaid, useSchemaStats, useRefreshSchema } from '../hooks/useQueries'

const { Text } = Typography

interface StarSchemaProps {
  level?: 'overview' | 'detailed'
}

function StarSchema({ level: initialLevel = 'overview' }: StarSchemaProps) {
  const [level, setLevel] = useState<'overview' | 'detailed'>(initialLevel)
  const diagramRef = useRef<HTMLDivElement>(null)

  // React Query hooks - 自動去重、快取、loading 狀態管理
  const {
    data: mermaidData,
    isLoading: mermaidLoading,
    error: mermaidError,
  } = useSchemaMermaid(level)

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useSchemaStats()

  const refreshMutation = useRefreshSchema()

  // 組合 loading 和 error 狀態
  const loading = mermaidLoading || statsLoading
  const error = mermaidError || statsError
  const mermaidCode = mermaidData?.mermaid || ''
  const lastUpdatedAt = stats?.last_updated_at || mermaidData?.last_updated_at || null

  // 初始化 Mermaid（設定 securityLevel 防止 XSS）
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      er: {
        useMaxWidth: false,
        layoutDirection: 'TB',
        minEntityWidth: 100,
        minEntityHeight: 75,
        entityPadding: 15,
      },
    })
  }, [])

  // 渲染 Mermaid 圖表（使用 DOMPurify 防止 XSS）
  useEffect(() => {
    if (mermaidCode && diagramRef.current) {
      const renderDiagram = async () => {
        try {
          // 使用 textContent 清空比 innerHTML 更安全
          diagramRef.current!.textContent = ''
          const diagramId = `star-schema-${level}-${Date.now()}`
          const { svg } = await mermaid.render(diagramId, mermaidCode)
          // 使用 DOMPurify sanitize SVG 防止 XSS
          diagramRef.current!.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          })
        } catch (err) {
          console.error('Mermaid 渲染失敗', err)
        }
      }
      renderDiagram()
    }
  }, [mermaidCode, level])

  // 刷新處理 - 使用 mutation
  const handleRefresh = () => {
    refreshMutation.mutate(undefined, {
      onSuccess: (res) => {
        message.success(res.message)
      },
      onError: () => {
        message.error('刷新失敗，請稍後再試')
      },
    })
  }

  const handleLevelChange = (value: 'overview' | 'detailed') => {
    setLevel(value)
  }

  // 格式化更新時間
  const formatUpdatedTime = (timestamp: number | null): string => {
    if (!timestamp) return '未知'
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (error) {
    return <Alert type="error" message="載入星狀模型失敗" showIcon />
  }

  const statCards = [
    {
      title: '總表格數',
      value: stats?.total_tables || 0,
      icon: <TableOutlined />,
      color: '#7C3AED',
    },
    {
      title: '總記錄數',
      value: stats?.total_records || 0,
      icon: <DatabaseOutlined />,
      color: '#2563EB',
      format: true,
    },
    {
      title: '事實表',
      value: Object.keys(stats?.fact_tables || {}).length,
      icon: <AppstoreOutlined />,
      color: '#D97706',
    },
    {
      title: '維度表',
      value: Object.keys(stats?.dim_tables || {}).length,
      icon: <ClusterOutlined />,
      color: '#16A34A',
    },
  ]

  return (
    <div>
      {/* Stats Cards */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {statCards.map((item) => (
          <Col xs={12} sm={6} key={item.title}>
            <Card
              className="stat-card"
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: 6,
                  }}>
                    {item.title}
                  </Text>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: item.color,
                    lineHeight: 1,
                  }}>
                    {item.format ? item.value.toLocaleString() : item.value}
                  </div>
                </div>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  background: `${item.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: item.color,
                }}>
                  {item.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Diagram Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClusterOutlined style={{ color: 'var(--color-accent)' }} />
            <span>星狀模型圖</span>
          </div>
        }
        extra={
          <Space size="middle">
            {/* 上次更新時間 */}
            <Tooltip title="上次從 BigQuery 獲取的時間">
              <Space size={4} style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                <ClockCircleOutlined />
                <span>{formatUpdatedTime(lastUpdatedAt)}</span>
              </Space>
            </Tooltip>

            {/* 刷新按鈕 */}
            <Tooltip title="從 BigQuery 重新獲取最新表結構">
              <Button
                icon={<ReloadOutlined spin={refreshMutation.isPending} />}
                onClick={handleRefresh}
                loading={refreshMutation.isPending}
                disabled={loading}
              >
                刷新
              </Button>
            </Tooltip>

            {/* 視圖選擇 */}
            <Select
              value={level}
              onChange={handleLevelChange}
              style={{ width: 120 }}
              options={[
                { value: 'overview', label: '概覽' },
                { value: 'detailed', label: '詳細' },
              ]}
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={5}
            centerOnInit
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div style={{
                  marginBottom: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                    滾輪縮放 | 拖曳平移
                  </Text>
                  <Space>
                    <Tooltip title="放大">
                      <Button
                        icon={<ZoomInOutlined />}
                        onClick={() => zoomIn()}
                        style={{ borderRadius: 8 }}
                      />
                    </Tooltip>
                    <Tooltip title="縮小">
                      <Button
                        icon={<ZoomOutOutlined />}
                        onClick={() => zoomOut()}
                        style={{ borderRadius: 8 }}
                      />
                    </Tooltip>
                    <Tooltip title="重置">
                      <Button
                        icon={<ExpandOutlined />}
                        onClick={() => resetTransform()}
                        style={{ borderRadius: 8 }}
                      />
                    </Tooltip>
                  </Space>
                </div>
                <TransformComponent
                  wrapperStyle={{
                    width: '100%',
                    height: 500,
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    cursor: 'grab',
                  }}
                >
                  <div
                    ref={diagramRef}
                    style={{
                      padding: 20,
                    }}
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </Spin>
      </Card>
    </div>
  )
}

export default StarSchema
