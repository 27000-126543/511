import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Input, Select, Button, Tag, Modal, Form, message, Space } from 'antd';
import { SearchOutlined, PlusOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { instrumentsApi } from '../api';
import { Instrument } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

const Instruments: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [types, setTypes] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadInstruments();
    loadTypes();
  }, [typeFilter, statusFilter, keyword]);

  const loadInstruments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (keyword) params.keyword = keyword;

      const data = await instrumentsApi.list(params);
      setInstruments(data as Instrument[]);
    } catch (error) {
      console.error('Failed to load instruments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTypes = async () => {
    try {
      const data = await instrumentsApi.getTypes();
      setTypes(data as string[]);
    } catch (error) {
      console.error('Failed to load types:', error);
    }
  };

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      available: 'status-available',
      in_use: 'status-in_use',
      maintenance: 'status-maintenance',
      fault: 'status-fault',
    };
    return statusMap[status] || '';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      available: '可用',
      in_use: '使用中',
      maintenance: '维护中',
      fault: '故障',
    };
    return map[status] || status;
  };

  const handleCreate = () => {
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      await instrumentsApi.create(values);
      message.success('创建成功');
      setIsModalVisible(false);
      form.resetFields();
      loadInstruments();
    } catch (error: any) {
      message.error(error.error || '创建失败');
    }
  };

  const isAdmin = user?.role === 'instrument_admin' || user?.role === 'institute_leader';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">仪器设备</h2>
        <p className="page-description">浏览和预约科研仪器设备</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" style={{ display: 'flex', justifyContent: 'space-between' }}
        >
          <Space size="middle">
            <Search
              placeholder="搜索仪器名称/型号/位置"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              onSearch={(value) => setKeyword(value)}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 150 }}
            >
              <Option value="all">全部类型</Option>
              {types.map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="available">可用</Option>
              <Option value="in_use">使用中</Option>
              <Option value="maintenance">维护中</Option>
              <Option value="fault">故障</Option>
            </Select>
          </Space>

          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加仪器
          </Button>
          )}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {instruments.map((inst) => (
          <Col span={6} key={inst.id}>
            <Card
              className="instrument-card"
              hoverable
              onClick={() => navigate(`/instruments/${inst.id}`)}
              bodyStyle={{ padding: 20 }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  height: 100, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <AppstoreOutlined style={{ fontSize: 40, color: 'white' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{inst.name}</div>
                  <Tag className={`status-badge ${getStatusClass(inst.status)}`}>
                    {getStatusText(inst.status)}
                  </Tag>
                </div>
                <div style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
                  {inst.type} · {inst.model}
                </div>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
                  📍 {inst.location}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fa8c16', fontWeight: 600, fontSize: 16 }}>¥{inst.hourly_rate}/h</span>
                  {inst.current_temperature !== undefined && (
                    <span style={{ fontSize: 12, color: '#999' }}>
                    🌡 {inst.current_temperature}°C
                  </span>
                  )}
                </div>
              </div>
              <Button
                type="primary"
                block
                disabled={inst.status !== 'available'}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/reservations/new/${inst.id}`);
                }}
              >
                {inst.status === 'available' ? '立即预约' : '暂不可用'}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="添加仪器"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        afterClose={() => form.resetFields()}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="仪器名称"
                rules={[{ required: true, message: '请输入仪器名称' }]}
              >
                <Input placeholder="请输入仪器名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="仪器类型"
                rules={[{ required: true, message: '请输入仪器类型' }]}
              >
                <Input placeholder="如：电子显微镜" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item name="model" label="型号">
                <Input placeholder="请输入型号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="位置">
                <Input placeholder="如：A座101室" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="hourly_rate"
                label="小时费率(元)"
                rules={[{ required: true, message: '请输入小时费率' }]}
              >
                <Input type="number" placeholder="请输入小时费率" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_cycle_days" label="维护周期(天)">
                <Input type="number" placeholder="30" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item name="temperature_min" label="最低温度(°C)">
                <Input type="number" placeholder="15" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="temperature_max" label="最高温度(°C)">
                <Input type="number" placeholder="30" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入仪器描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Instruments;
