import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Button,
  Descriptions,
  Alert,
  Space,
  Modal,
  Tag,
  Spin,
  message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useRecordDetail, useSubmitCorrection } from '../hooks/useQueries'

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

function CorrectionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  // React Query hooks
  const { data: record, isLoading: loading, error } = useRecordDetail(id || '')
  const submitMutation = useSubmitCorrection()

  // 設定表單初始值
  useEffect(() => {
    if (!record) return

    const violationFields = record.violations?.map(v => v.field) || []
    if (violationFields.length > 0 && record.original_values) {
      const initialValues: Record<string, unknown> = {}
      for (const field of violationFields) {
        if (field in record.original_values) {
          initialValues[field] = record.original_values[field]
        }
      }
      form.setFieldsValue(initialValues)
    } else if (record.fixed_values) {
      form.setFieldsValue(record.fixed_values)
    }
  }, [record, form])

  const handleSubmit = (values: Record<string, unknown>) => {
    if (!id) return

    Modal.confirm({
      title: '確認修正',
      content: '確定要儲存修正結果嗎？',
      okText: '確認',
      cancelText: '取消',
      onOk: () => {
        submitMutation.mutate(
          { record_id: id, fixed_values: values },
          {
            onSuccess: () => {
              message.success('修正已儲存')
              navigate('/pending')
            },
            onError: () => {
              message.error('儲存失敗')
            },
          }
        )
      },
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !record) {
    return <Alert type="error" message={error ? '載入記錄失敗' : '記錄不存在'} />
  }

  // 取得需要修正的欄位（優先從 violations 取得，否則從 fixed_values 取得）
  const violationFields = record.violations?.map(v => v.field) || []
  const uniqueFields = violationFields.length > 0
    ? violationFields
    : (record.fixed_values ? Object.keys(record.fixed_values) : [])

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/pending')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="記錄資訊" style={{ marginBottom: 16 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="記錄 ID">
            {record.record_id}
          </Descriptions.Item>
          <Descriptions.Item label="表格">
            {TABLE_NAMES[record.table_code] || record.table_code}
          </Descriptions.Item>
          <Descriptions.Item label="狀態">
            <Tag color={record.status === 'manual' ? 'orange' : 'green'}>
              {record.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="AI 信心度">
            <Tag
              color={
                record.confidence_score >= 0.8
                  ? 'green'
                  : record.confidence_score >= 0.5
                    ? 'orange'
                    : 'red'
              }
            >
              {(record.confidence_score * 100).toFixed(0)}%
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {record.violations && record.violations.length > 0 && (
        <Card title="違規資訊" style={{ marginBottom: 16 }}>
          <Alert
            type="warning"
            message={`此記錄有 ${record.violations.length} 個違規項目需要修正`}
            style={{ marginBottom: 16 }}
          />
          {record.violations.map((v, idx) => (
            <Card
              key={idx}
              size="small"
              style={{ marginBottom: 8, backgroundColor: '#fffbe6', border: '1px solid #ffe58f' }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="違規欄位">
                  <Tag color="red">{v.field}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="規則">
                  <Tag color="blue">{v.rule_id}</Tag> ({v.rule_type})
                </Descriptions.Item>
                <Descriptions.Item label="原因">
                  {v.reason}
                </Descriptions.Item>
                <Descriptions.Item label="原始值">
                  <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                    {v.before || '(空)'}
                  </code>
                </Descriptions.Item>
                <Descriptions.Item label="嚴重程度">
                  <Tag color={v.severity === 'high' ? 'red' : v.severity === 'medium' ? 'orange' : 'blue'}>
                    {v.severity}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ))}
        </Card>
      )}

      {record.violation_count > 0 && (!record.violations || record.violations.length === 0) && (
        <Card title="違規資訊" style={{ marginBottom: 16 }}>
          <Alert
            type="warning"
            message={`此記錄有 ${record.violation_count} 個違規項目需要修正（詳情不可用）`}
          />
        </Card>
      )}

      {record.ai_suggestion && (
        <Card title="AI 建議" style={{ marginBottom: 16 }}>
          <Alert type="info" message={record.ai_suggestion} />
        </Card>
      )}

      <Card title="修正表單">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={record.fixed_values || record.original_values || {}}
        >
          {uniqueFields.length > 0 ? (
            uniqueFields.map((field) => {
              const originalValue = record.original_values?.[field]
              const fixedValue = record.fixed_values?.[field]
              const violation = record.violations?.find(v => v.field === field)

              return (
                <Form.Item
                  key={field}
                  name={field}
                  label={
                    <Space>
                      <span style={{ fontWeight: violation ? 'bold' : 'normal' }}>{field}</span>
                      {violation && (
                        <Tag color="red" style={{ fontSize: '12px' }}>
                          違規: {violation.rule_id}
                        </Tag>
                      )}
                    </Space>
                  }
                  tooltip={violation ? `${violation.reason}` : (originalValue !== undefined ? `原始值: ${JSON.stringify(originalValue)}` : undefined)}
                  help={violation ? (
                    <span style={{ color: '#faad14' }}>
                      原始值: {violation.before || '(空)'} | {violation.reason}
                    </span>
                  ) : undefined}
                >
                  <Input
                    placeholder={fixedValue !== undefined ? `建議值: ${fixedValue}` : '請輸入修正值'}
                    status={violation ? 'warning' : undefined}
                  />
                </Form.Item>
              )
            })
          ) : (
            <Alert
              type="info"
              message="無需修正的欄位"
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitMutation.isPending}
                disabled={uniqueFields.length === 0}
              >
                儲存修正
              </Button>
              <Button onClick={() => navigate('/pending')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default CorrectionDetail
