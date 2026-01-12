import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin, Alert, Typography, Progress } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { getStatistics, type Statistics } from '../services/api'

const { Title, Text } = Typography

function Dashboard() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getStatistics()
        setStats(data)
      } catch (err) {
        setError('載入統計資訊失敗')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

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
    return <Alert type="error" message={error} showIcon />
  }

  const total = (stats?.completed || 0) + (stats?.manual || 0) + (stats?.auto_fixed || 0) + (stats?.ai_fixed || 0)
  const completionRate = total > 0 ? Math.round(((stats?.completed || 0) / total) * 100) : 0

  const statCards = [
    {
      title: '待人工處理',
      value: stats?.manual || 0,
      icon: <ExclamationCircleOutlined />,
      color: '#D97706',
    },
    {
      title: '已完成',
      value: stats?.completed || 0,
      icon: <CheckCircleOutlined />,
      color: '#16A34A',
    },
    {
      title: '自動修正',
      value: stats?.auto_fixed || 0,
      icon: <ThunderboltOutlined />,
      color: '#2563EB',
    },
    {
      title: 'AI 修正',
      value: stats?.ai_fixed || 0,
      icon: <RobotOutlined />,
      color: '#7C3AED',
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4, fontWeight: 700 }}>
          統計總覽
        </Title>
        <Text style={{ color: 'var(--color-text-muted)' }}>
          資料清洗與修正的即時狀態一覽
        </Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        {statCards.map((item) => (
          <Col xs={24} sm={12} lg={6} key={item.title}>
            <Card className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                    display: 'block',
                    marginBottom: 4,
                  }}>
                    {item.title}
                  </Text>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: item.color,
                    lineHeight: 1,
                  }}>
                    {item.value.toLocaleString()}
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

      {/* Progress Overview */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card>
            <Title level={5} style={{ marginBottom: 20, fontWeight: 600 }}>
              處理進度
            </Title>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={completionRate}
                size={160}
                strokeColor="#2563EB"
                trailColor="var(--color-border)"
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>
                      {percent}%
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      完成率
                    </div>
                  </div>
                )}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 32,
              marginTop: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16A34A' }}>
                  {stats?.completed || 0}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>已完成</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#D97706' }}>
                  {stats?.manual || 0}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>待處理</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <Title level={5} style={{ marginBottom: 20, fontWeight: 600 }}>
              修正來源分佈
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: '自動修正', value: stats?.auto_fixed || 0, color: '#2563EB', total },
                { label: 'AI 修正', value: stats?.ai_fixed || 0, color: '#7C3AED', total },
                { label: '人工修正', value: stats?.completed || 0, color: '#16A34A', total },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <Text style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{item.label}</Text>
                    <Text style={{ fontWeight: 600, fontSize: 13 }}>{item.value.toLocaleString()}</Text>
                  </div>
                  <Progress
                    percent={item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}
                    showInfo={false}
                    strokeColor={item.color}
                    trailColor="var(--color-border)"
                    size={{ height: 8 }}
                  />
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
