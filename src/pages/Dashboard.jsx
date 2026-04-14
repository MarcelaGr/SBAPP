import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard({ staff, setCurrentPage, isAttorney }) {
  const [data, setData] = useState({
    cases: [], entries: [], events: [], invoices: [], comments: [], reports: []
  })
  const [loading, setLoading] = useState(true)
  const isAdmin = staff?.role === 'admin'
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().getMonth() + 1
  const thisYear = new Date().getFullYear()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [casesRes, entriesRes, eventsRes, invoicesRes, commentsRes, reportsRes] = await Promise.all([
      supabase.from('cases').select('*, clients(first_name, last_name), associations(short_name), case_attorneys(attorney_id, is_lead)').order('created_at', { ascending: false }),
      supabase.from('time_entries').select('*, staff:attorney_id(full_name, initials), cases(sb_number)').order('created_at', { ascending: false }).limit(50),
      supabase.from('calendar_events').select('*, cases(sb_number, brief_description), staff:attorney_id(full_name, initials)').gte('event_date', today).order('event_date', { ascending: true }).order('event_time', { ascending: true }).limit(10),
      supabase.from('invoices').select('*').eq('period_month', thisMonth).eq('period_year', thisYear),
      supabase.from('comments').select('*, staff:author_id(full_name, initials), cases(sb_number)').order('created_at', { ascending: false }).limit(20),
      supabase.from('status_reports').select('*, attorney:attorney_id(full_name, initials), cases(sb_number, brief_description, clients(first_name, last_name))').order('created_at', { ascending: false }).limit(20),
    ])

    let cases = casesRes.data || []
    let entries = entriesRes.data || []
    let events = eventsRes.data || []
    let reports = reportsRes.data || []

    if (!isAdmin) {
      cases = cases.filter(c => c.case_attorneys?.some(a => a.attorney_id === staff?.id))
      entries = entries.filter(e => e.attorney_id === staff?.id)
      events = events.filter(e => e.attorney_id === staff?.id)
      reports = reports.filter(r => r.attorney_id === staff?.id)
    }

    setData({ cases, entries, events, invoices: invoicesRes.data || [], comments: commentsRes.data || [], reports })
    setLoading(false)
  }

  const formatDate = (d) => {
    if (!d) return '—'
    const date = new Date(d + 'T12:00:00')
    const now = new Date()
    const diffDays = Math.round((date - now) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  const formatRelative = (ts) => {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    return `${days}d ago`
  }

  const eventTypeStyle = (type) => {
    const map = {
      hearing: { bg: '#E6F1FB', color: '#0C447C', dot: '#378ADD' },
      meeting: { bg: '#E1F5EE', color: '#085041', dot: '#1D9E75' },
      deadline: { bg: '#FCEBEB', color: '#791F1F', dot: '#E24B4A' },
      reminder: { bg: '#FAEEDA', color: '#633806', dot: '#EF9F27' },
    }
    return map[type] || map.hearing
  }

  const statusBadge = (status, small = false) => {
    const styles = { active: { background: '#eaf3de', color: '#27500a' }, pending: { background: '#faeeda', color: '#633806' }, closed: { background: '#f1efe8', color: '#5f5e5a' } }
    return <span style={{ ...styles[status], padding: small ? '1px 6px' : '2px 8px', borderRadius: '20px', fontSize: small ? '10px' : '11px', fontWeight: '500' }}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</span>
  }

  const avatarColor = (initials) => {
    const colors = [{ bg: '#E6F1FB', color: '#0C447C' }, { bg: '#E1F5EE', color: '#085041' }, { bg: '#FAEEDA', color: '#633806' }, { bg: '#EEEDFE', color: '#3C3489' }, { bg: '#FAECE7', color: '#712B13' }]
    return colors[(initials?.charCodeAt(0) || 0) % colors.length]
  }

  const activeCases = data.cases.filter(c => c.status === 'active')
  const myCases = isAdmin ? data.cases : data.cases.filter(c => c.case_attorneys?.some(a => a.attorney_id === staff?.id))
  const pendingEntries = data.entries.filter(e => e.status === 'pending')
  const reviewEntries = data.entries.filter(e => e.status === 'review')
  const myHoursThisMonth = data.entries.filter(e => { const d = new Date(e.entry_date); return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear }).reduce((s, e) => s + (e.hours || 0), 0)
  const totalInvoiced = data.invoices.filter(i => i.invoice_kind === 'case').reduce((s, i) => s + (i.total_due || 0), 0)
  const unpaidInvoices = data.invoices.filter(i => i.invoice_kind === 'case' && i.status !== 'paid').reduce((s, i) => s + (i.total_due || 0), 0)
  const todayEvents = data.events.filter(e => e.event_date === today)
  const upcomingEvents = data.events.filter(e => e.event_date > today).slice(0, 4)

  // Status reports stats
  const pendingReports = data.reports.filter(r => r.status === 'pending')
  const approvedReports = data.reports.filter(r => r.status === 'approved') // approved but not sent yet
  const myPendingReports = data.reports.filter(r => r.attorney_id === staff?.id && r.status === 'pending')

  const activity = [
    ...data.entries.slice(0, 10).map(e => ({ type: 'timeentry', data: e, ts: e.created_at })),
    ...data.comments.slice(0, 10).map(c => ({ type: 'comment', data: c, ts: c.created_at })),
    ...data.reports.slice(0, 5).map(r => ({ type: 'report', data: r, ts: r.created_at })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8)

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = staff?.full_name?.split(' ')[0] || 'there'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'sans-serif', color: '#888780', fontSize: '13px' }}>
      Loading dashboard...
    </div>
  )

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Greeting */}
      <div>
        <div style={{ fontSize: '20px', fontWeight: '500', color: '#2c2c2a' }}>{greeting}, {firstName} 👋</div>
        <div style={{ fontSize: '13px', color: '#888780', marginTop: '3px' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {' · '}{isAdmin ? 'Admin view' : 'Attorney view'}
        </div>
      </div>

      {/* Stats grid */}
      {isAdmin ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '10px' }}>
          {[
            { label: 'Active cases', value: activeCases.length, sub: `${data.cases.filter(c=>c.status==='closed').length} closed`, action: () => setCurrentPage('cases') },
            { label: 'Pending approvals', value: pendingEntries.length + reviewEntries.length, sub: `${reviewEntries.length} need review`, action: () => setCurrentPage('timesheets') },
            { label: 'Status reports', value: pendingReports.length, sub: `${approvedReports.length} approved, pending send`, action: () => setCurrentPage('cases'), alert: pendingReports.length > 0 || approvedReports.length > 0 },
            { label: `Invoiced (${new Date().toLocaleString('en-US',{month:'short'})})`, value: `$${totalInvoiced.toFixed(0)}`, sub: `$${unpaidInvoices.toFixed(0)} outstanding`, action: () => setCurrentPage('invoices') },
            { label: "Today's events", value: todayEvents.length, sub: `${upcomingEvents.length} more upcoming`, action: () => setCurrentPage('calendar') },
          ].map(s => (
            <div key={s.label} onClick={s.action}
              style={{ background: s.alert ? '#faeeda' : '#e8e6df', borderRadius: '8px', padding: '1rem', cursor: 'pointer', border: s.alert ? '1.5px solid #FAC775' : '1.5px solid transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = s.alert ? '#f5e4c8' : '#dddbd4'}
              onMouseLeave={e => e.currentTarget.style.background = s.alert ? '#faeeda' : '#e8e6df'}
            >
              <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '500', color: s.alert ? '#633806' : '#2c2c2a', marginBottom: '3px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#888780' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px' }}>
          {[
            { label: 'My active cases', value: myCases.filter(c=>c.status==='active').length, sub: 'Assigned or collaborating', action: () => setCurrentPage('cases') },
            { label: `My hours (${new Date().toLocaleString('en-US',{month:'short'})})`, value: myHoursThisMonth.toFixed(1), sub: 'This month', action: () => setCurrentPage('timesheets') },
            { label: 'Pending timesheets', value: pendingEntries.length, sub: `${reviewEntries.length} need review`, action: () => setCurrentPage('timesheets') },
            { label: "Today's events", value: todayEvents.length, sub: `${upcomingEvents.length} more upcoming`, action: () => setCurrentPage('calendar') },
          ].map(s => (
            <div key={s.label} onClick={s.action}
              style={{ background: '#e8e6df', borderRadius: '8px', padding: '1rem', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#dddbd4'}
              onMouseLeave={e => e.currentTarget.style.background = '#e8e6df'}
            >
              <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '500', color: '#2c2c2a', marginBottom: '3px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#888780' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: '1rem' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Today's events */}
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>Today's events</div>
              <button onClick={() => setCurrentPage('calendar')} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View calendar ↗</button>
            </div>
            {todayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>No events today.</div>
            ) : todayEvents.map(ev => {
              const s = eventTypeStyle(ev.event_type)
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid #f1efe8' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                      {ev.event_time && formatTime(ev.event_time)}
                      {ev.cases?.sb_number && <span style={{ marginLeft: '6px', color: '#185FA5' }}>{ev.cases.sb_number}</span>}
                      {ev.staff?.initials && isAdmin && <span style={{ marginLeft: '6px' }}>· {ev.staff.initials}</span>}
                    </div>
                  </div>
                  <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', flexShrink: 0 }}>{ev.event_type}</span>
                </div>
              )
            })}
            {upcomingEvents.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.5rem' }}>Upcoming</div>
                {upcomingEvents.map(ev => {
                  const s = eventTypeStyle(ev.event_type)
                  return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '0.5px solid #f1efe8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        {ev.cases?.sb_number && <div style={{ fontSize: '10px', color: '#185FA5', marginTop: '1px' }}>{ev.cases.sb_number}</div>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#888780', flexShrink: 0 }}>{formatDate(ev.event_date)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status reports — admin: needs action / attorney: my submitted reports */}
          <div style={{ background: '#fff', border: `0.5px solid ${(isAdmin && (pendingReports.length > 0 || approvedReports.length > 0)) ? '#FAC775' : '#d3d1c7'}`, borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>
                  {isAdmin ? 'Status reports — action needed' : 'My status reports'}
                </div>
                {isAdmin && (pendingReports.length > 0 || approvedReports.length > 0) && (
                  <span style={{ background: '#faeeda', color: '#633806', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                    {pendingReports.length + approvedReports.length} need action
                  </span>
                )}
              </div>
              <button onClick={() => setCurrentPage('cases')} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View cases ↗</button>
            </div>

            {isAdmin ? (
              // Admin sees pending approval + approved but not sent
              [...pendingReports, ...approvedReports].length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>✓ All status reports are up to date.</div>
              ) : (
                [...pendingReports, ...approvedReports].slice(0, 5).map((report, idx, arr) => {
                  const ac = avatarColor(report.attorney?.initials)
                  const isPending = report.status === 'pending'
                  return (
                    <div key={report.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: idx < arr.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: ac.color, flexShrink: 0 }}>
                        {report.attorney?.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.cases?.sb_number} · {report.cases?.clients?.last_name}, {report.cases?.clients?.first_name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>
                          By {report.attorney?.full_name} · {formatRelative(report.created_at)}
                          {report.file_name && ` · ${report.file_name}`}
                        </div>
                      </div>
                      <span style={{
                        background: isPending ? '#faeeda' : '#E6F1FB',
                        color: isPending ? '#633806' : '#0C447C',
                        padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', flexShrink: 0
                      }}>
                        {isPending ? 'Needs approval' : 'Needs sending'}
                      </span>
                    </div>
                  )
                })
              )
            ) : (
              // Attorney sees their own submitted reports
              data.reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>No status reports submitted yet.</div>
              ) : (
                data.reports.slice(0, 4).map((report, idx, arr) => {
                  const statusColors = {
                    pending: { bg: '#faeeda', color: '#633806', label: 'Pending approval' },
                    approved: { bg: '#eaf3de', color: '#27500a', label: 'Approved' },
                    sent: { bg: '#E6F1FB', color: '#0C447C', label: 'Sent' },
                    rejected: { bg: '#fcebeb', color: '#791F1F', label: 'Rejected' },
                  }
                  const s = statusColors[report.status] || statusColors.pending
                  return (
                    <div key={report.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: idx < arr.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.cases?.sb_number} · {report.cases?.brief_description || '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>
                          {formatRelative(report.created_at)} {report.file_name && `· ${report.file_name}`}
                        </div>
                      </div>
                      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', flexShrink: 0 }}>
                        {s.label}
                      </span>
                    </div>
                  )
                })
              )
            )}
          </div>

          {/* Recent/my cases */}
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{isAdmin ? 'Recent cases' : 'My active cases'}</div>
              <button onClick={() => setCurrentPage('cases')} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all ↗</button>
            </div>
            {(isAdmin ? data.cases.slice(0, 5) : myCases.filter(c => c.status === 'active').slice(0, 5)).map((c, idx, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: idx < arr.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#185FA5' }}>{c.sb_number}</span>
                    {c.associations?.short_name && <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>{c.associations.short_name}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#5f5e5a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.clients?.last_name}, {c.clients?.first_name}
                  </div>
                </div>
                {statusBadge(c.status, true)}
              </div>
            ))}
            {(isAdmin ? data.cases : myCases.filter(c => c.status === 'active')).length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>No cases found.</div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Pending timesheets */}
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{isAdmin ? 'Pending approvals' : 'My timesheets'}</div>
              <button onClick={() => setCurrentPage('timesheets')} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all ↗</button>
            </div>
            {pendingEntries.length === 0 && reviewEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>{isAdmin ? 'No pending approvals.' : 'No pending timesheets.'}</div>
            ) : [...reviewEntries, ...pendingEntries].slice(0, 5).map((e, idx, arr) => {
              const ac = avatarColor(e.staff?.initials)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: idx < arr.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: ac.color, flexShrink: 0 }}>
                    {e.staff?.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.cases?.sb_number} · {e.hours?.toFixed(1)} hrs</div>
                    <div style={{ fontSize: '11px', color: '#888780', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                  </div>
                  <span style={{ background: e.status === 'review' ? '#EEEDFE' : '#faeeda', color: e.status === 'review' ? '#3C3489' : '#633806', padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', flexShrink: 0 }}>
                    {e.status === 'review' ? 'Review' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Activity feed */}
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', marginBottom: '1rem' }}>Recent activity</div>
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px' }}>No recent activity.</div>
            ) : activity.map((item, idx) => {
              const initials = item.data.staff?.initials || item.data.attorney?.initials
              const name = item.data.staff?.full_name || item.data.attorney?.full_name
              const ac = avatarColor(initials)
              return (
                <div key={idx} style={{ display: 'flex', gap: '8px', padding: '8px 0', borderBottom: idx < activity.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: ac.color, flexShrink: 0, marginTop: '2px' }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#2c2c2a', lineHeight: '1.4' }}>
                      <strong style={{ fontWeight: '500' }}>{name}</strong>
                      {item.type === 'timeentry' && <> logged <strong style={{ fontWeight: '500' }}>{item.data.hours?.toFixed(1)} hrs</strong> on <span style={{ color: '#185FA5' }}>{item.data.cases?.sb_number}</span></>}
                      {item.type === 'comment' && <> commented on <span style={{ color: '#185FA5' }}>{item.data.cases?.sb_number}</span></>}
                      {item.type === 'report' && <> submitted a status report for <span style={{ color: '#185FA5' }}>{item.data.cases?.sb_number}</span></>}
                    </div>
                    {item.type === 'timeentry' && item.data.description && <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.description}</div>}
                    {item.type === 'comment' && item.data.body && <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.data.body}</div>}
                    {item.type === 'report' && item.data.file_name && <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>{item.data.file_name}</div>}
                    <div style={{ fontSize: '10px', color: '#b4b2a9', marginTop: '3px' }}>{formatRelative(item.ts)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Admin only: invoices summary */}
          {isAdmin && (
            <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>Invoices — {new Date().toLocaleString('en-US', { month: 'long' })} {thisYear}</div>
                <button onClick={() => setCurrentPage('invoices')} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View all ↗</button>
              </div>
              {data.invoices.filter(i => i.invoice_kind === 'case').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#b4b2a9', fontSize: '13px' }}>No invoices generated yet this month.</div>
              ) : (
                [
                  { label: 'Total invoiced', value: `$${totalInvoiced.toFixed(2)}`, color: '#2c2c2a' },
                  { label: 'Outstanding', value: `$${unpaidInvoices.toFixed(2)}`, color: '#633806' },
                  { label: 'Paid', value: `$${(totalInvoiced - unpaidInvoices).toFixed(2)}`, color: '#27500a' },
                  { label: 'Draft invoices', value: data.invoices.filter(i => i.status === 'draft' && i.invoice_kind === 'case').length, color: '#5f5e5a' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px' }}>
                    <span style={{ color: '#888780' }}>{row.label}</span>
                    <span style={{ fontWeight: '500', color: row.color }}>{row.value}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}