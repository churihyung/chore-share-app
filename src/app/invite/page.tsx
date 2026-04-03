'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InvitePage() {
  const [mode, setMode] = useState<'join' | 'create' | 'success'>('create')
  const [inviteCode, setInviteCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [hasHousehold, setHasHousehold] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    const { data } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle()
    
    if (data?.household_id) {
      setHasHousehold(true)
    }
  }

  async function createHousehold() {
    if (!householdName.trim()) {
      setError('가구 이름을 입력하세요')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: household, error: hhError } = await supabase
        .from('households')
        .insert({ name: householdName })
        .select()
        .single()

      if (hhError) throw hhError

      await supabase
        .from('users')
        .update({ household_id: household.id })
        .eq('id', userId)

      const code = generateInviteCode()
      
      await supabase
        .from('household_invitations')
        .insert({
          household_id: household.id,
          code,
          created_by: userId
        })

      setGeneratedCode(code)
      setMode('success')
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function joinHousehold() {
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력하세요')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: invitation, error: invError } = await supabase
        .from('household_invitations')
        .select('*, households(*)')
        .eq('code', inviteCode.toUpperCase())
        .single()

      if (invError || !invitation) {
        throw new Error('유효하지 않은 초대 코드입니다')
      }

      if (invitation.used) {
        throw new Error('이미 사용된 초대 코드입니다')
      }

      await supabase
        .from('users')
        .update({ household_id: invitation.household_id })
        .eq('id', userId)

      await supabase
        .from('household_invitations')
        .update({ used: true, used_by: userId })
        .eq('id', invitation.id)

      router.push('/')
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  function copyCode() {
    navigator.clipboard.writeText(generatedCode)
    alert('클립보드에 복사되었습니다!')
  }

  if (hasHousehold) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">이미 가구에 참여 중입니다</h1>
          <p className="text-gray-600 mb-6">다른 가구에 참여하려면 현재 가구를 탈퇴해야 합니다.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">가구 생성 완료!</h1>
          <p className="text-gray-600 mb-4">이 코드를 가족에게 알려주세요:</p>
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-3xl font-bold text-center tracking-widest text-primary-600">
              {generatedCode}
            </p>
          </div>
          <button
            onClick={copyCode}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 mb-3"
          >
            코드 복사
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 text-primary-600 font-bold hover:text-primary-700"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🏠 가구 설정</h1>
          <p className="text-gray-500 mt-2">같이 사용할 가구를 만드세요</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-lg font-medium ${
              mode === 'create' ? 'bg-primary-600 text-white' : 'bg-gray-100'
            }`}
          >
            가구 만들기
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 rounded-lg font-medium ${
              mode === 'join' ? 'bg-primary-600 text-white' : 'bg-gray-100'
            }`}
          >
            코드 입력
          </button>
        </div>

        {mode === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                가구 이름
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white"
                placeholder="예: 홍길동네"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <button
              onClick={createHousehold}
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '생성 중...' : '가구 만들기'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초대 코드
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white text-center text-2xl tracking-widest font-bold"
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <button
              onClick={joinHousehold}
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '입력 중...' : '가구에 참여하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
