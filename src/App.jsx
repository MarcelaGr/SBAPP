import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, supabaseEnvError } from './supabaseClient'
import Login from './Login'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseList from './pages/CaseList'
import Clients from './pages/Clients'
import Calendar from './pages/Calendar'
import Timesheets from './pages/Timesheets'
import Messages from './pages/Messages'
import Billing from './pages/Invoices'
import Settings from './pages/Settings'
import { canManageInvoices, canManageSettings, INITIAL_USER_SEEDS, isAdminRole, isAttorneyRole, normalizeRole } from './lib/roles'
import { useChatNotifications } from './hooks/useChatNotifications'

function App() {
  const [session, setSession] = useState(null)
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [authError, setAuthError] = useState('')

  const isAttorney = isAttorneyRole(staff?.role) || staff?.is_attorney === true
  const isAdmin = isAdminRole(staff?.role)
  const notifications = useChatNotifications(staff, currentPage)

  async function fetchStaff(user) {
    const userId = user?.id
    const email = (user?.email || '').toLowerCase()

    if (!userId) {
      setAuthError('Missing authenticated user ID')
      setStaff(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      const message = String(error.message || '')
      if (message.toLowerCase().includes('jwt') && message.toLowerCase().includes('expired')) {
        await supabase.auth.signOut()
        setSession(null)
        setAuthError('Session expired. Please sign in again.')
      } else {
        setAuthError(message)
      }
      setStaff(null)
      setLoading(false)
      return
    }

    if (!data) {
      const seededUser = INITIAL_USER_SEEDS.find((item) => item.email.toLowerCase() === email)

      if (seededUser) {
        const fallbackRow = {
          id: userId,
          email,
          full_name: seededUser.name,
          initials: seededUser.name.slice(0, 2).toUpperCase(),
          role: seededUser.role,
          active: true,
        }

        const { data: upsertedStaff, error: upsertError } = await supabase
          .from('staff')
          .upsert(fallbackRow, { onConflict: 'id' })
          .select('*')
          .single()

        if (!upsertError && upsertedStaff) {
          setAuthError('')
          setStaff({
            ...upsertedStaff,
            role: normalizeRole(upsertedStaff.role, upsertedStaff.is_attorney ? 'attorney' : 'attorney'),
          })
          setLoading(false)
          return
        }
      }

      setStaff(null)
      setLoading(false)
      return
    }

    setAuthError('')
    setStaff({ ...data, role: normalizeRole(data.role, data.is_attorney ? 'attorney' : 'attorney') })
    setLoading(false)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchStaff(session.user)
      else {
        setStaff(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) fetchStaff(session.user)
        else {
          setStaff(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f1efe8', fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '560px', background: '#fff', borderRadius: '12px', border: '0.5px solid #d3d1c7', padding: '1.75rem' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a', marginBottom: '0.5rem' }}>Supabase configuration required</div>
          <div style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6' }}>{supabaseEnvError}</div>
          <div style={{ marginTop: '1rem', fontSize: '12px', color: '#888780', lineHeight: '1.6' }}>
            Expected environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        color: '#888'
      }}>
        Loading...
      </div>
    )
  }

  if (!session) return <Login />

  if (!staff) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f1efe8', fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '560px', background: '#fff', borderRadius: '12px', border: '0.5px solid #d3d1c7', padding: '1.75rem' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a', marginBottom: '0.5rem' }}>No staff profile found</div>
          <div style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6' }}>
            Sign-in succeeded, but this user does not have a matching `staff` row yet.
          </div>
          {authError && <div style={{ marginTop: '0.75rem', fontSize: '12px', color: '#a32d2d' }}>{authError}</div>}
          <div style={{ marginTop: '1rem', fontSize: '12px', color: '#888780', lineHeight: '1.6' }}>
            Seed the initial users in Supabase, then sign in again.
          </div>
        </div>
      </div>
    )
  }

  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard staff={staff} setCurrentPage={setCurrentPage} isAttorney={isAttorney} />

      case 'cases':
        return <Cases staff={staff} isAttorney={isAttorney} />

      case 'caselist':
        return isAdmin ? <CaseList /> : null

      case 'clients':
        return <Clients staff={staff} />

      case 'calendar':
        return <Calendar staff={staff} />

      case 'timesheets':
        return <Timesheets staff={staff} isAttorney={isAttorney} />

      case 'messages':
        return <Messages staff={staff} />

      case 'billing':
      case 'invoices':
        return canManageInvoices(staff?.role) ? <Billing staff={staff} /> : null

      case 'settings':
        return canManageSettings(staff?.role) ? <Settings staff={staff} /> : null

      default:
        return (
          <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h2 style={{
              color: '#0C447C',
              marginBottom: '0.5rem',
              textTransform: 'capitalize'
            }}>
              {currentPage}
            </h2>
            <p style={{ color: '#888', fontSize: '13px' }}>
              This screen is coming soon.
            </p>
          </div>
        )
    }
  }

  return (
    <Layout
      user={session.user}
      staff={staff}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      notifications={notifications.notifications}
      unreadNotifications={notifications.unreadCount}
      onOpenNotifications={notifications.markAllRead}
      onDismissNotification={notifications.dismissNotification}
    >
      {renderPage()}
    </Layout>
  )
}

export default App
