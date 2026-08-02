import { useState, useEffect } from 'react'
import { supabase, supabaseAux } from '../lib/supabase'

export function usePlatformAnalytics() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState({
    // Summary Metrics
    slaSuccessRate: 100,
    resolutionRate: 0,
    avgTurnaroundDays: 0,
    escalationRate: 0,

    // Admin Requests (DB 2: sompzqwvegygtpsrlhzt)
    adminRequestsCount: 0,
    adminRequestsPending: 0,
    adminRequestsApproved: 0,
    adminRequestsRejected: 0,

    // Citizen App (DB 1: dtucrczgagpzjbbrwqit)
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    escalatedComplaints: 0,

    // Dynamic Chart Datasets
    trendData: [],
    categoryData: [],
    statusData: [],
    bestVillages: [],
  })

  useEffect(() => {
    fetchRealAnalytics()
  }, [])

  async function fetchRealAnalytics() {
    setLoading(true)
    try {
      // ─── 1. FETCH FROM DB 1: dtucrczgagpzjbbrwqit (Citizen App Data) ───────
      const [complaintsRes, villagesRes, profilesRes] = await Promise.all([
        supabaseAux.from('complaints').select('*'),
        supabaseAux.from('villages').select('*'),
        supabaseAux.from('profiles').select('id, village_id, role'),
      ])

      const complaints = complaintsRes.data || []
      const villages = villagesRes.data || []
      const profiles = profilesRes.data || []

      const total = complaints.length
      const resolved = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length
      const inProgress = complaints.filter((c) => c.status === 'In Progress').length
      const open = complaints.filter((c) => c.status === 'Open' || c.status === 'Pending').length
      const escalated = complaints.filter((c) => c.is_escalated === true || c.status === 'Escalated').length

      // SLA Calculations
      let slaMet = 0
      let totalResolutionMs = 0
      let resolvedWithTimeCount = 0

      complaints.forEach((c) => {
        // SLA breach check
        if (c.sla_deadline) {
          const deadline = new Date(c.sla_deadline)
          const created = new Date(c.created_at)
          if (c.status === 'Resolved' && c.resolved_at) {
            const resolvedAt = new Date(c.resolved_at)
            if (resolvedAt <= deadline) slaMet++
          } else if (new Date() <= deadline) {
            slaMet++
          }
        } else {
          slaMet++
        }

        // Turnaround calculation
        if (c.resolved_at && c.created_at) {
          const diffMs = new Date(c.resolved_at) - new Date(c.created_at)
          if (diffMs > 0) {
            totalResolutionMs += diffMs
            resolvedWithTimeCount++
          }
        }
      })

      const slaSuccessRate = total > 0 ? ((slaMet / total) * 100).toFixed(1) : '100.0'
      const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0'
      const escalationRate = total > 0 ? ((escalated / total) * 100).toFixed(1) : '0.0'

      const avgMs = resolvedWithTimeCount > 0 ? totalResolutionMs / resolvedWithTimeCount : 0
      const avgDays = (avgMs / (1000 * 60 * 60 * 24)).toFixed(1)

      // Category Breakdown
      const catCounts = {}
      const catColors = {
        'Roads & Infrastructure': '#2563EB',
        'Road & Infrastructure': '#2563EB',
        'Water Supply': '#38BDF8',
        'Drainage & Sewage': '#34D399',
        'Electricity': '#F59E0B',
        'Street Lights': '#8B5CF6',
        'Sanitation': '#EC4899',
        'Others': '#94A3B8',
      }

      complaints.forEach((c) => {
        const cat = c.category || 'Others'
        catCounts[cat] = (catCounts[cat] || 0) + 1
      })

      const categoryData = Object.entries(catCounts).map(([name, count]) => ({
        name,
        count,
        value: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0,
        color: catColors[name] || '#64748B',
      }))

      // Status Breakdown
      const statusData = [
        { name: 'Open', count: open, value: total > 0 ? parseFloat(((open / total) * 100).toFixed(1)) : 0, color: '#3B82F6' },
        { name: 'In Progress', count: inProgress, value: total > 0 ? parseFloat(((inProgress / total) * 100).toFixed(1)) : 0, color: '#F59E0B' },
        { name: 'Resolved', count: resolved, value: total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0, color: '#22C55E' },
        { name: 'Escalated', count: escalated, value: total > 0 ? parseFloat(((escalated / total) * 100).toFixed(1)) : 0, color: '#EF4444' },
      ]

      // Monthly Trend (Jan - Dec)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthlyCounts = Array(12).fill(0)
      complaints.forEach((c) => {
        if (c.created_at) {
          const d = new Date(c.created_at)
          monthlyCounts[d.getMonth()]++
        }
      })
      const trendData = monthNames.map((month, idx) => ({
        month,
        complaints: monthlyCounts[idx],
      }))

      // Village Performance Breakdown
      const villageMap = {}
      villages.forEach((v) => {
        villageMap[v.id] = {
          village: v.village_name || 'Village #' + v.id,
          district: v.district || 'Andhra Pradesh',
          total: 0,
          solved: 0,
        }
      })

      complaints.forEach((c) => {
        if (c.village_id && villageMap[c.village_id]) {
          villageMap[c.village_id].total++
          if (c.status === 'Resolved' || c.status === 'Closed') {
            villageMap[c.village_id].solved++
          }
        }
      })

      const bestVillages = Object.values(villageMap)
        .map((v) => {
          const resRate = v.total > 0 ? Math.round((v.solved / v.total) * 100) : 100
          return {
            ...v,
            resolutionRate: resRate,
            score: Math.min(100, resRate + 5),
          }
        })
        .sort((a, b) => b.resolutionRate - a.resolutionRate)

      // ─── 2. FETCH FROM DB 2: sompzqwvegygtpsrlhzt (Admin Requests / Member Applications)
      let adminReqTotal = 0
      let adminReqPending = 0
      let adminReqApproved = 0
      let adminReqRejected = 0

      try {
        const { data: adminReqs } = await supabase.from('admin_requests').select('*')
        if (adminReqs) {
          adminReqTotal = adminReqs.length
          adminReqPending = adminReqs.filter((r) => r.status === 'pending').length
          adminReqApproved = adminReqs.filter((r) => r.status === 'approved').length
          adminReqRejected = adminReqs.filter((r) => r.status === 'rejected').length
        }
      } catch (err) {
        console.warn('DB2 admin_requests fetch warning:', err)
      }

      setAnalytics({
        slaSuccessRate,
        resolutionRate,
        avgTurnaroundDays: avgDays,
        escalationRate,

        adminRequestsCount: adminReqTotal,
        adminRequestsPending: adminReqPending,
        adminRequestsApproved: adminReqApproved,
        adminRequestsRejected: adminReqRejected,

        totalComplaints: total,
        openComplaints: open,
        inProgressComplaints: inProgress,
        resolvedComplaints: resolved,
        escalatedComplaints: escalated,

        trendData,
        categoryData: categoryData.length > 0 ? categoryData : [{ name: 'No Issues Yet', value: 100, count: 0, color: '#94A3B8' }],
        statusData,
        bestVillages,
      })
    } catch (err) {
      console.error('Error fetching platform analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  return { loading, analytics, refresh: fetchRealAnalytics }
}
