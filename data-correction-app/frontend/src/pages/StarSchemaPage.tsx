import { Typography } from 'antd'
import StarSchema from '../components/StarSchema'

const { Title, Text } = Typography

function StarSchemaPage() {
  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8, fontWeight: 700 }}>
          星狀模型
        </Title>
        <Text style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
          RagicEDP 資料倉儲的星狀模型結構，包含事實表與維度表的關聯
        </Text>
      </div>

      <StarSchema level="overview" />
    </div>
  )
}

export default StarSchemaPage
