import { useCallback, useEffect, useState } from 'react'
import {
  fetchGamificationStats,
  type GamificationStats,
} from '@/lib/gamification-api'

export function useGamificationStats() {
  const [stats, setStats] = useState<GamificationStats | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchGamificationStats()
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { stats, loading, refresh }
}
