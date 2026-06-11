export type UserRole = 'researcher' | 'instrument_admin' | 'group_leader' | 'institute_leader' | 'engineer';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  group_id?: string;
  created_at: string;
}

export interface ResearchGroup {
  id: string;
  name: string;
  leader_id: string;
  budget: number;
  budget_used: number;
  created_at: string;
}

export interface Instrument {
  id: string;
  name: string;
  type: string;
  model: string;
  location: string;
  status: 'available' | 'in_use' | 'maintenance' | 'fault';
  hourly_rate: number;
  maintenance_cycle_days: number;
  last_maintenance_date: string;
  description: string;
  image_url?: string;
  admin_id?: string;
  admin_name?: string;
  current_temperature?: number;
  temperature_min?: number;
  temperature_max?: number;
  created_at: string;
}

export interface Reservation {
  id: string;
  instrument_id: string;
  user_id: string;
  group_id: string;
  start_time: string;
  end_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  purpose: string;
  priority: number;
  cost?: number;
  created_at: string;
}

export interface InstrumentStatus {
  id: string;
  instrument_id: string;
  temperature: number;
  status: 'normal' | 'warning' | 'fault';
  timestamp: string;
  details?: string;
}

export interface BudgetRecord {
  id: string;
  group_id: string;
  amount: number;
  type: 'deduct' | 'recharge' | 'adjust';
  description: string;
  reservation_id?: string;
  created_at: string;
}

export interface MaintenancePlan {
  id: string;
  instrument_id: string;
  name: string;
  description: string;
  interval_days: number;
  last_maintenance_date: string;
  next_maintenance_date: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface WorkOrder {
  id: string;
  instrument_id: string;
  plan_id?: string;
  type: 'maintenance' | 'repair' | 'emergency';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  engineer_id?: string;
  description: string;
  report_content?: string;
  scheduled_date: string;
  completed_date?: string;
  created_at: string;
}

export interface Engineer {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  status: 'available' | 'busy' | 'offline';
  location: string;
  qualification_level: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'reservation' | 'warning' | 'work_order' | 'budget' | 'report' | 'system';
  title: string;
  content: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface MonthlyReport {
  id: string;
  month: string;
  group_id?: string;
  total_usage_hours: number;
  total_cost: number;
  fault_count: number;
  utilization_rate: number;
  instrument_stats: Array<{
    instrument_id: string;
    instrument_name: string;
    usage_hours: number;
    fault_count: number;
    revenue: number;
  }>;
  created_at: string;
}
