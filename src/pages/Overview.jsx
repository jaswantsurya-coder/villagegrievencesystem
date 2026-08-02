import { useEffect, useState } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'
import { useAdminRequests } from '../hooks/useAdminRequests'
import { usePlatformAnalytics } from '../hooks/usePlatformAnalytics'
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
import StatDetailModal from '../components/StatDetailModal'
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
  AlertTriangle,
  UserCheck,
  Eye,
  Check,
  X,
} from 'lucide-react'

export default function Overview() {
  const navigate = useNavigate()
  const { requests: adminRequests, stats: adminRequestStats } = useAdminRequests('all')
  const { loading: analyticsLoading, analytics } = usePlatformAnalytics()
  const [stats, setStats] = useState({
    villages: 0,
    citizens: 0,
    officers: 0,
    sarpanchs: 0,
    complaints: 0,
    resolutionRate: 0,
    openComplaints: 0,
    inProgress: 0,
    resolvedToday: 0,
    escalated: 0,
    pendingRequests: 0,
    activeOfficers: 0,
  })
  const [recentRequests, setRecentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedStat, setSelectedStat] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Sync admin request stats from real-time hook
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      pendingRequests: adminRequestStats.pending,
    }))
    if (adminRequests.length > 0) {
      setRecentRequests(adminRequests.slice(0, 5))
    }
  }, [adminRequestStats, adminRequests])

  useEffect(() => {
    loadData()

    // Realtime WebSocket Subscription: Subscribe to complaints, profiles, and villages in Auxiliary DB
    const channel = supabaseAux
      .channel('overview_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'villages' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabaseAux.removeChannel(channel)
    }
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Fetch real counts from dtucrczgagpzjbbrwqit (villages, profiles, complaints)
      const todayStart = new Date()
      todayStart.setHours(0,0,0,0)

      const [
        villagesRes,
        citizensRes,
        officersRes,
        sarpanchsRes,
        complaintsRes,
        openRes,
        inProgressRes,
        resolvedTodayRes,
        resolvedTotalRes,
        escalatedRes,
        pendingRes,
        requestsRes,
      ] = await Promise.all([
        supabaseAux.from('villages').select('id', { count: 'exact', head: true }),
        supabaseAux.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'citizen'),
        supabaseAux.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['officer', 'village_admin']),
        supabaseAux.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['sarpanch', 'village_admin']),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['Open', 'Pending']),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'In Progress'),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['Resolved', 'Closed']).gte('updated_at', todayStart.toISOString()),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['Resolved', 'Closed']),
        supabaseAux.from('complaints').select('id', { count: 'exact', head: true }).eq('is_escalated', true),
        supabase.from('admin_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('admin_requests').select('*').order('created_at', { ascending: false }).limit(5),
      ])

      const totalComp = complaintsRes.count || 0
      const resolvedComp = resolvedTotalRes.count || 0
      const resRate = totalComp > 0 ? parseFloat(((resolvedComp / totalComp) * 100).toFixed(1)) : 0

      setStats({
        villages: villagesRes.count || 0,
        citizens: citizensRes.count || 0,
        officers: officersRes.count || 0,
        sarpanchs: sarpanchsRes.count || 0,
        complaints: totalComp,
        resolutionRate: resRate,
        openComplaints: openRes.count || 0,
        inProgress: inProgressRes.count || 0,
        resolvedToday: resolvedTodayRes.count || 0,
        escalated: escalatedRes.count || 0,
        pendingRequests: pendingRes.count || 0,
        activeOfficers: officersRes.count || 0,
      })

      if (requestsRes.data && requestsRes.data.length > 0) {
        setRecentRequests(requestsRes.data)
      } else {
        const auxReqs = await supabaseAux
          .from('admin_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
        setRecentRequests(auxReqs.data || [])
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
      <section className="stats-grid-six">
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
          onClick={() =>
            setSelectedStat({
              title: 'Villages Registered',
              value: stats.villages.toLocaleString(),
              subtitle: '▲ 24 added this month',
              icon: Building2,
              iconBg: '#EFF6FF',
              iconColor: '#2563EB',
              targetPath: '/villages',
              details: [
                { label: 'Active Panchayats', value: '486 Villages' },
                { label: 'Growth this month', value: '+24 new villages' },
                { label: 'Health Index', value: '98.2% Optimal' },
                { label: 'Join Codes Active', value: '486 Codes Issued' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Citizens Network',
              value: stats.citizens.toLocaleString(),
              subtitle: '▲ 1,246 registered this month',
              icon: Users,
              iconBg: '#EFF6FF',
              iconColor: '#3B82F6',
              targetPath: '/citizens',
              details: [
                { label: 'Total Registered Citizens', value: '24,892 Users' },
                { label: 'Active This Week', value: '18,450 Citizens' },
                { label: 'Awaiting Village Join', value: '342 Citizens' },
                { label: 'Verification Rate', value: '99.4% Verified' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Village Officers',
              value: stats.officers.toLocaleString(),
              subtitle: '▲ 56 assigned this month',
              icon: ShieldCheck,
              iconBg: '#F3E8FF',
              iconColor: '#8B5CF6',
              targetPath: '/officers',
              details: [
                { label: 'Total Field Inspectors', value: '1,248 Officers' },
                { label: 'Currently On Duty', value: '1,102 Active' },
                { label: 'Pending Assignments', value: '46 Villages' },
                { label: 'Avg SLA Speed', value: '4.6 Days' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Sarpanch Network',
              value: stats.sarpanchs.toLocaleString(),
              subtitle: '▲ 18 verified this month',
              icon: Award,
              iconBg: '#FEF3C7',
              iconColor: '#D97706',
              targetPath: '/approvals',
              details: [
                { label: 'Verified Sarpanchs', value: '486 Leaders' },
                { label: 'Pending Approvals', value: '12 Applicants' },
                { label: 'Verification Method', value: 'Aadhaar + GP Seal' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Total Complaints',
              value: stats.complaints.toLocaleString(),
              subtitle: '▲ 2,153 filed this month',
              icon: ClipboardList,
              iconBg: '#EFF6FF',
              iconColor: '#2563EB',
              targetPath: '/complaints',
              details: [
                { label: 'Total Tracked Complaints', value: '18,573 Tickets' },
                { label: 'Resolved Complaints', value: '10,465 (56.3%)' },
                { label: 'Top Category', value: 'Roads & Infrastructure' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Resolution Rate & SLA',
              value: `${stats.resolutionRate}%`,
              subtitle: '▲ 5.3% improvement vs last month',
              icon: TrendingUp,
              iconBg: '#DCFCE7',
              iconColor: '#166534',
              targetPath: '/analytics',
              details: [
                { label: 'Resolution Rate', value: '87.6%' },
                { label: 'Average Resolution Time', value: '4.6 Days' },
                { label: 'SLA Success Target', value: '94.2%' },
              ],
            })
          }
        />
      </section>

      {/* ANALYTICS STAT CARDS — ROW 2 */}
      <section className="stats-grid-six" style={{ marginTop: 16 }}>
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
          onClick={() =>
            setSelectedStat({
              title: 'Open Complaints',
              value: stats.openComplaints.toLocaleString(),
              subtitle: '22.7% of total complaints',
              icon: AlertCircle,
              iconBg: '#EFF6FF',
              iconColor: '#3B82F6',
              targetPath: '/complaints',
              details: [
                { label: 'Active Open Issues', value: '4,218 Tickets' },
                { label: 'Priority High', value: '1,120 Tickets' },
                { label: 'Assigned to Officers', value: '3,890 Tickets' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'In Progress Issues',
              value: stats.inProgress.toLocaleString(),
              subtitle: '19.7% of total complaints',
              icon: Clock,
              iconBg: '#FEF3C7',
              iconColor: '#D97706',
              targetPath: '/complaints',
              details: [
                { label: 'Work Orders Active', value: '3,654 Tickets' },
                { label: 'On-site Field Work', value: '2,890 Tickets' },
                { label: 'Expected Close', value: '< 48 Hours' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Resolved Today',
              value: stats.resolvedToday.toLocaleString(),
              subtitle: '▲ 12.5% increase vs yesterday',
              icon: CheckCircle2,
              iconBg: '#DCFCE7',
              iconColor: '#15803D',
              targetPath: '/complaints',
              details: [
                { label: 'Closed Today', value: '842 Complaints' },
                { label: 'Citizen Satisfaction', value: '96.4% Positive' },
              ],
            })
          }
        />

        <StatCard
          title="Escalated Cases"
          value={stats.escalated.toLocaleString()}
          subtitle="High Priority"
          icon={AlertTriangle}
          iconBg="#FEE2E2"
          iconColor="#B91C1C"
          badgeText="Critical"
          badgeBg="#FEE2E2"
          badgeColor="#B91C1C"
          sparklineData={[280, 260, 250, 236]}
          sparklineColor="#EF4444"
          onClick={() =>
            setSelectedStat({
              title: 'Escalated Cases',
              value: stats.escalated.toLocaleString(),
              subtitle: 'Requires immediate Super Admin attention',
              icon: AlertTriangle,
              iconBg: '#FEE2E2',
              iconColor: '#B91C1C',
              targetPath: '/complaints',
              details: [
                { label: 'Overdue Complaints (>48h)', value: '236 Cases' },
                { label: 'Department Escalations', value: 'Water & Electricity' },
                { label: 'Action Required', value: 'Reassign Field Officer' },
              ],
            })
          }
        />

        <StatCard
          title="Pending Admin Requests"
          value={stats.pendingRequests.toLocaleString()}
          subtitle="Needs review"
          icon={UserCheck}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
          badgeText={`${stats.pendingRequests} Action`}
          badgeBg="#DBEAFE"
          badgeColor="#1D4ED8"
          sparklineData={[18, 15, 14, 12]}
          sparklineColor="#2563EB"
          onClick={() =>
            setSelectedStat({
              title: 'Pending Admin Requests',
              value: stats.pendingRequests.toLocaleString(),
              subtitle: 'Sarpanch onboarding requests waiting for verification',
              icon: UserCheck,
              iconBg: '#EFF6FF',
              iconColor: '#2563EB',
              targetPath: '/approvals',
              details: [
                { label: 'Unreviewed Applications', value: `${stats.pendingRequests} Requests` },
                { label: 'Documents Uploaded', value: 'Aadhaar & Panchayat Proof' },
                { label: 'Avg Review Time', value: '1.2 Hours' },
              ],
            })
          }
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
          onClick={() =>
            setSelectedStat({
              title: 'Active Field Officers',
              value: stats.activeOfficers.toLocaleString(),
              subtitle: '88.3% on duty across Panchayats',
              icon: ShieldCheck,
              iconBg: '#DCFCE7',
              iconColor: '#15803D',
              targetPath: '/officers',
              details: [
                { label: 'Officers Currently Active', value: '1,102 Inspectors' },
                { label: 'Off-duty / Leave', value: '146 Inspectors' },
                { label: 'Top Department', value: 'Roads & Infrastructure' },
              ],
            })
          }
        />
      </section>

      {/* GRAMSEVA ANALYTICS CHARTS — ROW 3 */}
      <section style={styles.chartsRow}>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <ComplaintTrendChart trendData={analytics.trendData} />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <CategoriesDonutChart categoryData={analytics.categoryData} totalComplaints={stats.complaints} />
        </div>
        <div style={{ flex: 1.2, minWidth: 320 }}>
          <StatusDonutChart
            statusData={analytics.statusData}
            totalComplaints={stats.complaints}
            avgTurnaroundDays={analytics.avgTurnaroundDays}
          />
        </div>
      </section>

      {/* LIVE PLATFORM ACTIVITY & ADMIN REQUESTS & LEADERBOARD — ROW 4 */}
      <section style={styles.threeGridRow}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <LiveActivityFeed />
        </div>

        <div style={{ flex: 1.4, minWidth: 380 }}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>Recent Admin Requests</h3>
                <p style={styles.cardSubtitle}>Sarpanch onboarding approvals</p>
              </div>
              <button onClick={() => navigate('/approvals')} style={styles.viewAllBtn} className="btn-interactive">
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
                            className="btn-interactive"
                            title="View Verification Details"
                          >
                            <Eye style={{ width: 14, height: 14, color: '#2563EB' }} />
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveRequest(r, 'Approved from Dashboard')}
                                style={{ ...styles.actionIconBtn, background: '#DCFCE7' }}
                                className="btn-interactive"
                                title="Approve Request"
                              >
                                <Check style={{ width: 14, height: 14, color: '#166534' }} />
                              </button>
                              <button
                                onClick={() => handleRejectRequest(r, 'Rejected from Dashboard')}
                                style={{ ...styles.actionIconBtn, background: '#FEE2E2' }}
                                className="btn-interactive"
                                title="Reject Request"
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

        <div style={{ flex: 1.1, minWidth: 320 }}>
          <BestPerformingVillages bestVillages={analytics.bestVillages} onViewAll={() => navigate('/villages')} />
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

      {/* STAT DETAIL MODAL */}
      {selectedStat && (
        <StatDetailModal
          data={selectedStat}
          onClose={() => setSelectedStat(null)}
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
