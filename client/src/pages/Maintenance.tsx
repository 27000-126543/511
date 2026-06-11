import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, Select, Input, DatePicker,
  message, Space, Tabs, Statistic, Row, Col,
} from 'antd';
import {
  PlusOutlined, ToolOutlined, ClockCircleOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { maintenanceApi, instrumentsApi } from '../api';
import { WorkOrder, MaintenancePlan, Instrument, Engineer } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Maintenance: React.FC = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOrderModal, setIsOrderModal] = useState(false);
  const [isPlanModal, setIsPlanModal] = useState(false);
  const [isAssignModal, setIsAssignModal] = useState(false);
  const [isDetailModal, setIsDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('orders');

  const canManage = user?.role === 'instrument_admin' || user?.role === 'institute_leader';
  const isEngineer = user?.role === 'engineer';

  useEffect(() => {
    loadOrders();
    loadPlans();
    loadInstruments();
    loadEngineers();
  }, [statusFilter, activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await maintenanceApi.getOrders(params);
      setOrders(data as WorkOrder[]);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await maintenanceApi.getPlans();
      setPlans(data as MaintenancePlan[]);
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadInstruments = async () => {
    try {
      const data = await instrumentsApi.list();
      setInstruments(data as Instrument[]);
    } catch (error) {
      console.error('Failed to load instruments:', error);
    }
  };

  const loadEngineers = async () => {
    try {
      const data = await maintenanceApi.getEngineers();
      setEngineers(data as Engineer[]);
    } catch (error) {
      console.error('Failed to load engineers:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'orange',
      assigned: 'blue',
      in_progress: 'processing',
      completed: 'green',
      cancelled: 'default',
    };
    return map[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待分配',
      assigned: '已指派',
      in_progress: '处理中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      low: 'default',
      medium: 'blue',
      high: 'orange',
      urgent: 'red',
    };
    return map[priority] || 'default';
  };

  const getPriorityText = (priority: string) => {
    const map: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      urgent: '紧急',
    };
    return map[priority] || priority;
  };

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      maintenance: '定期维护',
      repair: '故障维修',
      emergency: '紧急维修',
    };
    return map[type] || type;
  };

  const handleCreateOrder = () => {
    form.resetFields();
    setIsOrderModal(true);
  };

  const handleSubmitOrder = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        scheduled_date: values.scheduled_date?.toISOString(),
        auto_assign: true,
      };
      await maintenanceApi.createOrder(data);
      message.success('工单创建成功');
      setIsOrderModal(false);
      loadOrders();
    } catch (error: any) {
      message.error(error.error || '创建失败');
    }
  };

  const handleCreatePlan = () => {
    form.resetFields();
    setIsPlanModal(true);
  };

  const handleSubmitPlan = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        start_date: values.start_date?.toISOString(),
      };
      await maintenanceApi.createPlan(data);
      message.success('计划创建成功');
      setIsPlanModal(false);
      loadPlans();
    } catch (error: any) {
      message.error(error.error || '创建失败');
    }
  };

  const handleAssign = (record: WorkOrder) => {
    setSelectedOrder(record);
    form.resetFields();
    setIsAssignModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedOrder) return;
    try {
      const values = await form.validateFields();
      await maintenanceApi.assignOrder(selectedOrder.id, values);
      message.success('指派成功');
      setIsAssignModal(false);
      loadOrders();
    } catch (error: any) {
      message.error(error.error || '指派失败');
    }
  };

  const handleStart = async (record: WorkOrder) => {
    try {
      await maintenanceApi.startOrder(record.id);
      message.success('已开始处理');
      loadOrders();
    } catch (error: any) {
      message.error(error.error || '操作失败');
    }
  };

  const handleComplete = (record: WorkOrder) => {
    setSelectedOrder(record);
    form.resetFields();
    setIsDetailModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!selectedOrder) return;
    try {
      const values = await form.validateFields();
      await maintenanceApi.completeOrder(selectedOrder.id, values);
      message.success('工单已完成');
      setIsDetailModal(false);
      loadOrders();
    } catch (error: any) {
      message.error(error.error || '操作失败');
    }
  };

  const orderColumns = [
    {
      title: '仪器',
      dataIndex: ['instrument', 'name'],
      key: 'instrument',
      render: (text: string, record: WorkOrder) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.instrument?.name || '-'}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{record.instrument?.location || ''}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{getTypeText(type)}</Tag>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{getPriorityText(priority)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '指派工程师',
      dataIndex: ['engineer', 'name'],
      key: 'engineer',
      render: (text: string, record: WorkOrder) => record.engineer?.name || '-',
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_date',
      key: 'scheduled_date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: WorkOrder) => (
        <Space size="small">
          {canManage && record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => handleAssign(record)}>
              指派
            </Button>
          )}
          {(isEngineer || canManage) && record.status === 'assigned' && (
            <Button type="link" size="small" onClick={() => handleStart(record)}>
              开始处理
            </Button>
          )}
          {(isEngineer || canManage) && record.status === 'in_progress' && (
            <Button type="link" size="small" onClick={() => handleComplete(record)}>
              完成
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const planColumns = [
    {
      title: '仪器',
      dataIndex: ['instrument', 'name'],
      key: 'instrument',
      render: (text: string, record: MaintenancePlan) => record.instrument?.name || '-',
    },
    {
      title: '计划名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '周期',
      dataIndex: 'interval_days',
      key: 'interval_days',
      render: (days: number) => `每${days}天`,
    },
    {
      title: '上次维护',
      dataIndex: 'last_maintenance_date',
      key: 'last_maintenance_date',
      render: (date?: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '下次维护',
      dataIndex: 'next_maintenance_date',
      key: 'next_maintenance_date',
      render: (date: string) => {
        const days = dayjs(date).diff(dayjs(), 'day');
        return (
          <Space>
            {dayjs(date).format('YYYY-MM-DD')}
            {days <= 3 && days >= 0 && <Tag color="orange">{days}天后</Tag>}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag>
      ),
    },
  ];

  const stats = [
    {
      title: '待处理',
      value: orders.filter(o => o.status === 'pending').length,
      icon: <ClockCircleOutlined />,
      color: '#fa8c16',
    },
    {
      title: '进行中',
      value: orders.filter(o => o.status === 'in_progress').length,
      icon: <ToolOutlined />,
      color: '#1890ff',
    },
    {
      title: '已完成',
      value: orders.filter(o => o.status === 'completed').length,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: '维护计划',
      value: plans.filter(p => p.is_active).length,
      icon: <WarningOutlined />,
      color: '#722ed1',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">维护管理</h2>
        <p className="page-description">管理仪器维护计划和维修工单</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.icon}
                valueStyle={{ color: stat.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="维修工单" key="orders">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
              >
                <Option value="all">全部状态</Option>
                <Option value="pending">待分配</Option>
                <Option value="assigned">已指派</Option>
                <Option value="in_progress">处理中</Option>
                <Option value="completed">已完成</Option>
              </Select>
              {canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateOrder}>
                  创建工单
                </Button>
              )}
            </div>
            <Table
              columns={orderColumns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>

          <TabPane tab="维护计划" key="plans">
            {canManage && (
              <div style={{ marginBottom: 16, textAlign: 'right' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreatePlan}>
                  创建计划
                </Button>
              </div>
            )}
            <Table
              columns={planColumns}
              dataSource={plans}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="创建工单"
        open={isOrderModal}
        onOk={handleSubmitOrder}
        onCancel={() => setIsOrderModal(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="instrument_id"
            label="选择仪器"
            rules={[{ required: true, message: '请选择仪器' }]}
          >
            <Select placeholder="请选择仪器">
              {instruments.map(inst => (
                <Option key={inst.id} value={inst.id}>{inst.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="type"
            label="工单类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="maintenance">定期维护</Option>
              <Option value="repair">故障维修</Option>
              <Option value="emergency">紧急维修</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="请选择优先级">
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="scheduled_date"
            label="计划时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item name="description" label="问题描述">
            <TextArea rows={3} placeholder="请描述问题" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建维护计划"
        open={isPlanModal}
        onOk={handleSubmitPlan}
        onCancel={() => setIsPlanModal(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="instrument_id"
            label="选择仪器"
            rules={[{ required: true, message: '请选择仪器' }]}
          >
            <Select placeholder="请选择仪器">
              {instruments.map(inst => (
                <Option key={inst.id} value={inst.id}>{inst.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="计划名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：月度常规维护" />
          </Form.Item>
          <Form.Item
            name="interval_days"
            label="维护周期(天)"
            rules={[{ required: true, message: '请输入周期' }]}
          >
            <Input type="number" placeholder="30" />
          </Form.Item>
          <Form.Item
            name="start_date"
            label="首次维护日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="维护内容">
            <TextArea rows={3} placeholder="请描述维护内容" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="指派工程师"
        open={isAssignModal}
        onOk={handleConfirmAssign}
        onCancel={() => setIsAssignModal(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="engineer_id"
            label="选择工程师"
            rules={[{ required: true, message: '请选择工程师' }]}
          >
            <Select placeholder="请选择工程师">
              {engineers.map(eng => (
                <Option key={eng.id} value={eng.id}>
                  {eng.name} - {eng.specialty} (等级{eng.qualification_level})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="完成工单"
        open={isDetailModal}
        onOk={handleConfirmComplete}
        onCancel={() => setIsDetailModal(false)}
        okText="提交完成"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="report_content"
            label="维修报告"
            rules={[{ required: true, message: '请填写维修报告' }]}
          >
            <TextArea rows={6} placeholder="请详细描述维修内容、更换部件等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Maintenance;
