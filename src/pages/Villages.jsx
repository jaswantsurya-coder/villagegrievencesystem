import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Villages() {
  const [villages, setVillages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ village_name: '', district: '', state: 'Andhra Pradesh' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadVillages()
  }, [])

  async function loadVillages() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('villages')
        .select('id, village_name, district, state, join_code, sarpanch_user_id, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setVillages(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load villages.')
    } finally {
      setLoading(false)
    }
  }

  function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'GSV'
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const { error } = await supabase.from('villages').insert({
        village_name: form.village_name.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        join_code: generateJoinCode(),
      })
      if (error) throw error
      setForm({ village_name: '', district: '', state: 'Andhra Pradesh' })
      setShowForm(false)
      await loadVillages()
    } catch (err) {
      setError(err.message || 'Failed to create village. Note: villages policy requires super_admin.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p className="eyebrow">admin.gramseva.in &middot; registry</p>
          <h1 style={styles.pageTitle}>Villages</h1>
        </div>
        <button onClick={() => setShowForm((s) => !s)} style={styles.newBtn}>
          {showForm ? 'Cancel' : '+ New village'}
        </button>
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} style={styles.form}>
          <div style={styles.formRow}>
            <label style={styles.label}>
              Village name
              <input
                required
                value={form.village_name}
                onChange={(e) => setForm({ ...form, village_name: e.target.value })}
                style={styles.input}
                placeholder="e.g. Rasapudipalem"
              />
            </label>
            <label style={styles.label}>
              District
              <input
                required
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                style={styles.input}
                placeholder="e.g. Krishna"
              />
            </label>
            <label style={styles.label}>
              State
              <input
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                style={styles.input}
              />
            </label>
          </div>
          <button type="submit" disabled={creating} style={styles.submitBtn}>
            {creating ? 'Creating…' : 'Create village'}
          </button>
          <p style={styles.hint}>
            A join code is generated automatically. Note: village creation is usually handled
            via admin request approval — use this only for direct registry additions.
          </p>
        </form>
      )}

      {loading && <p style={styles.muted}>Loading villages…</p>}

      <div style={styles.grid}>
        {villages.map((v) => (
          <div key={v.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.villageName}>{v.village_name}</h3>
              <span style={styles.joinCode}>{v.join_code}</span>
            </div>
            <p style={styles.meta}>{v.district}, {v.state}</p>
            <p style={styles.meta}>
              {v.sarpanch_user_id ? 'Sarpanch assigned' : 'No sarpanch assigned'}
            </p>
            <p style={styles.dateStamp}>
              Registered {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '6px 0 0' },
  newBtn: {
    background: 'var(--green)',
    color: 'var(--parchment)',
    border: '1px solid var(--green-bright)',
    borderRadius: 3,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBanner: {
    background: 'rgba(201,96,30,0.1)',
    border: '1px solid rgba(201,96,30,0.3)',
    color: '#C9601E',
    padding: '10px 14px',
    borderRadius: 4,
    fontSize: 13,
    marginBottom: 20,
  },
  form: {
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'var(--surface)',
    padding: 20,
    marginBottom: 24,
  },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--stone)', fontWeight: 500 },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 3,
    padding: '9px 11px',
    color: 'var(--parchment)',
    fontSize: 13.5,
    fontFamily: 'var(--font-body)',
  },
  submitBtn: {
    background: 'var(--terracotta)',
    color: 'var(--parchment)',
    border: 'none',
    borderRadius: 3,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  hint: { fontSize: 11.5, color: 'var(--stone-dim)', marginTop: 10, marginBottom: 0, lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  card: { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: '16px 18px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  villageName: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, margin: 0 },
  joinCode: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--terracotta)' },
  meta: { fontSize: 12.5, color: 'var(--stone)', margin: '2px 0' },
  dateStamp: { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--stone-dim)', marginTop: 8, marginBottom: 0 },
  muted: { color: 'var(--stone)', fontSize: 13 },
}
