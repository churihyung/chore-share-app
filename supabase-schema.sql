-- =====================================================
-- 집안일 나누기 앱 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. users 테이블 (기존 auth.users와 연결)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  household_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. households 테이블
CREATE TABLE IF NOT EXISTS public.households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. users 테이블에 household FK 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);

-- 4. chores 테이블 (가사 목록)
CREATE TABLE IF NOT EXISTS public.chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_points INTEGER DEFAULT 10,
  due_cycle TEXT CHECK (due_cycle IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  household_id UUID REFERENCES public.households(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. user_chores 테이블 (사용자별 가사 할당/완료)
CREATE TABLE IF NOT EXISTS public.user_chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  chore_id UUID REFERENCES public.chores(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  points_awarded INTEGER DEFAULT 0
);

-- 6. ad_logs 테이블 (광고 시청 기록)
CREATE TABLE IF NOT EXISTS public.ad_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  points_awarded INTEGER NOT NULL,
  provider TEXT DEFAULT 'mock'
);

-- 7. 사용자 포인트를 저장할 테이블
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 함수들
-- =====================================================

-- 사용자 포인트 조회
CREATE OR REPLACE FUNCTION get_user_points(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_points INTEGER;
BEGIN
  SELECT COALESCE(total_points, 0) INTO v_points
  FROM public.user_points
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_points, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 포인트 추가
CREATE OR REPLACE FUNCTION add_points(p_user_id UUID, p_points INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_points (user_id, total_points, updated_at)
  VALUES (p_user_id, p_points, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_points = public.user_points.total_points + p_points,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS (Row Level Security) policies
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- users: 본人的 것만 접근
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- households: household member만 접근
CREATE POLICY "households_all" ON public.households FOR ALL USING (true);

-- chores: household member만 접근
CREATE POLICY "chores_all" ON public.chores FOR ALL USING (true);

-- user_chores: 본인의 것만
CREATE POLICY "user_chores_own" ON public.user_chores FOR ALL USING (auth.uid() = user_id);

-- ad_logs: 본인의 것만
CREATE POLICY "ad_logs_own" ON public.ad_logs FOR ALL USING (auth.uid() = user_id);

-- user_points: 본인의 것만
CREATE POLICY "user_points_own" ON public.user_points FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 초기 데이터 (테스트용)
-- =====================================================

-- 테스트 household
INSERT INTO public.households (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '우리집') 
ON CONFLICT DO NOTHING;

-- 기본 가사 목록
INSERT INTO public.chores (name, category, base_points, due_cycle, household_id) VALUES
  ('설거지', '주방', 10, 'daily', '00000000-0000-0000-0000-000000000001'),
  ('청소기 돌리기', '청소', 15, 'daily', '00000000-0000-0000-0000-000000000001'),
  ('빨래하기', '세탁', 20, 'weekly', '00000000-0000-0000-0000-000000000001'),
  ('화분 물주기', '기타', 5, 'weekly', '00000000-0000-0000-0000-000000000001'),
  ('욕실 청소', '욕실', 25, 'weekly', '00000000-0000-0000-0000-000000000001'),
  ('쓰레기 버리기', '기타', 10, 'daily', '00000000-0000-0000-0000-000000000001'),
  ('밥 하기', '주방', 15, 'daily', '00000000-0000-0000-0000-000000000001'),
  ('장보기', '기타', 10, 'weekly', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
