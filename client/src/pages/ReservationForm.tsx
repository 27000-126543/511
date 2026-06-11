import React, { useState, useEffect } from 'react';
import {
  Card, Form, Select, DatePicker, Input, Button, message, Row, Col,
  Space, Alert, List, Progress,
} from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { instrumentsApi, reservationsApi } from '../api';
import { Instrument, RecommendedSlot } from '../types';
import dayjs from '../utils/dayjs';
import type { Dayjs } from 'dayjs';;

const { Option } = Select;
const { TextArea } = Input;

const ReservationForm: React.FC = () => {
  const navigate = useNavigate();
  const { instrumentId } = useParams<{ instrumentId?: string }>();
  const [form] = Form.useForm();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [recommendSlots, setRecommendSlots] = useState<RecommendedSlot[]>([]);
  const [conflictInfo, setConflictInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  useEffect(() => {
    loadInstruments();
  }, []);

  useEffect(() => {
    if (instrumentId) {
      form.setFieldsValue({ instrument_id: instrumentId });
      loadInstrumentDetail(instrumentId);
    }
  }, [instrumentId]);

  const loadInstruments = async () => {
    try {
      const data = await instrumentsApi.list({ status: 'available' });
      setInstruments(data as Instrument[]);
    } catch (error) {
      console.error('Failed to load instruments:', error);
    }
  };

  const loadInstrumentDetail = async (id: string) => {
    try {
      const data = await instrumentsApi.get(id);
      setSelectedInstrument(data as Instrument);
      loadRecommendations(id, 2);
    } catch (error) {
      console.error('Failed to load instrument:', error);
    }
  };

  const loadRecommendations = async (instId: string, hours: number) => {
    setRecommendLoading(true);
    try {
      const data = await reservationsApi.recommend(instId, { duration: hours, days: 7 });
      setRecommendSlots(data as RecommendedSlot[]);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleInstrumentChange = async (value: string) => {
    const inst = instruments.find(i => i.id === value);
    setSelectedInstrument(inst || null);
    if (inst) {
      loadRecommendations(inst.id, 2);
    }
    setTimeRange(null);
    setConflictInfo(null);
    setEstimatedCost(0);
  };

  const handleTimeChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    setTimeRange(values);
    if (values && values[0] && values[1] && selectedInstrument) {
      setEstimatedCost(Math.round(values[1].diff(values[0], 'hour', true) * selectedInstrument.hourly_rate * 100) / 100);
    } else {
      setEstimatedCost(0);
    }
    if (!values || !values[0] || !values[1]) { setConflictInfo(null); return; }
    const instId = form.getFieldValue('instrument_id');
    if (!instId) return;
    reservationsApi.checkConflict({
      instrument_id: instId,
      start_time: values[0].toISOString(),
      end_time: values[1].toISOString(),
    }).then((r: any) => setConflictInfo(r)).catch(() => {});
  };

  const handleSlotSelect = (slot: RecommendedSlot) => {
    const s = dayjs(slot.start_time);
    const e = dayjs(slot.end_time);
    setTimeRange([s, e]);
    if (selectedInstrument) {
      setEstimatedCost(Math.round(e.diff(s, 'hour', true) * selectedInstrument.hourly_rate * 100) / 100);
    }
    setConflictInfo({ hasConflict: false, conflictingReservations: [] });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!timeRange || !timeRange[0] || !timeRange[1]) {
        message.warning('请选择预约时段');
        return;
      }
      setLoading(true);
      const data = {
        instrument_id: values.instrument_id,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        purpose: values.purpose || '',
      };
      await reservationsApi.create(data);
      message.success('预约成功');
      navigate('/reservations');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.error || '预约失败');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/reservations')}
        style={{ marginBottom: 16 }}
      >
        返回预约列表
      </Button>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="新建预约">
            <Form form={form} layout="vertical">
              <Form.Item
                name="instrument_id"
                label="选择仪器"
                rules={[{ required: true, message: '请选择仪器' }]}
              >
                <Select
                  placeholder="请选择仪器"
                  onChange={handleInstrumentChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option: any) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {instruments.map(inst => (
                    <Option key={inst.id} value={inst.id}>
                      {inst.name} - ¥{inst.hourly_rate}/小时
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedInstrument && (
                <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ color: '#999', fontSize: 12 }}>仪器类型</div>
                      <div style={{ fontWeight: 500 }}>{selectedInstrument.type}</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ color: '#999', fontSize: 12 }}>位置</div>
                      <div style={{ fontWeight: 500 }}>{selectedInstrument.location}</div>
                    </Col>
                    <Col span={8}>
                      <div style={{ color: '#999', fontSize: 12 }}>小时费率</div>
                      <div style={{ fontWeight: 500, color: '#fa8c16' }}>¥{selectedInstrument.hourly_rate}</div>
                    </Col>
                  </Row>
                </Card>
              )}

              <Form.Item
                label="预约时段"
                required
              >
                <DatePicker.RangePicker
                  value={timeRange as [Dayjs, Dayjs]}
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  onChange={handleTimeChange}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              {conflictInfo && (
                conflictInfo.hasConflict ? (
                  <Alert
                    message="时间冲突"
                    description="所选时段与其他预约存在冲突，请调整时间"
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                ) : timeRange && timeRange[0] && timeRange[1] ? (
                  <Alert
                    message="时段可用"
                    description="该时段可以预约"
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                ) : null
              )}

              {selectedInstrument && (
                <Alert
                  message="预估费用"
                  description={
                    <div>
                      <span style={{ fontSize: 20, fontWeight: 600, color: '#fa8c16' }}>
                        ¥{estimatedCost}
                      </span>
                      <span style={{ color: '#999', marginLeft: 8 }}>
                        （实际费用以使用时长为准）
                      </span>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form.Item name="purpose" label="使用目的">
                <TextArea rows={3} placeholder="请简要描述实验目的" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" onClick={handleSubmit} loading={loading} disabled={conflictInfo?.hasConflict}>
                    提交预约
                  </Button>
                  <Button onClick={() => navigate('/reservations')}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={<span><ThunderboltOutlined /> 智能推荐时段</span>}
            loading={recommendLoading}
          >
            <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>
              基于历史使用率、维护周期等因素智能推荐
            </p>
            
            {!selectedInstrument ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                请先选择仪器
              </div>
            ) : recommendSlots.length === 0 ? (
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
                    onClick={() => handleSlotSelect(slot)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {dayjs(slot.start_time).format('MM-DD HH:mm')} - {dayjs(slot.end_time).format('HH:mm')}
                        </div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                          {slot.reason}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="recommend-score">{slot.score}分</div>
                        <Progress percent={slot.score} showInfo={false} size="small" style={{ width: 50 }} />
                      </div>
                    </div>
                  </div>
                )}
              />
            )}
          </Card>

          <Card
            title={<span><WarningOutlined /> 预约须知</span>}
            style={{ marginTop: 16 }}
          >
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li style={{ marginBottom: 8, color: '#666' }}>请提前5分钟到达仪器室</li>
              <li style={{ marginBottom: 8, color: '#666' }}>使用前请扫码签到，使用后请签退</li>
              <li style={{ marginBottom: 8, color: '#666' }}>如需取消请提前24小时操作</li>
              <li style={{ marginBottom: 8, color: '#666' }}>费用按实际使用时长计算</li>
              <li style={{ color: '#666' }}>发现仪器异常请及时报告</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReservationForm;
