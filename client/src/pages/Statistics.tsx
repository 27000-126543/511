import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Table, List, Tag, Progress, Tabs } from 'antd';
import {
  BarChartOutlined, PieChartOutlined, RiseOutlined,
  WarningOutlined, ClockCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { statisticsApi, budgetApi } from '../api';
import { useAuthStore } from '../store/auth';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;

const Statistics: React.FC = () => {
  const { user } = useAuthStore();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [groupData, setGroupData] = useState<any>(null);
  const [instituteData, setInstituteData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isLeader = user?.role === 'institute_leader' || user?.role === 'instrument_admin';
  const isGroupLeader = user?.role === 'group_leader';

  useEffect(() => {
    if (isGroupLeader || user?.role === 'researcher') {
      loadGroupData();
    }
    if (isLeader) {
      loadInstituteData();
    }
  }, [month]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      const data = await statisticsApi.groupUsage({ month });
      setGroupData(data);
    } catch (error) {
      console.error('Failed to load group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstituteData = async () => {
    setLoading(true);
    try {
      const data = await statisticsApi.instituteSummary({ month });
      setInstituteData(data);
    } catch (error) {
      console.error('Failed to load institute data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRankingOption = () => {
    if (!groupData?.user_ranking) return {};
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', name: '小时' },
      yAxis: {
        type: 'category',
        data: groupData.user_ranking.map((u: any) => u.user_name).reverse(),
      },
      series: [
        {
          name: '使用时长',
          type: 'bar',
          data: groupData.user_ranking.map((u: any) => u.hours).reverse(),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 1, color: '#764ba2' },
              ],
            },
          },
        },
      ],
    };
  };

  const getInstrumentPieOption = () => {
    if (!groupData?.instrument_pie) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left' },
      series: [
        {
          name: '费用分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 20, fontWeight: 'bold' },
          },
          data: groupData.instrument_pie.map((i: any) => ({
            name: i.instrument_name,
            value: i.cost,
          })),
        },
      ],
    };
  };

  const getInstituteUsageOption = () => {
    if (!instituteData?.instrument_stats) return {};
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['使用时长', '收入'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: instituteData.instrument_stats.slice(0, 8).map((i: any) => i.name),
        axisLabel: { rotate: 30, fontSize: 10 },
      },
      yAxis: [
        { type: 'value', name: '小时' },
        { type: 'value', name: '收入(元)' },
      ],
      series: [
        {
          name: '使用时长',
          type: 'bar',
          data: instituteData.instrument_stats.slice(0, 8).map((i: any) => i.usage_hours),
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '收入',
          type: 'line',
          yAxisIndex: 1,
          data: instituteData.instrument_stats.slice(0, 8).map((i: any) => i.revenue),
          itemStyle: { color: '#52c41a' },
        },
      ],
    };
  };

  const getGroupCostOption = () => {
    if (!instituteData?.group_stats) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          name: '课题组费用',
          type: 'pie',
          radius: '60%',
          data: instituteData.group_stats.map((g: any) => ({
            name: g.name,
            value: g.total_cost,
          })),
        },
      ],
    };
  };

  const renderGroupStatistics = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总使用时长"
              value={groupData?.total_hours || 0}
              suffix="小时"
              precision={1}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总费用"
              value={groupData?.total_cost || 0}
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="预约次数"
              value={groupData?.reservation_count || 0}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成员人数"
              value={groupData?.user_ranking?.length || 0}
              prefix={<PieChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="成员使用时长排名" className="chart-container">
            <ReactECharts option={getUserRankingOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="仪器费用分布" className="chart-container">
            <ReactECharts option={getInstrumentPieOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="成员使用详情" style={{ marginTop: 16 }}>
        <Table
          dataSource={groupData?.user_ranking || []}
          rowKey="user_id"
          pagination={false}
          size="small"
          columns={[
            { title: '排名', dataIndex: 'rank', key: 'rank', width: 60, render: (_: any, __, index) => index + 1 },
            { title: '成员', dataIndex: 'user_name', key: 'user_name' },
            {
              title: '使用时长',
              dataIndex: 'hours',
              key: 'hours',
              render: (hours: number) => `${hours.toFixed(1)}小时`,
            },
            {
              title: '费用',
              dataIndex: 'cost',
              key: 'cost',
              render: (cost: number) => `¥${cost.toFixed(2)}`,
            },
            {
              title: '占比',
              key: 'percent',
              render: (_: any, record: any) => {
                const total = groupData?.total_hours || 1;
                const percent = (record.hours / total) * 100;
                return (
                  <Progress percent={percent} size="small" showInfo={false} style={{ width: 100 }} />
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );

  const renderInstituteStatistics = () => (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总预约数"
              value={instituteData?.overview?.total_reservations || 0}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总使用时长"
              value={instituteData?.overview?.total_usage_hours || 0}
              suffix="小时"
              precision={1}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={instituteData?.overview?.total_revenue || 0}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="故障次数"
              value={instituteData?.overview?.fault_count || 0}
              valueStyle={{ color: '#f5222d' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="仪器使用率排行" className="chart-container">
            <ReactECharts option={getInstituteUsageOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="课题组费用分布" className="chart-container">
            <ReactECharts option={getGroupCostOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="各课题组统计">
        <Table
          dataSource={instituteData?.group_stats || []}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '课题组', dataIndex: 'name', key: 'name' },
            { title: '预约次数', dataIndex: 'reservation_count', key: 'reservation_count' },
            {
              title: '使用时长',
              dataIndex: 'usage_hours',
              key: 'usage_hours',
              render: (h: number) => `${h.toFixed(1)}小时`,
            },
            {
              title: '总费用',
              dataIndex: 'total_cost',
              key: 'total_cost',
              render: (c: number) => `¥${c.toFixed(2)}`,
            },
            {
              title: '预算',
              key: 'budget',
              render: (_: any, record: any) => (
                <div>
                  <div style={{ fontSize: 12 }}>¥{record.budget_remaining?.toFixed(0)} / ¥{record.budget?.toFixed(0)}</div>
                  <Progress percent={record.budget_percent || 0} size="small" showInfo={false} />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">统计分析</h2>
        <p className="page-description">查看仪器使用统计和分析报告</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 12 }}>选择月份：</span>
        <Select
          value={month}
          onChange={setMonth}
          style={{ width: 150 }}
        >
          {[0, 1, 2, 3, 4, 5].map(i => {
            const m = dayjs().subtract(i, 'month').format('YYYY-MM');
            return <Option key={m} value={m}>{dayjs(m).format('YYYY年MM月')}</Option>;
          })}
        </Select>
      </Card>

      {isLeader ? (
        <Tabs defaultActiveKey="institute">
          <TabPane tab="全院统计" key="institute">
            {renderInstituteStatistics()}
          </TabPane>
          {isGroupLeader && (
            <TabPane tab="本组统计" key="group">
              {renderGroupStatistics()}
            </TabPane>
          )}
        </Tabs>
      ) : (
        renderGroupStatistics()
      )}
    </div>
  );
};

export default Statistics;
