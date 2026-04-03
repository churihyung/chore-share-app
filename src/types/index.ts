export interface User {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  household_id?: string
  created_at: string
}

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface Chore {
  id: string
  name: string
  category: string
  base_points: number
  due_cycle: 'daily' | 'weekly' | 'monthly'
  household_id: string
  created_at: string
}

export interface UserChore {
  id: string
  user_id: string
  chore_id: string
  assigned_at: string
  completed_at?: string
  points_awarded: number
}

export interface AdLog {
  id: string
  user_id: string
  timestamp: string
  points_awarded: number
  provider: string
}

export interface History {
  id: string
  user_id: string
  start_period: string
  end_period: string
  total_points: number
  completed_count: number
  ad_points: number
}

export interface UserStats {
  total_points: number
  completed_chores: number
  ad_points: number
  streak_days: number
}
