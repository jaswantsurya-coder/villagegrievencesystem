import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Global Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: '#F8FAFC',
          color: '#0F172A',
          textAlign: 'center',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 16,
          }}>
            !
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: '#64748B', maxWidth: 400, margin: '0 0 20px', lineHeight: 1.5 }}>
            An unexpected error occurred while loading the dashboard.
          </p>
          <pre style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: 12,
            fontSize: 11,
            color: '#DC2626',
            maxWidth: 500,
            overflowX: 'auto',
            marginBottom: 20,
          }}>
            {this.state.error?.toString() || 'Unknown Error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: '#FFFFFF',
              background: '#2563EB',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
