import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Button, Tag, Descriptions, Statistic,
  Progress, List, message, Space, Modal, InputNumber, Select
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, ThunderboltOutlined,
  SafetyOutlined, WarningOutlined, ClockCircleOutlined,
  EnvironmentOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { instrumentsApi, statusApi, reservationsApi } from '../api';
import { Instrument, InstrumentStatus, Reservation, RecommendedSlot } from '../types';
import { io, Socket } from 'socket.io-client';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/auth';

const { Option } = Select;

const InstrumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [statusHistory, setStatusHistory] = useState<InstrumentStatus[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [recommendSlots, setRecommendSlots] = useState<RecommendedSlot[]>([]);
  const [recommendHours, setRecommendHours] = useState(2);
  const [loading, setLoading] = useState(true);
  const [isBookingModal, setIsBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<RecommendedSlot | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, recommendHours]);

  useEffect(() => {
    if (!id) return;

    const socket: Socket = io('/', {
      path: '/socket.io',
    });

    socket.on('connect', () => {
      socket.emit('join-instrument', id);
    });

    socket.on('status-update', (data: any) => {
      setStatusHistory(prev => {
        const newHistory = [...prev, data];
        if (newHistory.length > 100) newHistory.shift();
        return newHistory;
      });
      setInstrument(prev => prev ? { ...prev, current_temperature: data.temperature } : null);
    });

    socket.on('status-warning', (data: any) => {
      message.warning(`仪器温度异常: ${data.temperature}°C`);
      setStatusHistory(prev => [...prev, data]);
      setInstrument(prev => prev ? { ...prev, current_temperature: data.temperature } : null);
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inst, status, reser, recommend] = await Promise.all([
        instrumentsApi.get(id!),
        statusApi.getRecent(id!, 50),
        reservationsApi.getByInstrument(id!, {
          start_date: dayjs().toISOString(),
          end_date: dayjs().add(7, 'day').toISOString(),
        }),
        reservationsApi.recommend(id!, { duration: recommendHours, days: 7 }),
      ]);

      setInstrument(inst as Instrument);
      setStatusHistory(status as InstrumentStatus[]);
      setReservations(reser as Reservation[]);
      setRecommendSlots(recommend as RecommendedSlot[]);
    } catch (error) {
      console.error('Failed to load data:', error);
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

  const getChartOption = () => {
    const temps = statusHistory.map(s => s.temperature);
    const times = statusHistory.map(s => dayjs(s.timestamp).format('HH:mm:ss'));
    
    return {
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '温度(°C)',
      },
      series: [
        {
          name: '温度',
          type: 'line',
          smooth: true,
          data: temps,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
          lineStyle: { color: '#1890ff', width: 2 },
          itemStyle: { color: '#1890ff' },
          markLine: {
            silent: true,
            data: [
              { yAxis: instrument?.temperature_max || 30, lineStyle: { color: '#ff4d4f' }, label: { formatter: '上限' } },
              { yAxis: instrument?.temperature_min || 15, lineStyle: { color: '#ff4d4f' }, label: { formatter: '下限' } },
            ],
          },
        },
      ],
    };
  };

  const handleQuickBook = (slot: RecommendedSlot) => {
    setSelectedSlot(slot);
    setIsBookingModal(true);
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !id) return;

    try {
      await reservationsApi.create({
        instrument_id: id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        purpose: '快速预约',
      });
      message.success('预约成功');
      setIsBookingModal(false);
      loadData();
    } catch (error: any) {
      message.error(error.error || '预约失败');
    }
  };

  if (!instrument) {
    return <div>加载中...</div>;
  }

  const isNormal = instrument.current_temperature !== undefined 
    && instrument.temperature_min !== undefined 
    && instrument.temperature_max !== undefined
    && instrument.current_temperature >= instrument.temperature_min 
    && instrument.current_temperature <= instrument.temperature_max;

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/instruments')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col span={18}>
            <Space size="large" align="center">
              <div style={{
                width: 80, height: 80, borderRadius: 12,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AppstoreOutlined style={{ fontSize: 36, color: 'white' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 24, margin: 0, marginBottom: 8 }}>{instrument.name}</h2>
                <Space size="large">
                  <Tag className={`status-badge ${getStatusClass(instrument.status)}`}>
                    {getStatusText(instrument.status)}
                  </Tag>
                  <span style={{ color: '#666' }}>{instrument.type}</span>
                  <span style={{ color: '#666' }}>{instrument.model}</span>
                </Space>
              </div>
            </Space>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              size="large"
              disabled={instrument.status !== 'available'}
              icon={<CalendarOutlined />}
              onClick={() => navigate(`/reservations/new/${id}`)}
            >
              立即预约
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={6}>
            <Statistic title="小时费率" value={instrument.hourly_rate} prefix="¥" suffix="/小时" />
          </Col>
          <Col span={6}>
            <Statistic title="维护周期" value={instrument.maintenance_cycle_days} suffix="天" />
          </Col>
          <Col span={6}>
            <Statistic
              title="当前温度"
              value={instrument.current_temperature || '--'}
              suffix="°C"
              valueStyle={{ color: isNormal ? '#52c41a' : '#f5222d' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="温度范围"
              value={`${instrument.temperature_min || '--'} - ${instrument.temperature_max || '--'}`}
              suffix="°C"
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="实时状态监控" className="chart-container" style={{ marginBottom: 16 }} extra={
            <Space>
              <SafetyOutlined style={{ color: isNormal ? '#52c41a' : '#f5222d' }} />
              <span style={{ color: isNormal ? '#52c41a' : '#f5222d' }}>
                {isNormal ? '运行正常' : '温度异常'}
              </span>
            </Space>
          }>
            <ReactECharts
              option={getChartOption()}
              style={{ height: 300 }}
              notMerge={true}
              lazyUpdate={true}
            />
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12, marginTop: 8 }}>
              每30秒自动更新 · 共 {statusHistory.length} 条记录
            </div>
          </Card>

          <Card title="仪器信息">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="仪器名称">{instrument.name}</Descriptions.Item>
              <Descriptions.Item label="仪器类型">{instrument.type}</Descriptions.Item>
              <Descriptions.Item label="型号">{instrument.model || '-'}</Descriptions.Item>
              <Descriptions.Item label="位置"><EnvironmentOutlined /> {instrument.location}</Descriptions.Item>
              <Descriptions.Item label="小时费率">¥{instrument.hourly_rate}/小时</Descriptions.Item>
              <Descriptions.Item label="维护周期">{instrument.maintenance_cycle_days}天</Descriptions.Item>
              <Descriptions.Item label="上次维护">
                {instrument.last_maintenance_date ? dayjs(instrument.last_maintenance_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="温度范围">
                {instrument.temperature_min}°C - {instrument.temperature_max}°C
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{instrument.description || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title="智能推荐时段"
            style={{ marginBottom: 16 }}
            extra={
              <Select value={recommendHours} onChange={setRecommendHours} style={{ width: 100 }} size="small">
                <Option value={1}>1小时</Option>
                <Option value={2}>2小时</Option>
                <Option value={3}>3小时</Option>
                <Option value={4}>4小时</Option>
                <Option value={8}>8小时</Option>
              </Select>
            }
          >
            {recommendSlots.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无推荐时段
              </div>
            ) : (
              <List
                size="small"
                dataSource={recommendSlots.slice(0, 5)}
                renderItem={(slot) => (
                  <div
                    className="recommend-slot"
                    onClick={() => handleQuickBook(slot)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {dayjs(slot.start_time).format('MM-DD HH:mm')} - {dayjs(slot.end_time).format('HH:mm')}
                        </div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {slot.reason}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="recommend-score">{slot.score}分</div>
                        <Progress percent={slot.score} showInfo={false} size="small" style={{ width: 60 }} />
                      </div>
                    </div>
                  </div>
                )}
              />
            )}
          </Card>

          <Card title="近期预约" style={{ marginBottom: 16 }}>
            {reservations.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无预约记录
              </div>
            ) : (
              <List
                size="small"
                dataSource={reservations.slice(0, 5)}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<CalendarOutlined />}
                      title={dayjs(item.start_time).format('MM月DD日')}
                      description={
                        <Space size={4}>
                          <ClockCircleOutlined style={{ fontSize: 12 }} />
                          {dayjs(item.start_time).format('HH:mm')} - {dayjs(item.end_time).format('HH:mm')}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card title="安全提示">
            <Space direction="vertical" size="small">
              <div style={{ color: '#666', fontSize: 13 }}>
                <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                请严格按照操作规程使用仪器
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>
                <ThunderboltOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                使用前请扫码签到，使用后请签退
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>
                <SafetyOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                发现异常请立即停止使用并报告
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title="确认预约"
        open={isBookingModal}
        onOk={confirmBooking}
        onCancel={() => setIsBookingModal(false)}
        okText="确认预约"
        cancelText="取消"
      >
        {selectedSlot && (
          <div>
            <p><strong>仪器：</strong>{instrument.name}</p>
            <p><strong>时间：</strong>{dayjs(selectedSlot.start_time).format('YYYY年MM月DD日 HH:mm')} - {dayjs(selectedSlot.end_time).format('HH:mm')}</p>
            <p><strong>时长：</strong>{recommendHours}小时</p>
            <p><strong>预估费用：</strong>¥{recommendHours * instrument.hourly_rate}</p>
            <p style={{ color: '#666', fontSize: 12 }}>
              <WarningOutlined style={{ color: '#faad14' }} /> 预约成功后请按时使用，如需取消请提前操作
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InstrumentDetail;
