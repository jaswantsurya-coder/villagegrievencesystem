import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Real-time admin requests hook.
 * Subscribes to Supabase Realtime on admin_requests table.
 * Provides request list, stats, and auto-refreshes on INSERT/UPDATE.
 */
export function useAdminRequests(filter = 'pending') {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  })
  const channelRef = useRef(null)

  // Fetch requests with optional filter
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch filtered list
      let query = supabase
        .from('admin_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (!error && data) {
        setRequests(data)
      } else {
        setRequests([])
      }

      // Fetch stats counts
      const [pendingRes, approvedRes, rejectedRes, totalRes] = await Promise.all([
        supabase.from('admin_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('admin_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('admin_requests').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('admin_requests').select('*', { count: 'exact', head: true }),
      ])

      setStats({
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
        total: totalRes.count || 0,
      })
    } catch (err) {
      console.error('[useAdminRequests] Fetch error:', err)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchRequests()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('admin_requests_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_requests' },
        (payload) => {
          const newReq = payload.new
          // Add to list if matches current filter
          if (filter === 'all' || newReq.status === filter) {
            setRequests(prev => [newReq, ...prev])
          }
          // Update stats
          setStats(prev => ({
            ...prev,
            pending: prev.pending + 1,
            total: prev.total + 1,
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_requests' },
        (payload) => {
          const updated = payload.new
          const old = payload.old

          // Update the item in list
          setRequests(prev => {
            const filtered = prev.map(r => r.id === updated.id ? updated : r)
            // Remove from list if status no longer matches filter
            if (filter !== 'all' && updated.status !== filter) {
              return filtered.filter(r => r.id !== updated.id)
            }
            return filtered
          })

          // Update stats if status changed
          if (old.status !== updated.status) {
            setStats(prev => {
              const newStats = { ...prev }
              if (old.status && newStats[old.status] !== undefined) {
                newStats[old.status] = Math.max(0, newStats[old.status] - 1)
              }
              if (updated.status && newStats[updated.status] !== undefined) {
                newStats[updated.status] = newStats[updated.status] + 1
              }
              return newStats
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [filter, fetchRequests])

  return {
    requests,
    stats,
    loading,
    refresh: fetchRequests,
  }
}
