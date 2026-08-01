import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Real-time notifications hook for Super Admin Notification Center.
 * Subscribes to Supabase Realtime on sa_notifications table.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  // Fetch all notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sa_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.is_read).length)
      }
    } catch (err) {
      console.error('[useNotifications] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Mark a single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await supabase
        .from('sa_notifications')
        .update({ is_read: true })
        .eq('id', id)

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('[useNotifications] Mark read error:', err)
    }
  }, [])

  // Mark all notifications as read
  const markAllRead = useCallback(async () => {
    try {
      await supabase
        .from('sa_notifications')
        .update({ is_read: true })
        .eq('is_read', false)

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('[useNotifications] Mark all read error:', err)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('sa_notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sa_notifications' },
        (payload) => {
          const newNotif = payload.new
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sa_notifications' },
        (payload) => {
          const updated = payload.new
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? updated : n)
          )
          // Recalculate unread count
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.is_read).length)
            return prev
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    refresh: fetchNotifications,
  }
}
