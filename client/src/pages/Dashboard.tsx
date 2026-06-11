import React, { useState, useEffect } from 'react';
import { Row, Col, Card, List, Tag, Button, Statistic, Progress, Space } from 'antd';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  BellOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { instrumentsApi, reservationsApi, notificationsApi, maintenanceApi, budgetApi, statisticsApi } from '../api';
import { Instrument, Reservation, Notification, WorkOrder } from '../types';
import dayjs from '../utils/dayjs';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instRes, notifRes] = await Promise.all([
        instrumentsApi.list(),
        notificationsApi.list({ pageSize: 5 }),
      ]);
      
      setInstruments((instRes as any)?.slice(0, 6) || []);
      setNotifications((notifRes as any).list || []);

      if (user?.role === 'researcher' || user?.role === 'group_leader') {
        const [reservRes, budgetRes] = await Promise.all([
          reservationsApi.myReservations({ pageSize: 5 }),
          budgetApi.myGroup().catch(() => null),
        ]);
        setMyReservations((reservRes as any).list || []);
        setBudgetInfo(budgetRes);
      }

      if (user?.role === 'instrument_admin') {
        const orderRes = await maintenanceApi.getOrders({ status: 'pending' });
        setWorkOrders(orderRes as any);
      }

      if (user?.role === 'institute_leader') {
        const statsRes = await statisticsApi.instituteSummary();
        setStats(statsRes);
      }

      if (user?.role === 'engineer') {
        const orderRes = await maintenanceApi.getOrders();
        setWorkOrders(orderRes as any);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'orange',
      confirmed: 'blue',
      in_progress: 'processing',
      completed: 'green',
      cancelled: 'default',
    };
    return map[status] || 'default';
  };

  const renderResearcherDashboard = () => (
    <>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="我的预约"
              value={myReservations.length}
              prefix={<ScheduleOutlined />}
              style={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={myReservations.filter(r => r.status === 'in_progress').length}
              prefix={<ClockCircleOutlined />}
              style={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未读消息"
              value={notifications.filter(n => !n.is_read).length}
              prefix={<BellOutlined />}
              style={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="可用仪器"
              value={instruments.filter(i => i.status === 'available').length}
              prefix={<AppstoreOutlined />}
              style={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {budgetInfo && (
        <Card title="预算概览" style={{ marginBottom: 24 }} extra={<Button type="link" onClick={() => navigate('/budget')}>详情 <ArrowRightOutlined /></Button>}>
          <Progress
            percent={budgetInfo.budget_percent}
            status={budgetInfo.budget_percent < 20 ? 'exception' : budgetInfo.budget_percent < 50 ? 'active' : 'normal'}
            format={(percent) => `剩余 ${percent}%`}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ color: '#666' }}>总预算: ¥{budgetInfo.budget?.toLocaleString()}</span>
            <span style={{ color: '#666' }}>已用: ¥{budgetInfo.budget_used?.toLocaleString()}</span>
            <span style={{ color: '#1677ff', fontWeight: 500 }}>剩余: ¥{budgetInfo.budget_remaining?.toLocaleString()}</span>
          </div>
        </Card>
      )}
    </>
  );

  const renderAdminDashboard = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic title="仪器总数" value={instruments.length} prefix={<AppstoreOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待处理工单"
            value={workOrders.length}
            prefix={<ToolOutlined />}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="故障仪器"
            value={instruments.filter(i => i.status === 'fault' || i.status === 'maintenance').length}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="今日预约" value={8} prefix={<ClockCircleOutlined />} />
        </Card>
      </Col>
    </Row>
  );

  const renderLeaderDashboard = () => stats && (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总预约数"
            value={stats.overview.total_reservations}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="总使用时长"
            value={stats.overview.total_usage_hours}
            suffix="小时"
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="总收入"
            value={stats.overview.total_revenue}
            prefix="¥"
            precision={2}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="故障次数"
            value={stats.overview.fault_count}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
      </Col>
    </Row>
  );

  const renderEngineerDashboard = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={8}>
        <Card>
          <Statistic title="待处理工单" value={workOrders.filter(o => o.status === 'assigned').length} prefix={<ToolOutlined />} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="进行中" value={workOrders.filter(o => o.status === 'in_progress').length} prefix={<ThunderboltOutlined />} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic title="已完成" value={workOrders.filter(o => o.status === 'completed').length} prefix={<CheckCircleOutlined />} />
        </Card>
      </Col>
    </Row>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, marginBottom: 4 }}>
          欢迎回来，{user?.name}！
        </h2>
        <p style={{ color: '#666' }}>
          {dayjs().format('YYYY年MM月DD日 dddd')}
        </p>
      </div>

      {user?.role === 'researcher' && renderResearcherDashboard()}
      {user?.role === 'group_leader' && renderResearcherDashboard()}
      {user?.role === 'instrument_admin' && renderAdminDashboard()}
      {user?.role === 'institute_leader' && renderLeaderDashboard()}
      {user?.role === 'engineer' && renderEngineerDashboard()}

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="仪器设备"
            extra={<Button type="link" onClick={() => navigate('/instruments')}>查看全部 <ArrowRightOutlined /></Button>}
          >
            <Row gutter={[16, 16]}>
              {instruments.slice(0, 6).map((inst) => (
                <Col span={8} key={inst.id}>
                  <Card
                    className="instrument-card"
                    hoverable
                    onClick={() => navigate(`/instruments/${inst.id}`)}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{inst.name}</div>
                      <Tag className={`status-badge ${getStatusClass(inst.status)}`}>
                        {getStatusText(inst.status)}
                      </Tag>
                    </div>
                    <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>{inst.type} · {inst.location}</div>
                    <div style={{ color: '#fa8c16', fontWeight: 500 }}>¥{inst.hourly_rate}/小时</div>
                    {inst.current_temperature !== undefined && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        当前温度: {inst.current_temperature}°C
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title="最新消息"
            extra={<Button type="link" onClick={() => navigate('/notifications')}>更多 <ArrowRightOutlined /></Button>}
            style={{ marginBottom: 16 }}
          >
            {notifications.length > 0 ? (
              <List
                dataSource={notifications}
                renderItem={(item) => (
                  <List.Item
                    style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
                    onClick={() => navigate('/notifications')}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {!item.is_read && <span style={{ color: '#f5222d' }}>●</span>}
                          <span style={{ fontSize: 14 }}>{item.title}</span>
                        </Space>
                      }
                      description={
                        <div style={{ color: '#999', fontSize: 12 }}>
                          {item.content}
                          <div style={{ marginTop: 4 }}>{item.created_at ? dayjs(item.created_at).fromNow() : ""}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#999" }}>
                暂无消息
              </div>
            )}
          </Card>

          {myReservations.length > 0 && (
            <Card title="我的预约">
              <List
                size="small"
                dataSource={myReservations}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.instrument?.name}
                      description={
                        <Space size={4}>
                          <Tag color={getStatusColor(item.status)} style={{ margin: 0 }}>
                            {getStatusText(item.status)}
                          </Tag>
                          <span style={{ color: '#999', fontSize: 12 }}>
                            {dayjs(item.start_time).format('MM-DD HH:mm')}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
