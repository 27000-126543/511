import React, { useState, useEffect } from 'react';
import {
  Table, Tag, Button, Space, Card, Select, DatePicker, Modal,
  message, Input, Form,
} from 'antd';
import { PlusOutlined, EyeOutlined, QrcodeOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { reservationsApi, instrumentsApi } from '../api';
import { Reservation, Instrument } from '../types';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reservations: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [checkInModal, setCheckInModal] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    loadReservations();
    loadInstruments();
  }, [statusFilter, pagination.current, pagination.pageSize]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const params: any = {
        status: statusFilter,
        page: pagination.current,
        pageSize: pagination.pageSize,
      };

      const data = await reservationsApi.myReservations(params);
      setReservations((data as any).list || []);
      setPagination(prev => ({ ...prev, total: (data as any).total || 0 }));
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setLoading(false);
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

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      in_progress: '使用中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[status] || status;
  };

  const handleViewDetail = async (id: string) => {
    try {
      const data = await reservationsApi.get(id);
      setSelectedReservation(data as Reservation);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleCheckIn = async (record: Reservation) => {
    setSelectedReservation(record);
    setQrCodeValue(`instrument:${record.instrument_id}:reservation:${record.id}`);
    setCheckInModal(true);
  };

  const confirmCheckIn = async () => {
    if (!selectedReservation) return;
    try {
      await reservationsApi.checkIn(selectedReservation.id);
      message.success('签到成功');
      setCheckInModal(false);
      loadReservations();
    } catch (error: any) {
      message.error(error.error || '签到失败');
    }
  };

  const handleCheckOut = async (record: Reservation) => {
    Modal.confirm({
      title: '确认签退',
      content: '确认结束使用并签退吗？系统将根据实际时长计算费用。',
      onOk: async () => {
        try {
          const result: any = await reservationsApi.checkOut(record.id);
          message.success(`签退成功，费用：¥${result.cost}`);
          loadReservations();
        } catch (error: any) {
          message.error(error.error || '签退失败');
        }
      },
    });
  };

  const handleCancel = async (record: Reservation) => {
    Modal.confirm({
      title: '取消预约',
      content: '确定要取消此预约吗？',
      onOk: async () => {
        try {
          await reservationsApi.cancel(record.id);
          message.success('取消成功');
          loadReservations();
        } catch (error: any) {
          message.error(error.error || '取消失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '仪器名称',
      dataIndex: ['instrument', 'name'],
      key: 'instrument',
      render: (text: string, record: Reservation) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.instrument?.name || '-'}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{record.instrument?.type || ''}</span>
        </Space>
      ),
    },
    {
      title: '预约时间',
      key: 'time',
      render: (_: any, record: Reservation) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(record.start_time).format('YYYY-MM-DD HH:mm')}</span>
          <span style={{ color: '#999', fontSize: 12 }}>
            至 {dayjs(record.end_time).format('HH:mm')}
            ({dayjs(record.end_time).diff(dayjs(record.start_time), 'hour', true).toFixed(1)}小时)
          </span>
        </Space>
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
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost: number | undefined, record: Reservation) => {
        if (record.status === 'completed' && cost !== undefined) {
          return <span style={{ color: '#fa8c16', fontWeight: 500 }}>¥{cost}</span>;
        }
        if (record.status === 'in_progress') {
          return <span style={{ color: '#999' }}>使用中</span>;
        }
        if (record.status === 'cancelled') {
          return <span style={{ color: '#999' }}>-</span>;
        }
        const hours = dayjs(record.end_time).diff(dayjs(record.start_time), 'hour', true);
        const rate = record.instrument?.hourly_rate || 0;
        return <span style={{ color: '#999' }}>预估 ¥{(hours * rate).toFixed(2)}</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Reservation) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
            详情
          </Button>
          {record.status === 'confirmed' && (
            <Button type="link" size="small" icon={<QrcodeOutlined />} onClick={() => handleCheckIn(record)}>
              签到
            </Button>
          )}
          {record.status === 'in_progress' && (
            <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCheckOut(record)}>
              签退
            </Button>
          )}
          {(record.status === 'confirmed' || record.status === 'pending') && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleCancel(record)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">我的预约</h2>
        <p className="page-description">查看和管理您的仪器预约记录</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Space size="middle">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待确认</Option>
              <Option value="confirmed">已确认</Option>
              <Option value="in_progress">使用中</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/reservations/new')}>
            新建预约
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={reservations}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
          }}
        />
      </Card>

      <Modal
        title="预约详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedReservation && (
          <div>
            <p><strong>仪器：</strong>{selectedReservation.instrument?.name}</p>
            <p><strong>类型：</strong>{selectedReservation.instrument?.type}</p>
            <p><strong>位置：</strong>{selectedReservation.instrument?.location}</p>
            <p><strong>预约时间：</strong>
              {dayjs(selectedReservation.start_time).format('YYYY-MM-DD HH:mm')} - 
              {dayjs(selectedReservation.end_time).format('HH:mm')}
            </p>
            {selectedReservation.actual_start_time && (
              <p><strong>实际开始：</strong>{dayjs(selectedReservation.actual_start_time).format('YYYY-MM-DD HH:mm')}</p>
            )}
            {selectedReservation.actual_end_time && (
              <p><strong>实际结束：</strong>{dayjs(selectedReservation.actual_end_time).format('YYYY-MM-DD HH:mm')}</p>
            )}
            <p><strong>状态：</strong>
              <Tag color={getStatusColor(selectedReservation.status)}>
                {getStatusText(selectedReservation.status)}
              </Tag>
            </p>
            <p><strong>用途：</strong>{selectedReservation.purpose || '-'}</p>
            {selectedReservation.cost !== undefined && (
              <p><strong>费用：</strong><span style={{ color: '#fa8c16', fontSize: 18, fontWeight: 600 }}>¥{selectedReservation.cost}</span></p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="扫码签到"
        open={checkInModal}
        onOk={confirmCheckIn}
        onCancel={() => setCheckInModal(false)}
        okText="确认签到"
      >
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{
            width: 180, height: 180, margin: '0 auto',
            border: '1px solid #ddd', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fafafa',
          }}>
            <div style={{ textAlign: 'center' }}>
              <QrcodeOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>扫码签到</div>
            </div>
          </div>
          <p style={{ marginTop: 16, color: '#666' }}>
            请扫描仪器上的二维码进行签到
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            仪器编号：{selectedReservation?.instrument_id}
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Reservations;
