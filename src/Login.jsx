import { useState } from 'react'
import { supabase, supabaseEnvError } from './supabaseClient'
import logoImage from './assets/logo.png'
import marbleBg from './assets/marble-bg.jpg'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  function getLoginErrorMessage(error) {
    const message = error?.message || String(error)

    if (message.toLowerCase().includes('failed to fetch')) {
      return `${supabaseEnvError || 'Could not reach Supabase.'} Check that VITE_SUPABASE_URL points to an active Supabase project and that your network can reach it.`
    }

    return message
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setError(getLoginErrorMessage(error))
        setLoading(false)
      }
    } catch (error) {
      setError(getLoginErrorMessage(error))
      setLoading(false)
    }
  }

  return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        background: '#3a5080',
        width: '100%',
        boxSizing: 'border-box',
      }}>
      {/* Left panel */}
      <div style={{
        flex: '1 1 55%',
        background: `url(${marbleBg}) center/cover no-repeat`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left-panel">
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(58,80,128,0.82) 0%, rgba(58,80,128,0.45) 60%, rgba(0,0,0,0.22) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '13px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.78)',
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
        background: '#3a5080',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
      }} className="login-right-panel">
        <div style={{
          width: '100%',
          maxWidth: '380px',
          color: '#fff',
        }}>

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
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)',
              margin: '0 auto',
              maxWidth: '240px',
            }} />
          </div>

          <h2 style={{
            fontSize: '22px',
            fontWeight: '600',
            color: '#fff',
            marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', lineHeight: '1.5' }}>
            Sign in to access your staff portal
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#fff',
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
                  border: focusedField === 'email' ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.45)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(255,255,255,0.12)' : 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#fff',
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
                  border: focusedField === 'password' ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.45)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(255,255,255,0.12)' : 'none',
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
                  ? '#7a7a7a'
                  : '#8a8f98',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                boxShadow: loading ? 'none' : '0 10px 24px rgba(20, 24, 33, 0.22)',
                transition: 'box-shadow 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 12px 28px rgba(20, 24, 33, 0.3)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 10px 24px rgba(20, 24, 33, 0.22)' }}
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
            borderTop: '1px solid rgba(255,255,255,0.18)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>
              Stone Busailah LLP · Staff Portal
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-right-panel input::placeholder {
          color: rgba(255, 255, 255, 0.65);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 700px) {
          .login-left-panel { display: none !important; }
          .login-right-panel {
            max-width: 100% !important;
            flex: 1 1 100% !important;
            padding: 1.25rem !important;
            min-height: 100dvh;
          }
        }
      `}</style>
    </div>
  )
}
