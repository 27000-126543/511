import React, { useState, useEffect } from 'react';
import {
  Card, List, Tag, Button, Select, Empty, Badge, Space,
} from 'antd';
import {
  BellOutlined, WarningOutlined, ScheduleOutlined,
  ToolOutlined, WalletOutlined, FileTextOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { notificationsApi } from '../api';
import { Notification } from '../types';
import dayjs from '../utils/dayjs';

const { Option } = Select;

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [typeFilter, pagination.current, pagination.pageSize]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params: any = {
        type: typeFilter,
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      const data: any = await notificationsApi.list(params);
      setNotifications(data.list || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data: any = await notificationsApi.unreadCount();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    const map: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
      reservation: { icon: <ScheduleOutlined />, color: 'blue', label: '预约' },
      warning: { icon: <WarningOutlined />, color: 'red', label: '预警' },
      work_order: { icon: <ToolOutlined />, color: 'orange', label: '工单' },
      budget: { icon: <WalletOutlined />, color: 'green', label: '预算' },
      report: { icon: <FileTextOutlined />, color: 'purple', label: '报告' },
      system: { icon: <BellOutlined />, color: 'default', label: '系统' },
    };
    return map[type] || map.system;
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">消息通知</h2>
        <p className="page-description">查看系统消息和通知</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="middle">
            <Badge count={unreadCount} offset={[10, 2]}>
              <span style={{ fontSize: 14 }}>全部消息</span>
            </Badge>
            <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }} size="small">
              <Option value="all">全部类型</Option>
              <Option value="reservation">预约通知</Option>
              <Option value="warning">异常预警</Option>
              <Option value="work_order">工单通知</Option>
              <Option value="budget">预算通知</Option>
              <Option value="report">报告通知</Option>
              <Option value="system">系统通知</Option>
            </Select>
          </Space>
          <Button size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckOutlined /> 全部已读
          </Button>
        </div>
      </Card>

      <Card>
        {notifications.length === 0 ? (
          <Empty description="暂无消息" />
        ) : (
          <List
            dataSource={notifications}
            loading={loading}
            renderItem={(item) => {
              const typeInfo = getTypeIcon(item.type);
              return (
                <List.Item
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid #f0f0f0',
                    background: item.is_read ? 'transparent' : '#f6ffed',
                  }}
                  onClick={() => handleMarkRead(item.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: `${typeInfo.color}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: typeInfo.color,
                      }}>
                        {typeInfo.icon}
                      </div>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Space>
                          {!item.is_read && <span style={{ color: '#52c41a' }}>●</span>}
                          <span style={{ fontWeight: 500 }}>{item.title}</span>
                          <Tag color={typeInfo.color} style={{ marginLeft: 8 }}>
                            {typeInfo.label}
                          </Tag>
                        </Space>
                        <span style={{ color: '#999', fontSize: 12 }}>
                          {item.created_at ? dayjs(item.created_at).fromNow() : ""}
                        </span>
                      </div>
                    }
                    description={
                      <div>
                        <p style={{ color: '#666', margin: '4px 0' }}>{item.content}</p>
                        <span style={{ color: '#ccc', fontSize: 12 }}>
                          {item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}
                        </span>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
            pagination={{
              ...pagination,
              onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default Notifications;
