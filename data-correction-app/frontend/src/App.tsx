import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Tooltip } from 'antd'
import {
  DashboardOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
  ApartmentOutlined,
  SunOutlined,
  MoonOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { useTheme } from './contexts/ThemeContext'
import Dashboard from './pages/Dashboard'
import PendingList from './pages/PendingList'
import CorrectionDetail from './pages/CorrectionDetail'
import History from './pages/History'
import StarSchemaPage from './pages/StarSchemaPage'
import BackupLogList from './pages/BackupLogList'
import BackupLogDetail from './pages/BackupLogDetail'

const { Content, Sider } = Layout

function App() {
  const location = useLocation()
  const { mode, toggleTheme } = useTheme()

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">儀表板</Link>,
    },
    {
      key: '/pending',
      icon: <UnorderedListOutlined />,
      label: <Link to="/pending">待處理清單</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">修正歷史</Link>,
    },
    {
      key: '/schema',
      icon: <ApartmentOutlined />,
      label: <Link to="/schema">星狀模型</Link>,
    },
    {
      key: '/backup-logs',
      icon: <CloudServerOutlined />,
      label: <Link to="/backup-logs">備份記錄</Link>,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }} className="bg-atmosphere">
      <Sider
        width={256}
        className="soft-card-static"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          margin: '12px',
          height: 'calc(100vh - 24px)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Logo & Brand */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* GREFUN Favicon Logo */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-inset)',
            }}>
              <img
                src="/favicon-grefun-64.png"
                alt="GREFUN"
                style={{
                  width: 28,
                  height: 28,
                  imageRendering: 'auto',
                }}
              />
            </div>
            <div>
              <div className="logo-text" style={{ fontSize: '1rem' }}>RagicEDP</div>
              <Typography.Text
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  display: 'block',
                  marginTop: '-2px',
                }}
              >
                資料修正平台
              </Typography.Text>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div style={{ padding: '16px 8px', flex: 1 }}>
          <Typography.Text
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              padding: '0 12px',
              marginBottom: '8px',
              display: 'block',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            導航
          </Typography.Text>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ border: 'none' }}
          />
        </div>

        {/* Theme Toggle - Bottom */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography.Text style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
            {mode === 'dark' ? '深色模式' : '淺色模式'}
          </Typography.Text>
          <Tooltip title={mode === 'dark' ? '切換至淺色' : '切換至深色'}>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            </button>
          </Tooltip>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 280 }}>
        <Content
          className="bg-atmosphere-data"
          style={{
            padding: '24px 32px',
            minHeight: '100vh',
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pending" element={<PendingList />} />
            <Route path="/pending/:id" element={<CorrectionDetail />} />
            <Route path="/history" element={<History />} />
            <Route path="/schema" element={<StarSchemaPage />} />
            <Route path="/backup-logs" element={<BackupLogList />} />
            <Route path="/backup-logs/:date" element={<BackupLogDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
