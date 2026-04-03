'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null)
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      window.location.href = '/login'
      return
    }

    setUserId(user.id)

    const { data, error } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) {
      console.error('User data error:', error)
      setHasHousehold(false)
    } else if (data?.household_id) {
      setHasHousehold(true)
    } else {
      setHasHousehold(false)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!hasHousehold) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">가구에 참여하세요</h1>
          <p className="text-gray-600 mb-6">가사를 함께 관리하려면 가구에 참여하거나 만드세요.</p>
          <a
            href="/invite"
            className="block w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
          >
            가구 설정하기
          </a>
        </div>
      </div>
    )
  }

  if (!userId) return null

  return <Dashboard userId={userId} />
}
