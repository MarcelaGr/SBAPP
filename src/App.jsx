import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Layout from './Layout'

function App() {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaff(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchStaff(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchStaff(userId) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('id', userId)
      .single()
    setStaff(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
      Loading...
    </div>
  )

  if (!session) return <Login />

  return (
    <Layout
      user={session.user}
      staff={staff}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    >
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#0C447C', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
          {currentPage}
        </h2>
        <p style={{ color: '#888', fontSize: '13px' }}>
          This screen is coming soon.
        </p>
      </div>
    </Layout>
  )
}

export default App