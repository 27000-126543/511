import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Select } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [quickAccount, setQuickAccount] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const quickAccounts = [
    { label: '管理员', value: 'admin:123456' },
    { label: '课题组长', value: 'leader1:123456' },
    { label: '研究员', value: 'researcher1:123456' },
    { label: '院领导', value: 'institute_leader:123456' },
    { label: '工程师', value: 'engineer1:123456' },
  ];

  const handleQuickSelect = (value: string) => {
    const [username, password] = value.split(':');
    setQuickAccount(value);
    handleLogin({ username, password });
  };

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      message.error(error.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">科研仪器共享平台</h1>
        <p className="login-subtitle">大型科研院所仪器设备共享管理系统</p>
        
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: '#666', fontSize: 13 }}>快速登录：</span>
          <Select
            value={quickAccount}
            onChange={handleQuickSelect}
            placeholder="选择账号"
            style={{ width: '100%', marginTop: 8 }}
            options={quickAccounts}
            allowClear
          />
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<LoginOutlined />}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
          默认密码: 123456
        </div>
      </div>
    </div>
  );
};

export default Login;
