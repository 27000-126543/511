import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Button, notification } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  ScheduleOutlined,
  WalletOutlined,
  ToolOutlined,
  BarChartOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { notificationsApi } from '../api';
import { io, Socket } from 'socket.io-client';

const { Header, Sider, Content } = Layout;

const roleMenuItems: Record<string, any[]> = {
  researcher: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/instruments', icon: <AppstoreOutlined />, label: '仪器列表' },
    { key: '/reservations', icon: <ScheduleOutlined />, label: '我的预约' },
    { key: '/budget', icon: <WalletOutlined />, label: '预算查询' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  instrument_admin: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/instruments', icon: <AppstoreOutlined />, label: '仪器管理' },
    { key: '/reservations', icon: <ScheduleOutlined />, label: '预约管理' },
    { key: '/maintenance', icon: <ToolOutlined />, label: '维护工单' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  group_leader: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/instruments', icon: <AppstoreOutlined />, label: '仪器列表' },
    { key: '/reservations', icon: <ScheduleOutlined />, label: '组内预约' },
    { key: '/budget', icon: <WalletOutlined />, label: '预算管理' },
    { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
    { key: '/users', icon: <TeamOutlined />, label: '成员管理' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  institute_leader: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '总览' },
    { key: '/instruments', icon: <AppstoreOutlined />, label: '仪器管理' },
    { key: '/budget', icon: <WalletOutlined />, label: '预算管理' },
    { key: '/statistics', icon: <BarChartOutlined />, label: '统计报表' },
    { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    { key: '/maintenance', icon: <ToolOutlined />, label: '维护管理' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
  engineer: [
    { key: '/engineer', icon: <SafetyOutlined />, label: '工作台' },
    { key: '/maintenance', icon: <ToolOutlined />, label: '我的工单' },
    { key: '/notifications', icon: <BellOutlined />, label: '消息通知' },
  ],
};

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      notificationsApi.unreadCount().then((res: any) => {
        setUnreadCount(res.count);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io('/', {
      path: '/socket.io',
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('join', user.id);
    });

    socket.on('notification', (data: any) => {
      setUnreadCount(prev => prev + 1);
      notification.info({
        message: data.title,
        description: data.content,
        placement: 'topRight',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = user ? (roleMenuItems[user.role] || []) : [];

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/instruments/')) return ['/instruments'];
    if (path.startsWith('/reservations/')) return ['/reservations'];
    return [path];
  };

  const roleNames: Record<string, string> = {
    researcher: '研究员',
    instrument_admin: '仪器管理员',
    group_leader: '课题组长',
    institute_leader: '院领导',
    engineer: '工程师',
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 12 : 16,
          fontWeight: 600,
          background: 'rgba(255,255,255,0.1)',
        }}>
          {collapsed ? '仪器' : '仪器共享平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: 'white',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {menuItems.find(item => getSelectedKeys().includes(item.key))?.label || '工作台'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount}>
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => navigate('/notifications')}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <div>
                  <div style={{ fontSize: 14, color: '#333' }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{roleNames[user?.role || '']}</div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          margin: '24px',
          padding: '24px',
          background: '#f5f7fa',
          minHeight: 'calc(100vh - 64px - 48px)',
          borderRadius: 8,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
