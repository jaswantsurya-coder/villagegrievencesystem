import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import PlatformHealth from '../components/PlatformHealth'
import ComplaintTrendChart from '../components/ComplaintTrendChart'
import CategoriesDonutChart from '../components/CategoriesDonutChart'
import StatusDonutChart from '../components/StatusDonutChart'
import LiveActivityFeed from '../components/LiveActivityFeed'
import BestPerformingVillages from '../components/BestPerformingVillages'
import HelpDeskCard from '../components/HelpDeskCard'
import AIInsightsCard from '../components/AIInsightsCard'
import RecentApprovalsCard from '../components/RecentApprovalsCard'
import AdminRequestModal from '../components/AdminRequestModal'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  ShieldCheck,
  Award,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  TriangleAlert,
  UserRoundCog,
  Eye,
  Check,
  X,
} from 'lucide-react'

export default function Overview() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    villages: 486,
    citizens: 24892,
    officers: 1248,
    sarpanchs: 486,
    complaints: 18573,
    resolutionRate: 87.6,
    openComplaints: 4218,
    inProgress: 3654,
    resolvedToday: 842,
    escalated: 236,
    pendingRequests: 12,
    activeOfficers: 1102,
  })
  const [recentRequests, setRecentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [villagesRes, pendingRes, complaintsRes, escalatedRes, requestsRes] = await Promise.all([
        supabase.from('villages').select('id', { count: 'exact', head: true }),
        supabase.from('admin_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('is_escalated', true),
        supabase
          .from('admin_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setStats((prev) => ({
        ...prev,
        villages: villagesRes.count || prev.villages,
        pendingRequests: pendingRes.count !== null ? pendingRes.count : prev.pendingRequests,
        complaints: complaintsRes.count || prev.complaints,
        escalated: escalatedRes.count || prev.escalated,
      }))

      if (requestsRes.data && requestsRes.data.length > 0) {
        setRecentRequests(requestsRes.data)
      } else {
        // Mock fallback requests if table is empty
        setRecentRequests([
          { id: 'req-1', full_name: 'Ramesh Babu', village_name: 'Peddapudi', district: 'Prakasam', state: 'Andhra Pradesh', created_at: new Date().toISOString(), status: 'pending' },
          { id: 'req-2', full_name: 'Lakshmi Narayana', village_name: 'Thummala palli', district: 'Kurnool', state: 'Andhra Pradesh', created_at: new Date().toISOString(), status: 'pending' },
          { id: 'req-3', full_name: 'Suresh Kumar', village_name: 'Velugodu', district: 'Guntur', state: 'Andhra Pradesh', created_at: new Date().toISOString(), status: 'pending' },
          { id: 'req-4', full_name: 'Anitha Devi', village_name: 'Ramapuram', district: 'Vizianagaram', state: 'Andhra Pradesh', created_at: new Date().toISOString(), status: 'pending' },
          { id: 'req-5', full_name: 'Venkatesh', village_name: 'Chintapalli', district: 'Alluri Sitarama Raju', state: 'Andhra Pradesh', created_at: new Date().toISOString(), status: 'pending' },
        ])
      }
    } catch (err) {
      console.error('Data load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveRequest(req, notes) {
    setActionLoading(true)
    try {
      await supabase
        .from('admin_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes || 'Approved by Super Admin',
        })
        .eq('id', req.id)

      setSelectedRequest(null)
      loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRejectRequest(req, reason) {
    setActionLoading(true)
    try {
      await supabase
        .from('admin_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', req.id)

      setSelectedRequest(null)
      loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* HERO SECTION & PLATFORM HEALTH */}
      <section style={styles.heroSection}>
        <div style={styles.welcomeBox}>
          <div style={styles.welcomeTitleRow}>
            <h1 style={styles.welcomeTitle}>Welcome back, Super Admin 👋</h1>
          </div>
          <p style={styles.welcomeSubtitle}>
            Monitor and manage the entire GramSeva platform from one centralized dashboard.
          </p>
        </div>

        <div style={styles.healthWrapper}>
          <PlatformHealth />
        </div>
      </section>

      {/* ANALYTICS STAT CARDS — ROW 1 */}
      <section style={styles.statsGridSix}>
        <StatCard
          title="Villages Registered"
          value={stats.villages.toLocaleString()}
          trend="▲ 24"
          subtitle="this month"
          trendType="up"
          icon={Building2}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          sparklineData={[420, 435, 450, 442, 460, 472, 486]}
          sparklineColor="#2563EB"
        />

        <StatCard
          title="Citizens"
          value={stats.citizens.toLocaleString()}
          trend="▲ 1,246"
          subtitle="this month"
          trendType="up"
          icon={Users}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
          sparklineData={[21000, 22200, 23100, 23900, 24892]}
          sparklineColor="#3B82F6"
        />

        <StatCard
          title="Officers"
          value={stats.officers.toLocaleString()}
          trend="▲ 56"
          subtitle="this month"
          trendType="up"
          icon={ShieldCheck}
          iconBg="#F3E8FF"
          iconColor="#8B5CF6"
          sparklineData={[1120, 1150, 1180, 1210, 1248]}
          sparklineColor="#8B5CF6"
        />

        <StatCard
          title="Sarpanchs"
          value={stats.sarpanchs.toLocaleString()}
          trend="▲ 18"
          subtitle="this month"
          trendType="up"
          icon={Award}
          iconBg="#FEF3C7"
          iconColor="#D97706"
          sparklineData={[420, 438, 452, 470, 486]}
          sparklineColor="#F59E0B"
        />

        <StatCard
          title="Total Complaints"
          value={stats.complaints.toLocaleString()}
          trend="▲ 2,153"
          subtitle="this month"
          trendType="up"
          icon={ClipboardList}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          sparklineData={[14000, 15200, 16800, 17900, 18573]}
          sparklineColor="#2563EB"
        />

        <StatCard
          title="Resolution Rate"
          value={`${stats.resolutionRate}%`}
          trend="▲ 5.3%"
          subtitle="vs last month"
          trendType="up"
          icon={TrendingUp}
          iconBg="#DCFCE7"
          iconColor="#166534"
          sparklineData={[78, 80, 82, 85, 87.6]}
          sparklineColor="#22C55E"
        />
      </section>

      {/* ANALYTICS STAT CARDS — ROW 2 */}
      <section style={{ ...styles.statsGridSix, marginTop: 16 }}>
        <StatCard
          title="Open Complaints"
          value={stats.openComplaints.toLocaleString()}
          subtitle="22.7% of total"
          icon={AlertCircle}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
          badgeText="Open"
          badgeBg="#DBEAFE"
          badgeColor="#1D4ED8"
          sparklineData={[4800, 4600, 4400, 4300, 4218]}
          sparklineColor="#3B82F6"
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress.toLocaleString()}
          subtitle="19.7% of total"
          icon={Clock}
          iconBg="#FEF3C7"
          iconColor="#D97706"
          badgeText="Pending"
          badgeBg="#FEF3C7"
          badgeColor="#B45309"
          sparklineData={[3200, 3400, 3550, 3654]}
          sparklineColor="#F59E0B"
        />

        <StatCard
          title="Resolved Today"
          value={stats.resolvedToday.toLocaleString()}
          trend="▲ 12.5%"
          subtitle="vs yesterday"
          trendType="up"
          icon={CheckCircle2}
          iconBg="#DCFCE7"
          iconColor="#15803D"
          sparklineData={[650, 720, 780, 842]}
          sparklineColor="#22C55E"
        />

        <StatCard
          title="Escalated Cases"
          value={stats.escalated.toLocaleString()}
          subtitle="High Priority"
          icon={TriangleAlert}
          iconBg="#FEE2E2"
          iconColor="#B91C1C"
          badgeText="Critical"
          badgeBg="#FEE2E2"
          badgeColor="#B91C1C"
          sparklineData={[280, 260, 250, 236]}
          sparklineColor="#EF4444"
        />

        <StatCard
          title="Pending Admin Requests"
          value={stats.pendingRequests.toLocaleString()}
          subtitle="Needs review"
          icon={UserRoundCog}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          badgeText="12 Action"
          badgeBg="#DBEAFE"
          badgeColor="#1D4ED8"
          sparklineData={[18, 15, 14, 12]}
          sparklineColor="#2563EB"
        />

        <StatCard
          title="Active Officers"
          value={stats.activeOfficers.toLocaleString()}
          subtitle="88.3% active"
          icon={ShieldCheck}
          iconBg="#DCFCE7"
          iconColor="#15803D"
          badgeText="Online"
          badgeBg="#DCFCE7"
          badgeColor="#15803D"
          sparklineData={[980, 1020, 1060, 1102]}
          sparklineColor="#22C55E"
        />
      </section>

      {/* GRAMSEVA ANALYTICS CHARTS — ROW 3 */}
      <section style={styles.chartsRow}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <ComplaintTrendChart />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <CategoriesDonutChart totalComplaints={stats.complaints} />
        </div>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <StatusDonutChart totalComplaints={stats.complaints} />
        </div>
      </section>

      {/* LIVE PLATFORM ACTIVITY & ADMIN REQUESTS & LEADERBOARD — ROW 4 */}
      <section style={styles.threeGridRow}>
        {/* Live Activity Feed */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <LiveActivityFeed />
        </div>

        {/* Recent Admin Requests */}
        <div style={{ flex: 1.4, minWidth: 380 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>Recent Admin Requests</h3>
                <p style={styles.cardSubtitle}>Sarpanch onboarding approvals</p>
              </div>
              <button onClick={() => navigate('/approvals')} style={styles.viewAllBtn}>
                View All
              </button>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Applicant</th>
                    <th style={styles.th}>Village</th>
                    <th style={styles.th}>District</th>
                    <th style={styles.th}>Submitted</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((r) => (
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.tdBold}>{r.full_name || 'Ramesh Babu'}</td>
                      <td style={styles.td}>{r.village_name}</td>
                      <td style={styles.tdMuted}>{r.district}</td>
                      <td style={styles.tdMono}>
                        {new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: r.status === 'approved' ? '#DCFCE7' : r.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                            color: r.status === 'approved' ? '#15803D' : r.status === 'rejected' ? '#B91C1C' : '#B45309',
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={styles.actionGroup}>
                          <button
                            onClick={() => setSelectedRequest(r)}
                            style={styles.actionIconBtn}
                            title="View Verification Details"
                          >
                            <Eye style={{ width: 14, height: 14, color: '#2563EB' }} />
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveRequest(r, 'Approved from Dashboard')}
                                style={{ ...styles.actionIconBtn, background: '#DCFCE7' }}
                                title="Approve"
                              >
                                <Check style={{ width: 14, height: 14, color: '#166534' }} />
                              </button>
                              <button
                                onClick={() => handleRejectRequest(r, 'Rejected from Dashboard')}
                                style={{ ...styles.actionIconBtn, background: '#FEE2E2' }}
                                title="Reject"
                              >
                                <X style={{ width: 14, height: 14, color: '#B91C1C' }} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Best Performing Villages */}
        <div style={{ flex: 1.1, minWidth: 320 }}>
          <BestPerformingVillages onViewAll={() => navigate('/villages')} />
        </div>
      </section>

      {/* HELP DESK & AI INSIGHTS & RECENT APPROVALS — ROW 5 */}
      <section style={styles.threeGridRow}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <HelpDeskCard onViewAll={() => navigate('/help-desk')} />
        </div>
        <div style={{ flex: 1.4, minWidth: 380 }}>
          <AIInsightsCard />
        </div>
        <div style={{ flex: 1.1, minWidth: 320 }}>
          <RecentApprovalsCard onViewAll={() => navigate('/approvals')} />
        </div>
      </section>

      {/* VERIFICATION MODAL */}
      {selectedRequest && (
        <AdminRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          loading={actionLoading}
        />
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  heroSection: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 20,
    flexWrap: 'wrap',
  },
  welcomeBox: {
    flex: 1,
    minWidth: 320,
    background: 'linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)',
    border: '1px solid #DBEAFE',
    borderRadius: 20,
    padding: '24px 28px',
    boxShadow: '0 4px 14px -2px rgba(37, 99, 235, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  welcomeTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0F172A',
    letterSpacing: '-0.02em',
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: '#475569',
    marginTop: 6,
    lineHeight: 1.4,
  },
  healthWrapper: {
    flex: 1.2,
    minWidth: 340,
  },
  statsGridSix: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 14,
  },
  chartsRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  threeGridRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 18,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: 700,
    color: '#0F172A',
    lineHeight: 1.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#2563EB',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '8px 8px',
    fontSize: 10.5,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
  },
  td: {
    padding: '10px 8px',
    color: '#0F172A',
  },
  tdBold: {
    padding: '10px 8px',
    fontWeight: 700,
    color: '#0F172A',
  },
  tdMuted: {
    padding: '10px 8px',
    color: '#64748B',
  },
  tdMono: {
    padding: '10px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 99,
    padding: '2px 8px',
    textTransform: 'capitalize',
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  actionIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
}
