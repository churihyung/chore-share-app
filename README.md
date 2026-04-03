# 집안일 나누기 앱 (Chore Share App)

## 📁 프로젝트 구조

```
chore-share-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 메인 페이지 (대시보드)
│   │   ├── globals.css         # 글로벌 스타일
│   │   └── login/
│   │       └── page.tsx        # 로그인/회원가입 페이지
│   ├── components/
│   │   └── Dashboard.tsx      # 메인 대시보드 컴포넌트
│   ├── lib/
│   │   └── supabase.ts         # Supabase 클라이언트
│   ├── types/
│   │   └── index.ts             # TypeScript 타입 정의
│   └── styles/
│       └── globals.css          # Tailwind CSS
├── src/
│   └── middleware.ts           # Supabase 인증 미들웨어
├── supabase-schema.sql         # 데이터베이스 스키마
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── postcss.config.js
└── .env.local                  # 환경변수
```

## 🔧 환경설정

### 1. Supabase 프로젝트 생성

1. https://supabase.com 에서 프로젝트 생성
2. **Settings → API** 에서 다음 값 복사:
   - `Project URL`: `https://xxxxxxxx.supabase.co`
   - `anon public` key

### 2. .env.local 생성

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (anon key)
```

### 3. Supabase SQL 실행

**SQL Editor**에서 아래 SQL 실행:

```sql
-- =====================================================
-- users 테이블 (auth.users와 연결)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  household_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- households 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id);

-- =====================================================
-- chores 테이블 (가사 목록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_points INTEGER DEFAULT 10,
  due_cycle TEXT CHECK (due_cycle IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  household_id UUID REFERENCES public.households(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- user_chores 테이블 (할당/완료 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  chore_id UUID REFERENCES public.chores(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  points_awarded INTEGER DEFAULT 0
);

-- =====================================================
-- ad_logs 테이블 (광고 시청 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ad_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  points_awarded INTEGER NOT NULL,
  provider TEXT DEFAULT 'mock'
);

-- =====================================================
-- user_points 테이블 (포인트 합계)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 함수들
-- =====================================================
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
-- RLS Policies
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "households_all" ON public.households FOR ALL USING (true);
CREATE POLICY "chores_all" ON public.chores FOR ALL USING (true);
CREATE POLICY "user_chores_own" ON public.user_chores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ad_logs_own" ON public.ad_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_points_own" ON public.user_points FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 초기 데이터
-- =====================================================
INSERT INTO public.households (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '우리집') 
ON CONFLICT DO NOTHING;

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
```

### 4. Supabase Auth 설정

1. **Authentication → Providers → Email**
2. **Confirm email** 체크 해제 (로컬 테스트용)

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 📱 현재 구현된 기능

| 기능 | 상태 |
|------|------|
| 로그인/회원가입 | ✅ |
| 사용자 이름 저장 | ✅ |
| 오늘의 가사 목록 | ✅ |
| 가사 완료 → 포인트 획득 | ✅ |
| 광고 시청 → 10포인트 | ✅ (Mock) |
| 주간/월간 히스토리 | ✅ |
| 포인트 통계 | ✅ |

## 🔜 추가 필요한 기능

1. **가사 자동 할당**: 매일 자정 또는 특정 시간에 user_chores에 새 항목 추가
2. **가사 CRUD**: 가사 추가/수정/삭제 UI
3. **집안일 나누기**: 2인 가구에서 가사轮流 배정
4. **광고 통합**: 실제 Google AdSense/AdMob 연동
5. **통계 차트**: Chart.js/Recharts로 시각화
6. **알림**: 완료 reminding
7. **모바일 최적화**: PWA 지원

## 📝 참고

- Next.js 14.2.3
- React 18
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- TypeScript
