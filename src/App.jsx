import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
      Loading...
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#0C447C' }}>Stone Busailah LLP</h1>
      <p>Welcome, {session.user.email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{ marginTop: '1rem', padding: '8px 16px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
      >
        Sign out
      </button>
    </div>
  )
}

export default App