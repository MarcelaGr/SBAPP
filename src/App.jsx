import Clients from './pages/Clients'
import Calendar from './pages/Calendar'
import CaseList from './pages/CaseList'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Layout from './Layout'
import Cases from './pages/Cases'

function App() {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('cases')

  async function fetchStaff(userId) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', userId)
      .single()

    setStaff(error ? null : data)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaff(session.user.id)
      else {
        setStaff(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchStaff(session.user.id)
        else {
          setStaff(null)
          setLoading(false)
        }
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

  function renderPage() {
    switch (currentPage) {
      case 'cases': return <Cases staff={staff} />
      case 'clients': return <Clients staff={staff} />
      case 'calendar': return <Calendar staff={staff} />
      case 'caselist': return staff?.role === 'admin' ? <CaseList /> : null
      default: return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#0C447C', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{currentPage}</h2>
          <p style={{ color: '#888', fontSize: '13px' }}>This screen is coming soon.</p>
        </div>
      )
    }
  }

  return (
    <Layout user={session.user} staff={staff} currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </Layout>
  )
}

export default App
