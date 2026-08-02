import { useEffect, useState, useRef } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'
import { AlertCircle, ShieldCheck, CheckCircle2, Building2, FileText, Activity } from 'lucide-react'

export default function LiveActivityFeed() {
  const [feedItems, setFeedItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInitialActivities()
    const unsubscribe = setupRealtimeFeed()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  async function fetchInitialActivities() {
    setLoading(true)
    try {
      // 1. Fetch recent complaints
      const { data: recentComplaints } = await supabaseAux
        .from('complaints')
        .select('id, ticket_id, title, status, location, is_escalated, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10)

      // 2. Fetch recent admin requests from DB2
      const { data: recentReqs } = await supabase
        .from('admin_requests')
        .select('id, full_name, village_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      const formatted = []

      if (recentComplaints) {
        recentComplaints.forEach((c) => {
          const time = new Date(c.updated_at || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

          if (c.status === 'Resolved' || c.status === 'Closed') {
            formatted.push({
              id: `c-res-${c.id}`,
              time,
              title: 'Complaint Resolved',
              desc: `${c.ticket_id || 'Complaint'} • ${c.title || 'Grievance'} resolved`,
              tag: c.location || 'GramSeva Portal',
              icon: CheckCircle2,
              color: '#166534',
              bg: '#DCFCE7',
              timestamp: new Date(c.updated_at || c.created_at).getTime(),
            })
          } else if (c.is_escalated) {
            formatted.push({
              id: `c-esc-${c.id}`,
              time,
              title: 'Escalated Case',
              desc: `${c.ticket_id || 'Complaint'} flagged as critical SLA priority`,
              tag: c.location || 'Urgent',
              icon: AlertCircle,
              color: '#DC2626',
              bg: '#FEE2E2',
              timestamp: new Date(c.updated_at || c.created_at).getTime(),
            })
          } else {
            formatted.push({
              id: `c-file-${c.id}`,
              time,
              title: c.status === 'In Progress' ? 'Status Updated' : 'Complaint Filed',
              desc: `${c.ticket_id || 'GS-Ticket'} • ${c.title || 'New grievance registered'}`,
              tag: c.location || 'Village Portal',
              icon: c.status === 'In Progress' ? ShieldCheck : AlertCircle,
              color: c.status === 'In Progress' ? '#8B5CF6' : '#2563EB',
              bg: c.status === 'In Progress' ? '#F3E8FF' : '#EFF6FF',
              timestamp: new Date(c.created_at).getTime(),
            })
          }
        })
      }

      if (recentReqs) {
        recentReqs.forEach((r) => {
          const time = new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          formatted.push({
            id: `req-${r.id}`,
            time,
            title: 'Admin Application',
            desc: `${r.full_name} applied for ${r.village_name || 'Village Admin'}`,
            tag: r.village_name || 'Admin Request',
            icon: FileText,
            color: '#D97706',
            bg: '#FEF3C7',
            timestamp: new Date(r.created_at).getTime(),
          })
        })
      }

      // Sort combined by timestamp descending
      formatted.sort((a, b) => b.timestamp - a.timestamp)
      setFeedItems(formatted.slice(0, 7))
    } catch (err) {
      console.error('Error fetching live activity feed:', err)
    } finally {
      setLoading(false)
    }
  }

  function setupRealtimeFeed() {
    // Subscribe to Realtime INSERT and UPDATE on complaints table in Auxiliary DB
    const channel = supabaseAux
      .channel('live_activity_feed_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        (payload) => {
          const item = payload.new
          if (!item) return

          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const newEvent = {
            id: `rt-${item.id}-${Date.now()}`,
            time,
            title: payload.eventType === 'INSERT' ? '🔥 New Complaint Filed' : `⚡ Status Updated to ${item.status}`,
            desc: `${item.ticket_id || 'Ticket'} • ${item.title || 'Complaint'}`,
            tag: item.location || 'Live Event',
            icon: item.status === 'Resolved' ? CheckCircle2 : AlertCircle,
            color: item.status === 'Resolved' ? '#166534' : '#2563EB',
            bg: item.status === 'Resolved' ? '#DCFCE7' : '#EFF6FF',
            isNew: true,
          }

          setFeedItems((prev) => [newEvent, ...prev.slice(0, 6)])
        }
      )
      .subscribe()

    return () => {
      supabaseAux.removeChannel(channel)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <div style={styles.iconBox}>
            <Activity style={{ width: 16, height: 16, color: '#2563EB' }} />
          </div>
          <div>
            <h3 style={styles.title}>Live Activity Feed</h3>
            <p style={styles.subtitle}>Realtime citizen app & admin updates</p>
          </div>
        </div>

        <span style={styles.liveBadge}>
          <span style={styles.greenDot} className="pulse-dot" /> Live Websocket
        </span>
      </div>

      <div style={styles.feedList}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            Loading live activity...
          </div>
        ) : feedItems.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
            No platform activity recorded yet.
          </div>
        ) : (
          feedItems.map((item) => {
            const Icon = item.icon || AlertCircle
            return (
              <div key={item.id} style={{ ...styles.feedItem, background: item.isNew ? '#F0FDF4' : 'transparent' }}>
                <span style={styles.time}>{item.time}</span>

                <div style={{ ...styles.itemIconBox, background: item.bg, color: item.color }}>
                  <Icon style={{ width: 13, height: 13 }} />
                </div>

                <div style={styles.content}>
                  <div style={styles.itemTitle}>{item.title}</div>
                  <div style={styles.itemDesc}>{item.desc}</div>
                </div>

                <span style={styles.locationTag}>{item.tag}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    marginBottom: 14,
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    margin: '2px 0 0',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    borderRadius: 20,
    background: '#DCFCE7',
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: 700,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#22C55E',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    maxHeight: 280,
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    borderRadius: 10,
    transition: 'all 0.2s',
  },
  time: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: 600,
    width: 60,
    flexShrink: 0,
  },
  itemIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  itemDesc: {
    fontSize: 11,
    color: '#64748B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 2,
  },
  locationTag: {
    fontSize: 10,
    fontWeight: 600,
    color: '#475569',
    background: '#F1F5F9',
    padding: '2px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
}
