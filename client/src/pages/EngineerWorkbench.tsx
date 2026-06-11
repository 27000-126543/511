import React, { useState, useEffect } from 'react';
import {
  Card, List, Tag, Button, Modal, Form, Input, message,
  Space, Statistic, Row, Col, Timeline,
} from 'antd';
import {
  ToolOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ThunderboltOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { maintenanceApi } from '../api';
import { WorkOrder } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { TextArea } = Input;

const EngineerWorkbench: React.FC = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDetailModal, setIsDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [form] = Form.useForm();

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      let status: string = activeTab;
      if (activeTab === 'pending') status = 'assigned';
      const data = await maintenanceApi.getOrders({ status });
      setOrders(data as WorkOrder[]);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
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

  const handleStart = async (record: WorkOrder) => {
    Modal.confirm({
      title: '开始处理',
      content: `确定开始处理${record.instrument?.name}的工单吗？`,
      onOk: async () => {
        try {
          await maintenanceApi.startOrder(record.id);
          message.success('已开始处理');
          loadOrders();
        } catch (error: any) {
          message.error(error.error || '操作失败');
        }
      },
    });
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

  const pendingOrders = orders.filter(o => o.status === 'assigned');
  const inProgressOrders = orders.filter(o => o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const stats = [
    {
      title: '待处理工单',
      value: pendingOrders.length,
      icon: <ClockCircleOutlined />,
      color: '#fa8c16',
      key: 'pending',
    },
    {
      title: '进行中',
      value: inProgressOrders.length,
      icon: <ThunderboltOutlined />,
      color: '#1890ff',
      key: 'in_progress',
    },
    {
      title: '已完成',
      value: completedOrders.length,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      key: 'completed',
    },
  ];

  const renderOrderCard = (order: WorkOrder) => (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      extra={
        <Tag color={getPriorityColor(order.priority)}>
          {getPriorityText(order.priority)}优先级
        </Tag>
      }
    >
      <h4 style={{ marginBottom: 8 }}>{order.instrument?.name}</h4>
      <p style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
        {order.instrument?.location} · {order.type === 'maintenance' ? '定期维护' : '维修'}
      </p>
      <p style={{ fontSize: 13, marginBottom: 12 }}>{order.description}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666', fontSize: 12 }}>
          计划时间：{dayjs(order.scheduled_date).format('YYYY-MM-DD')}
        </span>
        <Space>
          {order.status === 'assigned' && (
            <Button type="primary" size="small" onClick={() => handleStart(order)}>
              开始处理
            </Button>
          )}
          {order.status === 'in_progress' && (
            <Button type="primary" size="small" onClick={() => handleComplete(order)}>
              完成
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">
          <SafetyCertificateOutlined /> 工程师工作台
        </h2>
        <p className="page-description">欢迎回来，{user?.name}工程师</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats.map((stat, index) => (
          <Col span={8} key={index}>
            <Card
              hoverable
              onClick={() => setActiveTab(stat.key as any)}
              style={{
                borderLeft: `4px solid ${stat.color}`,
                cursor: 'pointer',
              }}
            >
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

      <Card
        tabList={[
          { key: 'pending', tab: '待处理' },
          { key: 'in_progress', tab: '进行中' },
          { key: 'completed', tab: '已完成' },
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as any)}
      >
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <ToolOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
            <p>暂无工单</p>
          </div>
        ) : (
          <Row gutter={[16, 0]}>
            {orders.map(order => (
              <Col span={12} key={order.id}>
                {renderOrderCard(order)}
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Modal
        title="完成工单"
        open={isDetailModal}
        onOk={handleConfirmComplete}
        onCancel={() => setIsDetailModal(false)}
        okText="提交完成"
        width={500}
      >
        {selectedOrder && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>仪器：</strong>{selectedOrder.instrument?.name}</p>
            <p><strong>类型：</strong>{getTypeText(selectedOrder.type)}</p>
            <p><strong>位置：</strong>{selectedOrder.instrument?.location}</p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="report_content"
            label="维修报告"
            rules={[{ required: true, message: '请填写维修报告' }]}
          >
            <TextArea
              rows={6}
              placeholder="请详细描述维修内容、更换的部件、测试结果等信息"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EngineerWorkbench;
