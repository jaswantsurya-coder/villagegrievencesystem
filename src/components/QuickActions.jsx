import { useState } from 'react'
import { Plus, CheckSquare, Building2, Key, Download, Settings, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function QuickActions() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const actions = [
    { label: 'Approve Requests', icon: CheckSquare, onClick: () => navigate('/approvals') },
    { label: 'Create Village', icon: Building2, onClick: () => navigate('/villages') },
    { label: 'Generate Join Code', icon: Key, onClick: () => navigate('/villages') },
    { label: 'Export Reports', icon: Download, onClick: () => navigate('/analytics') },
    { label: 'Platform Settings', icon: Settings, onClick: () => navigate('/settings') },
  ]

  return (
    <div style={styles.floatingContainer}>
      {open && (
        <div style={styles.menuBox}>
          <div style={styles.menuHeader}>QUICK ACTIONS</div>
          {actions.map((act, idx) => {
            const Icon = act.icon
            return (
              <button
                key={idx}
                onClick={() => {
                  setOpen(false)
                  act.onClick()
                }}
                style={styles.actionBtn}
              >
                <Icon style={{ width: 15, height: 15, color: '#2563EB' }} />
                <span>{act.label}</span>
              </button>
            )
          })}
        </div>
      )}

      <button onClick={() => setOpen(!open)} style={styles.fabBtn} title="Quick Actions">
        {open ? <X style={{ width: 22, height: 22 }} /> : <Plus style={{ width: 22, height: 22 }} />}
      </button>
    </div>
  )
}

const styles = {
  floatingContainer: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  fabBtn: {
    width: 52,
    height: 52,
    borderRadius: 99,
    background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(29, 78, 216, 0.4)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  menuBox: {
    marginBottom: 12,
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: 10,
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 200,
  },
  menuHeader: {
    fontSize: 9.5,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: '0.08em',
    padding: '4px 8px 6px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#0F172A',
    background: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s ease',
  },
}
