import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, message,
  Space, Tag, InputNumber, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { usersApi } from '../api';
import { User, ResearchGroup } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Option } = Select;

const UserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();

  const canManage = user?.role === 'institute_leader' || user?.role === 'instrument_admin';
  const isGroupLeader = user?.role === 'group_leader';

  useEffect(() => {
    if (isGroupLeader) {
      loadGroupMembers();
    } else {
      loadUsers();
    }
    loadGroups();
  }, [roleFilter, activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      const data = await usersApi.list(params);
      setUsers(data as User[]);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getGroupMembers();
      setUsers(data as User[]);
    } catch (error) {
      console.error('Failed to load group members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await usersApi.getGroups();
      setGroups(data as ResearchGroup[]);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const getRoleName = (role: string) => {
    const map: Record<string, string> = {
      researcher: '研究员',
      instrument_admin: '仪器管理员',
      group_leader: '课题组长',
      institute_leader: '院领导',
      engineer: '工程师',
    };
    return map[role] || role;
  };

  const getRoleColor = (role: string) => {
    const map: Record<string, string> = {
      researcher: 'blue',
      instrument_admin: 'purple',
      group_leader: 'orange',
      institute_leader: 'red',
      engineer: 'green',
    };
    return map[role] || 'default';
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await usersApi.update(editingUser.id, values);
        message.success('更新成功');
      } else {
        await usersApi.create(values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      if (isGroupLeader) {
        loadGroupMembers();
      } else {
        loadUsers();
      }
    } catch (error: any) {
      message.error(error.error || '操作失败');
    }
  };

  const handleDelete = (record: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户"${record.name}"吗？`,
      onOk: async () => {
        try {
          await usersApi.delete(record.id);
          message.success('删除成功');
          loadUsers();
        } catch (error: any) {
          message.error(error.error || '删除失败');
        }
      },
    });
  };

  const handleCreateGroup = () => {
    groupForm.resetFields();
    setIsGroupModalVisible(true);
  };

  const handleGroupSubmit = async () => {
    try {
      const values = await groupForm.validateFields();
      await usersApi.createGroup(values);
      message.success('创建成功');
      setIsGroupModalVisible(false);
      loadGroups();
    } catch (error: any) {
      message.error(error.error || '创建失败');
    }
  };

  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={getRoleColor(role)}>{getRoleName(role)}</Tag>,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: User) => (
        <Space size="small">
          {canManage && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const groupColumns = [
    { title: '课题组名称', dataIndex: 'name', key: 'name' },
    { title: '组长', dataIndex: 'leader_name', key: 'leader_name', render: (name?: string) => name || '-' },
    { title: '总预算', dataIndex: 'budget', key: 'budget', render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '已用', dataIndex: 'budget_used', key: 'budget_used', render: (v: number) => `¥${v.toLocaleString()}` },
    {
      title: '剩余',
      key: 'remaining',
      render: (_: any, record: any) => `¥${(record.budget - record.budget_used).toLocaleString()}`,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{isGroupLeader ? '成员管理' : '用户管理'}</h2>
        <p className="page-description">
          {isGroupLeader ? '管理课题组成员和优先级' : '管理系统用户和课题组'}
        </p>
      </div>

      {!isGroupLeader && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button type={activeTab === 'users' ? 'primary' : 'default'} onClick={() => setActiveTab('users')}>
              <UserOutlined /> 用户管理
            </Button>
            <Button type={activeTab === 'groups' ? 'primary' : 'default'} onClick={() => setActiveTab('groups')}>
              <TeamOutlined /> 课题组管理
            </Button>
          </div>
        </Card>
      )}

      {(activeTab === 'users' || isGroupLeader) && (
        <Card
          extra={
            canManage ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                添加用户
              </Button>
            ) : null
          }
        >
          {canManage && !isGroupLeader && (
            <div style={{ marginBottom: 16 }}>
              <Select value={roleFilter} onChange={setRoleFilter} style={{ width: 150 }}>
                <Option value="all">全部角色</Option>
                <Option value="researcher">研究员</Option>
                <Option value="instrument_admin">仪器管理员</Option>
                <Option value="group_leader">课题组长</Option>
                <Option value="institute_leader">院领导</Option>
                <Option value="engineer">工程师</Option>
              </Select>
            </div>
          )}

          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {activeTab === 'groups' && !isGroupLeader && (
        <Card
          extra={
            user?.role === 'institute_leader' ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateGroup}>
                添加课题组
              </Button>
            ) : null
          }
        >
          <Table
            columns={groupColumns}
            dataSource={groups}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          {!editingUser && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            </>
          )}
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          {canManage && (
            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select placeholder="请选择角色">
                <Option value="researcher">研究员</Option>
                <Option value="instrument_admin">仪器管理员</Option>
                <Option value="group_leader">课题组长</Option>
                <Option value="institute_leader">院领导</Option>
                <Option value="engineer">工程师</Option>
              </Select>
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
            </Col>
          </Row>
          {canManage && (
            <Form.Item name="group_id" label="课题组">
              <Select placeholder="请选择课题组" allowClear>
                {groups.map(g => (
                  <Option key={g.id} value={g.id}>{g.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="添加课题组"
        open={isGroupModalVisible}
        onOk={handleGroupSubmit}
        onCancel={() => setIsGroupModalVisible(false)}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="课题组名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入课题组名称" />
          </Form.Item>
          <Form.Item name="budget" label="初始预算(元)">
            <InputNumber style={{ width: '100%' }} min={0} step={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
