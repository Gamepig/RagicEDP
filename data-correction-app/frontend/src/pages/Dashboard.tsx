import { Card, Row, Col, Spin, Alert, Typography, Progress } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useStatistics } from '../hooks/useQueries'

const { Title, Text } = Typography

function Dashboard() {
  const { data: stats, isLoading: loading, error } = useStatistics()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message="載入統計資訊失敗" showIcon />
  }

  // 已完成 = completed + auto_fixed + ai_fixed（所有已處理的記錄）
  const completedTotal = (stats?.completed || 0) + (stats?.auto_fixed || 0) + (stats?.ai_fixed || 0)
  // 待處理 = manual（需要人工處理的記錄）
  const pendingTotal = stats?.manual || 0
  // 總數 = 已完成 + 待處理
  const total = completedTotal + pendingTotal
  // 完成率 = 已完成 / 總數
  const completionRate = total > 0 ? Math.round((completedTotal / total) * 100) : 0

  const statCards = [
    {
      title: '待人工處理',
      value: stats?.manual || 0,
      icon: <ExclamationCircleOutlined />,
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: '已完成',
      value: stats?.completed || 0,
      icon: <CheckCircleOutlined />,
      color: '#22C55E',
      bgColor: 'rgba(34, 197, 94, 0.1)',
    },
    {
      title: '自動修正',
      value: stats?.auto_fixed || 0,
      icon: <ThunderboltOutlined />,
      color: '#3B82F6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
    },
    {
      title: 'AI 修正',
      value: stats?.ai_fixed || 0,
      icon: <RobotOutlined />,
      color: '#8B5CF6',
      bgColor: 'rgba(139, 92, 246, 0.1)',
    },
  ]

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
              統計總覽
            </Title>
            <Text style={{ color: 'var(--color-text-muted)' }}>
              資料清洗與修正的即時狀態一覽
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="status-dot healthy status-pulse" />
            <Text style={{ color: 'var(--color-success)', fontSize: 13, fontWeight: 500 }}>
              系統正常運行
            </Text>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        {statCards.map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={item.title}>
            <div
              className={`soft-card animate-fade-up stagger-${index + 1}`}
              style={{ padding: 20 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                    display: 'block',
                    marginBottom: 8,
                  }}>
                    {item.title}
                  </Text>
                  <div style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: item.color,
                    lineHeight: 1,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {item.value.toLocaleString()}
                  </div>
                </div>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: item.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: item.color,
                }}>
                  {item.icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Progress Overview */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card className="soft-card animate-fade-up stagger-5">
            <Title level={5} style={{ marginBottom: 24, fontWeight: 600 }}>
              處理進度
            </Title>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={completionRate}
                size={180}
                strokeColor={{
                  '0%': '#3B82F6',
                  '100%': '#22C55E',
                }}
                trailColor="var(--color-inset-bg)"
                strokeWidth={10}
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-text-heading)' }}>
                      {percent}%
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      完成率
                    </div>
                  </div>
                )}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 48,
              marginTop: 24,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#22C55E',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {completedTotal}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>已完成</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#F59E0B',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {pendingTotal}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>待處理</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="soft-card animate-fade-up stagger-5">
            <Title level={5} style={{ marginBottom: 24, fontWeight: 600 }}>
              修正來源分佈
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: '自動修正', value: stats?.auto_fixed || 0, color: '#3B82F6', total },
                { label: 'AI 修正', value: stats?.ai_fixed || 0, color: '#8B5CF6', total },
                { label: '人工修正', value: stats?.completed || 0, color: '#22C55E', total },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: item.color,
                      }} />
                      <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{item.label}</Text>
                    </div>
                    <Text style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--color-text-heading)',
                      fontFamily: 'var(--font-sans)',
                    }}>
                      {item.value.toLocaleString()}
                    </Text>
                  </div>
                  <div className="soft-inset" style={{
                    height: 10,
                    borderRadius: 5,
                    overflow: 'hidden',
                    padding: 0,
                  }}>
                    <div style={{
                      width: `${item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)`,
                      borderRadius: 5,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
