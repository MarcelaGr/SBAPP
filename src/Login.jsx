import { useState } from 'react'
import { supabase } from './supabaseClient'
import logoImage from './assets/logo.png'
import marbleBg from './assets/marble-bg.jpg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* Left panel — marble background */}
      <div style={{
        flex: '1 1 55%',
        background: `url(${marbleBg}) center/cover no-repeat`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(12,68,124,0.82) 0%, rgba(12,68,124,0.45) 60%, rgba(0,0,0,0.25) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '13px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: '8px',
            fontWeight: '500'
          }}>
            Pasadena, CA
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: '300',
            color: '#fff',
            lineHeight: '1.3',
            maxWidth: '360px'
          }}>
            Staff Management Portal
          </div>
          <div style={{
            width: '40px',
            height: '2px',
            background: 'rgba(255,255,255,0.4)',
            marginTop: '20px',
          }} />
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: '1 1 45%',
        background: '#faf9f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2.5rem',
        minWidth: '360px',
        maxWidth: '520px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>

          {/* Logo */}
          <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
            <img
              src={logoImage}
              alt="Stone Busailah LLP"
              style={{
                maxWidth: '220px',
                width: '100%',
                height: 'auto',
                display: 'block',
                margin: '0 auto 16px',
              }}
            />
            <div style={{
              height: '1px',
              background: 'linear-gradient(to right, transparent, #d3d1c7, transparent)',
              margin: '0 auto',
              maxWidth: '240px',
            }} />
          </div>

          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: '#1a1a18',
            marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '14px', color: '#888780', marginBottom: '2rem', lineHeight: '1.5' }}>
            Sign in to access your staff portal
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#5f5e5a',
                display: 'block',
                marginBottom: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: focusedField === 'email' ? '1.5px solid #0C447C' : '1px solid #d3d1c7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  background: '#fff',
                  color: '#1a1a18',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(12,68,124,0.08)' : 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#5f5e5a',
                display: 'block',
                marginBottom: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: focusedField === 'password' ? '1.5px solid #0C447C' : '1px solid #d3d1c7',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  background: '#fff',
                  color: '#1a1a18',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(12,68,124,0.08)' : 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#991b1b',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="7"/>
                  <path d="M8 5v4M8 11h.01"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading
                  ? '#6b8fb8'
                  : 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(12,68,124,0.3)',
                transition: 'box-shadow 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(12,68,124,0.4)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 2px 8px rgba(12,68,124,0.3)' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e8e6e0',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#b4b2a9', letterSpacing: '0.02em' }}>
              Stone Busailah LLP · Staff Portal
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 700px) {
          .login-left-panel { display: none !important; }
          .login-right-panel { max-width: 100% !important; flex: 1 1 100% !important; }
        }
      `}</style>
    </div>
  )
}
