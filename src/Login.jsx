import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1efe8',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '0.5px solid #d3d1c7',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '380px'
      }}>
        <div style={{
          background: '#0C447C',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ color: '#fff', fontWeight: '500', fontSize: '16px' }}>
            Stone Busailah LLP
          </div>
          <div style={{ color: '#85B7EB', fontSize: '12px', marginTop: '2px' }}>
            Pasadena, CA · Staff Portal
          </div>
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '4px', color: '#2c2c2a' }}>
          Sign in
        </h2>
        <p style={{ fontSize: '13px', color: '#888780', marginBottom: '1.5rem' }}>
          Enter your credentials to access the portal
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '0.5px solid #b4b2a9',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'sans-serif',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '0.5px solid #b4b2a9',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'sans-serif',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fcebeb',
              border: '0.5px solid #f09595',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#a32d2d',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: loading ? '#888' : '#0C447C',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'sans-serif'
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}