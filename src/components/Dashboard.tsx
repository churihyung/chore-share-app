'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@/types'

const DEFAULT_CHORES = [
  { name: '설거지', category: '주방', base_points: 10, weight: 1, due_cycle: 'daily' },
  { name: '청소기 돌리기', category: '청소', base_points: 15, weight: 2, due_cycle: 'daily' },
  { name: '빨래하기', category: '세탁', base_points: 20, weight: 2, due_cycle: 'weekly' },
  { name: '화분 물주기', category: '기타', base_points: 5, weight: 1, due_cycle: 'weekly' },
  { name: '욕실 청소', category: '욕실', base_points: 25, weight: 3, due_cycle: 'weekly' },
  { name: '쓰레기 버리기', category: '기타', base_points: 10, weight: 1, due_cycle: 'daily' },
  { name: '밥 하기', category: '주방', base_points: 15, weight: 2, due_cycle: 'daily' },
  { name: '장보기', category: '기타', base_points: 10, weight: 1, due_cycle: 'weekly' },
  { name: '반려식물 관리', category: '기타', base_points: 8, weight: 1, due_cycle: 'weekly' },
  { name: '냉장고 정리', category: '주방', base_points: 12, weight: 1, due_cycle: 'weekly' },
  { name: '바닥 청소', category: '청소', base_points: 15, weight: 2, due_cycle: 'weekly' },
  { name: '세면대 청소', category: '욕실', base_points: 10, weight: 1, due_cycle: 'weekly' },
  { name: '개/반려동물 돌보기', category: '기타', base_points: 20, weight: 2, due_cycle: 'daily' },
]

interface DashboardProps {
  userId: string
}

interface WeeklyStats {
  earned: number
  target: number
  percentage: number
}

export default function Dashboard({ userId }: DashboardProps) {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [points, setPoints] = useState(0)
  const [chores, setChores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'manage' | 'penalty'>('today')
  const [showAdModal, setShowAdModal] = useState(false)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ earned: 0, target: 100, percentage: 0 })
  const [householdMembers, setHouseholdMembers] = useState<any[]>([])
  const [allChores, setAllChores] = useState<any[]>([])
  const [showAddChore, setShowAddChore] = useState(false)
  const [newChore, setNewChore] = useState({ name: '', category: '', base_points: 10, weight: 1, due_cycle: 'daily' })
  const [editingChore, setEditingChore] = useState<any>(null)
  const [editWeight, setEditWeight] = useState(1)
  const [penaltyChores, setPenaltyChores] = useState<any[]>([])
  const [penaltyAssigned, setPenaltyAssigned] = useState(false)

  useEffect(() => {
    fetchData()
  }, [userId])

  async function fetchData() {
    const userRes = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    const pointsRes = await supabase.rpc('get_user_points', { p_user_id: userId })
    
    const weekStart = getWeekStart(new Date())
    
    const weeklyRes = await supabase
      .from('user_weekly_points')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .maybeSingle()

    const choresRes = await supabase
      .from('user_chores')
      .select('*, chores(*)')
      .eq('user_id', userId)
      .gte('assigned_at', weekStart.toISOString())
      .order('assigned_at', { ascending: false })

    const householdMembersRes = userRes.data?.household_id
      ? await supabase.from('users').select('*').eq('household_id', userRes.data.household_id)
      : { data: [] }

    const allChoresRes = userRes.data?.household_id
      ? await supabase.from('chores').select('*').eq('household_id', userRes.data.household_id)
      : { data: [] }

    const penaltyRes = userRes.data?.household_id
      ? await supabase.from('penalty_chores').select('*').eq('household_id', userRes.data.household_id)
      : { data: [] }

    const assignedPenaltyRes = await supabase
      .from('user_chores')
      .select('id')
      .eq('user_id', userId)
      .eq('is_penalty', true)
      .gte('assigned_at', weekStart.toISOString())

    if (userRes.data) setUser(userRes.data)
    if (pointsRes.data !== null) setPoints(pointsRes.data)
    if (weeklyRes.data) {
      setWeeklyStats({
        earned: weeklyRes.data.earned_points || 0,
        target: weeklyRes.data.target_points || 100,
        percentage: Math.min(100, Math.round(((weeklyRes.data.earned_points || 0) / (weeklyRes.data.target_points || 100)) * 100))
      })
    }
    if (choresRes.data) setChores(choresRes.data)
    if (householdMembersRes.data) setHouseholdMembers(householdMembersRes.data)
    if (allChoresRes.data) setAllChores(allChoresRes.data)
    if (penaltyRes.data) setPenaltyChores(penaltyRes.data)
    setPenaltyAssigned((assignedPenaltyRes.data?.length || 0) > 0)
    
    setLoading(false)
  }

  function getWeekStart(date: Date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  async function completeChore(userChoreId: string, chore: any) {
    const pointsEarned = chore.chores.base_points * chore.chores.weight
    
    await supabase
      .from('user_chores')
      .update({ completed_at: new Date().toISOString(), points_awarded: pointsEarned })
      .eq('id', userChoreId)
    
    await supabase.rpc('add_points', { p_user_id: userId, p_points: pointsEarned })
    
    const weekStart = getWeekStart(new Date())
    await supabase.rpc('add_weekly_points', { p_user_id: userId, p_week_start: weekStart.toISOString().split('T')[0], p_points: pointsEarned })
    
    await fetchData()
  }

  async function watchAd() {
    setShowAdModal(false)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    await supabase.from('ad_logs').insert({
      user_id: userId,
      points_awarded: 10,
      provider: 'mock'
    })

    await supabase.rpc('add_points', { p_user_id: userId, p_points: 10 })
    await fetchData()
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function addChore() {
    if (!newChore.name.trim()) return

    const userData = await supabase.from('users').select('household_id').eq('id', userId).maybeSingle()
    if (!userData.data?.household_id) return

    await supabase.from('chores').insert({
      ...newChore,
      household_id: userData.data.household_id
    })

    setNewChore({ name: '', category: '', base_points: 10, weight: 1, due_cycle: 'daily' })
    setShowAddChore(false)
    await fetchData()
  }

  async function addChoreFromDefault(chore: typeof DEFAULT_CHORES[0]) {
    const userData = await supabase.from('users').select('household_id').eq('id', userId).maybeSingle()
    if (!userData.data?.household_id) return

    await supabase.from('chores').insert({
      ...chore,
      household_id: userData.data.household_id
    })

    await fetchData()
  }

  async function deleteChore(choreId: string) {
    if (!confirm('이 가사를 삭제할까요?')) return
    await supabase.from('chores').delete().eq('id', choreId)
    await fetchData()
  }

  function openEditChore(chore: any) {
    setEditingChore(chore)
    setEditWeight(chore.weight)
  }

  async function saveEditChore() {
    if (!editingChore) return
    await supabase.from('chores').update({ weight: editWeight }).eq('id', editingChore.id)
    setEditingChore(null)
    await fetchData()
  }

  async function assignChore(choreId: string) {
    const weekStart = getWeekStart(new Date())
    await supabase.from('user_chores').insert({
      user_id: userId,
      chore_id: choreId,
      assigned_at: new Date().toISOString(),
      week_start: weekStart.toISOString().split('T')[0]
    })
    await fetchData()
  }

  async function uncompleteChore(userChoreId: string) {
    const chore = chores.find(c => c.id === userChoreId)
    const pointsEarned = chore?.chores?.base_points * chore?.chores?.weight || 0
    
    await supabase
      .from('user_chores')
      .update({ completed_at: null, points_awarded: 0 })
      .eq('id', userChoreId)
    
    await supabase.rpc('add_points', { p_user_id: userId, p_points: -pointsEarned })
    
    const weekStart = getWeekStart(new Date())
    await supabase.rpc('add_weekly_points', { p_user_id: userId, p_week_start: weekStart.toISOString().split('T')[0], p_points: -pointsEarned })
    
    await fetchData()
  }

  async function assignPenaltyChores() {
    if (penaltyAssigned) return
    const weekStart = getWeekStart(new Date())
    
    for (const penalty of penaltyChores) {
      await supabase.from('user_chores').insert({
        user_id: userId,
        chore_id: penalty.chore_id,
        chore_name: penalty.chore_name,
        assigned_at: new Date().toISOString(),
        week_start: weekStart.toISOString().split('T')[0],
        is_penalty: true,
        points_awarded: penalty.points
      })
    }
    
    await fetchData()
  }

  async function autoAssignWeekly() {
    const weekStart = getWeekStart(new Date())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    
    const existingAssignments = await supabase
      .from('user_chores')
      .select('chore_id')
      .eq('user_id', userId)
      .eq('week_start', weekStartStr)
    
    const assignedIds = (existingAssignments.data || []).map((c: any) => c.chore_id)
    
    const dailyChores = allChores.filter(c => c.due_cycle === 'daily' && !assignedIds.includes(c.id))
    const weeklyChores = allChores.filter(c => c.due_cycle === 'weekly' && !assignedIds.includes(c.id))
    
    const choresToAssign = [...dailyChores, ...weeklyChores]
    
    for (const chore of choresToAssign) {
      await supabase.from('user_chores').insert({
        user_id: userId,
        chore_id: chore.id,
        assigned_at: new Date().toISOString(),
        week_start: weekStartStr
      })
    }
    
    await fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const todayChores = chores.filter(c => !c.completed_at)
  const completedChores = chores.filter(c => c.completed_at)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {user?.display_name || user?.email}님
            </h1>
            <p className="text-sm text-gray-500">가사 포인트</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">{points}</p>
              <p className="text-xs text-gray-500">총 포인트</p>
            </div>
            <button
              onClick={() => setShowAdModal(true)}
              className="px-3 py-1 bg-yellow-400 text-gray-900 rounded-lg font-medium text-sm hover:bg-yellow-500 transition"
            >
              광고 +10P
            </button>
            <button
              onClick={signOut}
              className="px-3 py-1 text-gray-600 text-sm hover:text-gray-900"
            >
              로그아웃
            </button>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">이번 주 목표</span>
              <span className="text-gray-600">{weeklyStats.earned} / {weeklyStats.target} P ({weeklyStats.percentage}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${weeklyStats.percentage >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                style={{ width: `${weeklyStats.percentage}%` }}
              ></div>
            </div>
            {weeklyStats.percentage < 100 && (
              <p className="text-xs text-orange-500 mt-1">아직 {weeklyStats.target - weeklyStats.earned}P 더 필요!</p>
            )}
            {weeklyStats.percentage >= 100 && (
              <p className="text-xs text-green-500 mt-1">목표 달성! 🎉</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'today' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            오늘의 가사
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'history' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            히스토리
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'manage' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            가사 관리
          </button>
          {weeklyStats.percentage < 100 && !penaltyAssigned && (
            <button
              onClick={() => setActiveTab('penalty')}
              className="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200"
            >
              벌칙 ⚠️
            </button>
          )}
        </div>

        {activeTab === 'today' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">할 일</h2>
              <button
                onClick={autoAssignWeekly}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                이번 주 자동 할당
              </button>
            </div>
            {todayChores.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                오늘 할 가사가 없습니다! 🎉<br/>
                <span className="text-sm">가사 관리에서 추가하세요</span>
              </div>
            ) : (
              todayChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{chore.chores?.name}</h3>
                    <p className="text-sm text-gray-500">{chore.chores?.category} • 가중치: {chore.chores?.weight}x</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-medium">
                      +{chore.chores?.base_points * chore.chores?.weight}P
                    </span>
                    <button
                      onClick={() => completeChore(chore.id, chore)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      완료
                    </button>
                  </div>
                </div>
              ))
            )}

            {completedChores.length > 0 && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mt-8">완료됨</h2>
                {completedChores.map(chore => (
                  <div key={chore.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between opacity-60">
                    <div>
                      <h3 className="font-medium text-gray-900 line-through">{chore.chores?.name}</h3>
                      <p className="text-sm text-gray-500">{chore.chores?.category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                        완료 +{chore.points_awarded}P
                      </span>
                      <button
                        onClick={() => uncompleteChore(chore.id)}
                        className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm hover:bg-gray-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView userId={userId} />
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">가사 추가</h2>
              <button
                onClick={() => setShowAddChore(!showAddChore)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
              >
                {showAddChore ? '기본 가사 보기' : '+ 커스텀 가사'}
              </button>
            </div>

            {showAddChore && (
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                <h3 className="font-medium text-gray-900">새 가사 추가</h3>
                <input
                  type="text"
                  value={newChore.name}
                  onChange={(e) => setNewChore({...newChore, name: e.target.value})}
                  placeholder="가사 이름"
                  className="w-full px-3 py-2 rounded-lg border text-gray-900 bg-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newChore.category}
                    onChange={(e) => setNewChore({...newChore, category: e.target.value})}
                    placeholder="카테고리"
                    className="px-3 py-2 rounded-lg border text-gray-900 bg-white"
                  />
                  <select
                    value={newChore.due_cycle}
                    onChange={(e) => setNewChore({...newChore, due_cycle: e.target.value})}
                    className="px-3 py-2 rounded-lg border text-gray-900 bg-white"
                  >
                    <option value="daily">매일</option>
                    <option value="weekly">매주</option>
                    <option value="monthly">매월</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">포인트</label>
                    <input
                      type="number"
                      value={newChore.base_points}
                      onChange={(e) => setNewChore({...newChore, base_points: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 rounded-lg border text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">가중치</label>
                    <input
                      type="number"
                      value={newChore.weight}
                      onChange={(e) => setNewChore({...newChore, weight: parseInt(e.target.value) || 1})}
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 rounded-lg border text-gray-900 bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addChore}
                    className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-medium"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setShowAddChore(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {!showAddChore && (
              <>
                <h3 className="font-medium text-gray-700">기본 가사</h3>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_CHORES.filter(c => !allChores.find(ac => ac.name === c.name)).map(chore => (
                    <div key={chore.name} className="bg-white rounded-lg p-3 shadow-sm flex items-center justify-between">
                      <button
                        onClick={() => addChoreFromDefault(chore)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="text-left">
                          <p className="font-medium text-gray-900 text-sm">{chore.name}</p>
                          <p className="text-xs text-gray-500">{chore.base_points * chore.weight}P • {chore.due_cycle === 'daily' ? '매일' : '매주'}</p>
                        </div>
                        <span className="text-green-500 text-xl">+</span>
                      </button>
                    </div>
                  ))}
                  {DEFAULT_CHORES.filter(c => !allChores.find(ac => ac.name === c.name)).length === 0 && (
                    <p className="text-sm text-gray-500 col-span-2 text-center py-4">모든 기본 가사를 추가했어요!</p>
                  )}
                </div>

                {allChores.length > 0 && (
                  <>
                    <h3 className="font-medium text-gray-700 mt-6">내 가사 목록</h3>
                    <div className="space-y-2">
                      {allChores.map(chore => (
                        <div key={chore.id}>
                          <button
                            onClick={() => openEditChore(chore)}
                            className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between text-left hover:bg-gray-50"
                          >
                            <div>
                              <h3 className="font-medium text-gray-900">{chore.name}</h3>
                              <p className="text-sm text-gray-500">{chore.category} • {chore.due_cycle === 'daily' ? '매일' : chore.due_cycle === 'weekly' ? '매주' : '매월'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-medium">
                                {chore.base_points * chore.weight}P
                              </span>
                              <span className="text-xs text-gray-400">가중치 {chore.weight}x</span>
                              <span className="text-gray-400">›</span>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'penalty' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-red-800 mb-2">⚠️ 벌칙 가사</h2>
              <p className="text-sm text-red-600 mb-4">
                이번 주 목표({weeklyStats.target}P)를 달성하지 못했어요.<br/>
                벌칙으로 아래 가사를 반드시 완료해야 합니다!
              </p>
              <button
                onClick={assignPenaltyChores}
                disabled={penaltyAssigned}
                className={`w-full py-3 rounded-xl font-bold ${
                  penaltyAssigned 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {penaltyAssigned ? '벌칙 가사 할당됨 ✓' : '벌칙 가사 받기'}
              </button>
            </div>

            <div className="space-y-2">
              {penaltyChores.map(penalty => (
                <div key={penalty.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between border-l-4 border-red-400">
                  <div>
                    <h3 className="font-medium text-gray-900">{penalty.chore_name}</h3>
                    <p className="text-sm text-red-500">벌칙 가사</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                    {penalty.points}P
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showAdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📺</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">광고 시청</h3>
            <p className="text-gray-600 mb-6">30초 광고를 시청하면 10포인트를 획득합니다!</p>
            <button
              onClick={watchAd}
              className="w-full py-3 bg-yellow-400 text-gray-900 rounded-xl font-bold hover:bg-yellow-500 mb-3"
            >
              광고 시청하기
            </button>
            <button
              onClick={() => setShowAdModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {editingChore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{editingChore.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{editingChore.category}</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">가중치</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editWeight}
                  onChange={(e) => setEditWeight(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="w-12 text-center font-bold text-primary-600">{editWeight}x</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-center">
                <span className="text-2xl font-bold text-primary-600">{editingChore.base_points * editWeight}</span>
                <span className="text-gray-500"> 포인트</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveEditChore}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
              >
                저장
              </button>
              <button
                onClick={() => setEditingChore(null)}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300"
              >
                취소
              </button>
            </div>
            
            <button
              onClick={() => {
                deleteChore(editingChore.id)
                setEditingChore(null)
              }}
              className="w-full mt-3 py-2 text-red-500 text-sm hover:text-red-700"
            >
              가사 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryView({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
  }, [userId, period])

  async function fetchHistory() {
    setLoading(true)
    const days = period === 'week' ? 7 : 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
      .from('user_chores')
      .select('*, chores (name, base_points, weight)')
      .eq('user_id', userId)
      .gte('assigned_at', startDate)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })

    if (data) setHistory(data)
    setLoading(false)
  }

  if (loading) return <div className="text-center py-8 text-gray-500">로딩 중...</div>

  const totalPoints = history.reduce((sum, h) => sum + h.points_awarded, 0)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-lg font-medium ${period === 'week' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
        >
          주간
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-lg font-medium ${period === 'month' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'}`}
        >
          월간
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-primary-600">{totalPoints}</p>
            <p className="text-sm text-gray-500">총 포인트</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">{history.length}</p>
            <p className="text-sm text-gray-500">완료한 가사</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {history.map((item, index) => (
          <div key={index} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{item.chores?.name}</p>
              <p className="text-sm text-gray-500">{new Date(item.completed_at).toLocaleDateString('ko-KR')}</p>
            </div>
            <span className="text-green-600 font-medium">+{item.points_awarded}P</span>
          </div>
        ))}
      </div>
    </div>
  )
}
