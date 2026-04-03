-- =====================================================
-- 집안일 나누기 앱 데이터베이스 스키마 (업데이트)
-- =====================================================

-- 기존 테이블들은 유지, 아래 추가 테이블만 실행

-- =====================================================
-- 1. 초대 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.household_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. 주간 목표 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.weekly_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  target_points INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, week_start)
);

-- =====================================================
-- 3. 가사 테이블에 weight 컬럼 추가
-- =====================================================
ALTER TABLE public.chores 
ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;

-- =====================================================
-- 4. user_chores 테이블에 week_start 추가
-- =====================================================
ALTER TABLE public.user_chores 
ADD COLUMN IF NOT EXISTS week_start DATE;

ALTER TABLE public.user_chores 
ADD COLUMN IF NOT EXISTS is_penalty BOOLEAN DEFAULT FALSE;

ALTER TABLE public.user_chores 
ADD COLUMN IF NOT EXISTS chore_name TEXT;

-- =====================================================
-- 5. 사용자별 주간 포인트 추적
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_weekly_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  earned_points INTEGER DEFAULT 0,
  target_points INTEGER DEFAULT 100,
  penalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- =====================================================
-- 6. 벌칙 가사 (미달성 시 자동 할당)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.penalty_chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  chore_id UUID REFERENCES public.chores(id) ON DELETE CASCADE,
  chore_name TEXT NOT NULL,
  points INTEGER DEFAULT 20,
  UNIQUE(household_id, chore_id)
);

-- =====================================================
-- RLS 추가
-- =====================================================
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weekly_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_all" ON public.household_invitations FOR ALL USING (true);
CREATE POLICY "weekly_goals_all" ON public.weekly_goals FOR ALL USING (true);
CREATE POLICY "user_weekly_points_own" ON public.user_weekly_points FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "penalty_chores_all" ON public.penalty_chores FOR ALL USING (true);

-- =====================================================
-- 벌칙 가사 초기 데이터
-- =====================================================
INSERT INTO public.penalty_chores (household_id, chore_id, chore_name, points)
SELECT '00000000-0000-0000-0000-000000000001', id, name, 30
FROM public.chores
WHERE household_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 현재 주간 목표 설정
-- =====================================================
INSERT INTO public.weekly_goals (household_id, week_start, target_points)
VALUES ('00000000-0000-0000-0000-000000000001', DATE_TRUNC('week', NOW())::DATE, 100)
ON CONFLICT (household_id, week_start) DO NOTHING;

-- =====================================================
-- 추가 함수들
-- =====================================================

-- 주간 포인트 추가
CREATE OR REPLACE FUNCTION add_weekly_points(p_user_id UUID, p_week_start DATE, p_points INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_weekly_points (user_id, week_start, earned_points)
  VALUES (p_user_id, p_week_start, p_points)
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET 
    earned_points = public.user_weekly_points.earned_points + p_points,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
