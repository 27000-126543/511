import React, { useState, useEffect } from 'react';
import {
  Card, Progress, Statistic, Row, Col, Table, Tag, Button, Modal,
  Form, InputNumber, Input, message, Select,
} from 'antd';
import { WalletOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined } from '@ant-design/icons';
import { budgetApi, usersApi } from '../api';
import { BudgetRecord, ResearchGroup } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Option } = Select;

const Budget: React.FC = () => {
  const { user } = useAuthStore();
  const [budgetInfo, setBudgetInfo] = useState<any>(null);
  const [records, setRecords] = useState<BudgetRecord[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isRechargeModal, setIsRechargeModal] = useState(false);
  const [isSetBudgetModal, setIsSetBudgetModal] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const isLeader = user?.role === 'institute_leader' || user?.role === 'group_leader';
  const canManage = user?.role === 'institute_leader';

  useEffect(() => {
    if (user?.role === 'institute_leader') {
      loadGroups();
    } else {
      loadMyBudget();
    }
  }, [user, selectedGroup, pagination.current, pagination.pageSize]);

  const loadMyBudget = async () => {
    try {
      const [info, recordsRes] = await Promise.all([
        budgetApi.myGroup(),
        budgetApi.getRecords(user!.group_id!, { page: pagination.current, pageSize: pagination.pageSize }),
      ]);
      setBudgetInfo(info);
      setRecords((recordsRes as any).list || []);
      setPagination(prev => ({ ...prev, total: (recordsRes as any).total || 0 }));
    } catch (error) {
      console.error('Failed to load budget:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await budgetApi.getGroups();
      setGroups(data as ResearchGroup[]);
      if (data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  useEffect(() => {
    if (selectedGroup && user?.role === 'institute_leader') {
      loadGroupBudget(selectedGroup);
    }
  }, [selectedGroup, pagination.current, pagination.pageSize]);

  const loadGroupBudget = async (groupId: string) => {
    try {
      const recordsRes: any = await budgetApi.getRecords(groupId, {
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      const group = groups.find(g => g.id === groupId);
      setBudgetInfo(group || null);
      setRecords(recordsRes.list || []);
      setPagination(prev => ({ ...prev, total: recordsRes.total || 0 }));
    } catch (error) {
      console.error('Failed to load group budget:', error);
    }
  };

  const handleRecharge = async () => {
    try {
      const values = await form.validateFields();
      await budgetApi.recharge(selectedGroup || user!.group_id!, values);
      message.success('充值成功');
      setIsRechargeModal(false);
      form.resetFields();
      if (user?.role === 'institute_leader') {
        loadGroups();
        loadGroupBudget(selectedGroup);
      } else {
        loadMyBudget();
      }
    } catch (error: any) {
      message.error(error.error || '充值失败');
    }
  };

  const handleSetBudget = async () => {
    try {
      const values = await form.validateFields();
      await budgetApi.setBudget(selectedGroup, values);
      message.success('设置成功');
      setIsSetBudgetModal(false);
      form.resetFields();
      loadGroups();
      loadGroupBudget(selectedGroup);
    } catch (error: any) {
      message.error(error.error || '设置失败');
    }
  };

  const getBudgetStatus = () => {
    if (!budgetInfo) return 'normal';
    const percent = budgetInfo.budget_percent;
    if (percent < 20) return 'exception';
    if (percent < 50) return 'active';
    return 'normal';
  };

  const getTypeTag = (type: string) => {
    const map: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      deduct: { color: 'red', text: '扣除', icon: <ArrowDownOutlined /> },
      recharge: { color: 'green', text: '充值', icon: <ArrowUpOutlined /> },
      adjust: { color: 'blue', text: '调整', icon: <ArrowUpOutlined /> },
    };
    const info = map[type] || map.deduct;
    return <Tag color={info.color}>{info.icon} {info.text}</Tag>;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: BudgetRecord) => (
        <span style={{ color: record.type === 'deduct' ? '#f5222d' : '#52c41a', fontWeight: 500 }}>
          {record.type === 'deduct' ? '-' : '+'}¥{Math.abs(amount).toLocaleString()}
        </span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">预算管理</h2>
        <p className="page-description">查看课题组预算使用情况</p>
      </div>

      {canManage && (
        <Card style={{ marginBottom: 16 }}>
          <span style={{ marginRight: 12 }}>选择课题组：</span>
          <Select
            value={selectedGroup}
            onChange={setSelectedGroup}
            style={{ width: 250 }}
            showSearch
            optionFilterProp="children"
          >
            {groups.map(g => (
              <Option key={g.id} value={g.id}>{g.name}</Option>
            ))}
          </Select>
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总预算"
              value={budgetInfo?.budget || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已使用"
              value={budgetInfo?.budget_used || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="剩余预算"
              value={budgetInfo?.budget_remaining || 0}
              prefix="¥"
              precision={2}
              valueStyle={{ color: budgetInfo?.budget_percent < 20 ? '#f5222d' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }} title="预算使用情况" extra={
        canManage ? (
          <span>
            <Button size="small" style={{ marginRight: 8 }} onClick={() => { form.resetFields(); setIsRechargeModal(true); }}>
              <PlusOutlined /> 充值
            </Button>
            <Button size="small" onClick={() => { form.resetFields(); setIsSetBudgetModal(true); }}>
              设置预算
            </Button>
          </span>
        ) : null
      }>
        <Progress
          percent={budgetInfo?.budget_percent || 0}
          status={getBudgetStatus()}
          format={(percent) => `已使用 ${100 - (percent || 0)}% 剩余`}
          strokeWidth={20}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: '#666' }}>
          <span>已用: ¥{budgetInfo?.budget_used?.toLocaleString() || 0}</span>
          <span>剩余: ¥{budgetInfo?.budget_remaining?.toLocaleString() || 0}</span>
        </div>
        {budgetInfo?.budget_percent < 20 && (
          <div style={{
            marginTop: 12, padding: 12,
            background: '#fff2f0', border: '1px solid #ffccc7',
            borderRadius: 4, color: '#f5222d',
          }}>
            ⚠️ 预算余额已低于20%，请注意控制使用
          </div>
        )}
      </Card>

      <Card title="收支明细">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
          }}
        />
      </Card>

      <Modal
        title="预算充值"
        open={isRechargeModal}
        onOk={handleRecharge}
        onCancel={() => setIsRechargeModal(false)}
        okText="确认充值"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="amount"
            label="充值金额(元)"
            rules={[{ required: true, message: '请输入充值金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              placeholder="请输入充值金额"
              prefix="¥"
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="请输入说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置预算"
        open={isSetBudgetModal}
        onOk={handleSetBudget}
        onCancel={() => setIsSetBudgetModal(false)}
        okText="确认设置"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="budget"
            label="总预算(元)"
            rules={[{ required: true, message: '请输入预算金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              placeholder="请输入总预算金额"
              prefix="¥"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Budget;
