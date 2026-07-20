import { useState } from 'react'
import { Plus, CheckSquare, Building2, Key, Download, Settings, X, Check, Copy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function QuickActions() {
  const [open, setOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // 'village' | 'code' | 'export'
  const [newVillageName, setNewVillageName] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')

  const navigate = useNavigate()

  function handleCreateVillage(e) {
    e.preventDefault()
    if (!newVillageName || !newDistrict) return
    const code = `GS-${Math.floor(10000 + Math.random() * 90000)}`
    setToast(`Village "${newVillageName}" registered successfully with code ${code}!`)
    setNewVillageName('')
    setNewDistrict('')
    setActiveModal(null)
  }

  function handleGenerateCode() {
    const code = `JOIN-${Math.floor(100000 + Math.random() * 900000)}`
    setGeneratedCode(code)
  }

  function handleExport() {
    setToast('GramSeva platform telemetry report exported successfully as CSV.')
    setActiveModal(null)
  }

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div style={styles.toastBox}>
          <Check style={{ width: 16, height: 16, color: '#166534' }} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} style={styles.toastClose}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Floating Action Menu */}
      <div style={styles.floatingContainer}>
        {open && (
          <div style={styles.menuBox}>
            <div style={styles.menuHeader}>QUICK ACTIONS</div>

            <button
              onClick={() => {
                setOpen(false)
                navigate('/approvals')
              }}
              style={styles.actionBtn}
              className="btn-interactive"
            >
              <CheckSquare style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span>Approve Requests</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                setActiveModal('village')
              }}
              style={styles.actionBtn}
              className="btn-interactive"
            >
              <Building2 style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span>Create Village</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                handleGenerateCode()
                setActiveModal('code')
              }}
              style={styles.actionBtn}
              className="btn-interactive"
            >
              <Key style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span>Generate Join Code</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                setActiveModal('export')
              }}
              style={styles.actionBtn}
              className="btn-interactive"
            >
              <Download style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span>Export Reports</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
              style={styles.actionBtn}
              className="btn-interactive"
            >
              <Settings style={{ width: 15, height: 15, color: '#2563EB' }} />
              <span>Platform Settings</span>
            </button>
          </div>
        )}

        <button onClick={() => setOpen(!open)} style={styles.fabBtn} className="btn-interactive" title="Quick Actions">
          {open ? <X style={{ width: 22, height: 22 }} /> : <Plus style={{ width: 22, height: 22 }} />}
        </button>
      </div>

      {/* CREATE VILLAGE MODAL */}
      {activeModal === 'village' && (
        <div style={styles.overlay} onClick={() => setActiveModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Register New Village</h3>
              <button onClick={() => setActiveModal(null)} style={styles.closeBtn}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <form onSubmit={handleCreateVillage} style={styles.modalBody}>
              <div>
                <label style={styles.label}>Village Name</label>
                <input
                  type="text"
                  placeholder="e.g. Peddapudi"
                  value={newVillageName}
                  onChange={(e) => setNewVillageName(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>District</label>
                <input
                  type="text"
                  placeholder="e.g. Prakasam"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setActiveModal(null)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} className="btn-interactive">
                  Create Village
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE JOIN CODE MODAL */}
      {activeModal === 'code' && (
        <div style={styles.overlay} onClick={() => setActiveModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Generated Village Join Code</h3>
              <button onClick={() => setActiveModal(null)} style={styles.closeBtn}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                Share this secure code with Sarpanch applicants for Panchayat onboarding:
              </p>
              <div style={styles.codeDisplayBox}>
                <span style={styles.codeText}>{generatedCode}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  style={styles.copyBtn}
                  className="btn-interactive"
                >
                  {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={styles.modalFooter}>
                <button onClick={() => handleGenerateCode()} style={styles.cancelBtn}>
                  Regenerate
                </button>
                <button onClick={() => setActiveModal(null)} style={styles.submitBtn} className="btn-interactive">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT REPORTS MODAL */}
      {activeModal === 'export' && (
        <div style={styles.overlay} onClick={() => setActiveModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Export Telemetry Report</h3>
              <button onClick={() => setActiveModal(null)} style={styles.closeBtn}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ fontSize: 13, color: '#64748B' }}>
                Export overall platform telemetry, complaints SLA, and village scores:
              </p>
              <div style={styles.modalFooter}>
                <button onClick={() => setActiveModal(null)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button onClick={handleExport} style={styles.submitBtn} className="btn-interactive">
                  Download CSV Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  toastBox: {
    position: 'fixed',
    top: 20,
    right: 24,
    zIndex: 99999,
    background: '#DCFCE7',
    border: '1px solid #86EFAC',
    color: '#166534',
    padding: '12px 18px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  },
  toastClose: {
    background: 'none',
    border: 'none',
    color: '#166534',
    cursor: 'pointer',
    marginLeft: 8,
  },
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
  },
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0F172A',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#F8FAFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    fontSize: 13,
    outline: 'none',
  },
  codeDisplayBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#F8FAFC',
    border: '1px solid #DBEAFE',
    borderRadius: 12,
    padding: '12px 16px',
    marginTop: 6,
  },
  codeText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 800,
    color: '#2563EB',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    background: '#2563EB',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 700,
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#64748B',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
  },
  submitBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    color: '#FFFFFF',
    background: '#2563EB',
  },
}
