import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EVENT_TYPES = [
  { value: 'hearing', label: 'Hearing / court date', color: '#378ADD', bg: '#E6F1FB', text: '#0C447C' },
  { value: 'meeting', label: 'Client meeting', color: '#1D9E75', bg: '#E1F5EE', text: '#085041' },
  { value: 'deadline', label: 'Deadline / filing', color: '#E24B4A', bg: '#FCEBEB', text: '#791F1F' },
  { value: 'reminder', label: 'Follow-up reminder', color: '#EF9F27', bg: '#FAEEDA', text: '#633806' },
]

function getEventStyle(type) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0]
}

function NewEventForm({ staff, attorneys, selectedDate, onClose, onSaved }) {
  const [caseSearch, setCaseSearch] = useState('')
  const [caseResults, setCaseResults] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    event_type: 'hearing',
    attorney_id: staff?.role === 'attorney' ? staff.id : '',
    event_date: selectedDate || new Date().toISOString().split('T')[0],
    event_time: '09:00',
    location_notes: '',
    notify_day_before: true,
    notify_hour_before: true,
  })

  async function searchCases(q) {
    const { data } = await supabase
      .from('cases')
      .select('id, sb_number, brief_description, clients(first_name, last_name), associations(short_name)')
      .or(`sb_number.ilike.%${q}%,brief_description.ilike.%${q}%`)
      .limit(6)
    setCaseResults(data || [])
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (caseSearch.length < 2) {
        setCaseResults([])
        return
      }
      searchCases(caseSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [caseSearch])

  function setField(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Please add a title.'); return }
    if (!form.attorney_id) { setError('Please select an attorney.'); return }
    if (!form.event_date) { setError('Please select a date.'); return }
    setSaving(true)
    const { data, error: dbError } = await supabase.from('calendar_events').insert({
      title: form.title.trim(),
      event_type: form.event_type,
      case_id: selectedCase?.id || null,
      attorney_id: form.attorney_id,
      created_by: staff.id,
      event_date: form.event_date,
      event_time: form.event_time || null,
      location_notes: form.location_notes.trim() || null,
      notify_day_before: form.notify_day_before,
      notify_hour_before: form.notify_hour_before,
    }).select('*, staff:attorney_id(id, full_name, initials), cases(sb_number, brief_description)').single()
    if (dbError) { setError('Error: ' + dbError.message); setSaving(false); return }
    setSaving(false)
    onSaved(data)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '1.75rem', border: '0.5px solid #d3d1c7', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>New calendar event</div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>Notifications: 1 day + 1 hour before</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Event type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {EVENT_TYPES.map(t => (
                <div key={t.value} onClick={() => setField('event_type', t.value)}
                  style={{ padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: form.event_type === t.value ? '500' : '400', border: form.event_type === t.value ? `2px solid ${t.color}` : '0.5px solid #d3d1c7', background: form.event_type === t.value ? t.bg : '#fff', color: form.event_type === t.value ? t.text : '#5f5e5a' }}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Title <span style={{ color: '#a32d2d' }}>*</span></label>
            <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Hearing — Walker v. LASD" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Linked case (optional)</label>
            {selectedCase ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#E6F1FB', borderRadius: '8px', fontSize: '13px' }}>
                <span style={{ color: '#0C447C', fontWeight: '500' }}>{selectedCase.sb_number} · {selectedCase.clients?.last_name}, {selectedCase.clients?.first_name}</span>
                <button type="button" onClick={() => { setSelectedCase(null); setCaseSearch('') }} style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input type="text" value={caseSearch} onChange={e => setCaseSearch(e.target.value)} placeholder="Search by SB no. or description..." style={inputStyle} />
                {caseResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '8px', zIndex: 10, marginTop: '4px', overflow: 'hidden' }}>
                    {caseResults.map(c => (
                      <div key={c.id} onClick={() => { setSelectedCase(c); setCaseSearch(''); setCaseResults([]) }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '0.5px solid #f1efe8' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <span style={{ fontWeight: '500', color: '#185FA5' }}>{c.sb_number}</span>
                        <span style={{ color: '#888780', marginLeft: '8px' }}>{c.clients?.last_name}, {c.clients?.first_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {staff?.role === 'admin' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Attorney <span style={{ color: '#a32d2d' }}>*</span></label>
              <select value={form.attorney_id} onChange={e => setField('attorney_id', e.target.value)} style={inputStyle}>
                <option value="">Select attorney...</option>
                {attorneys.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.initials})</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Date <span style={{ color: '#a32d2d' }}>*</span></label>
              <input type="date" value={form.event_date} onChange={e => setField('event_date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input type="time" value={form.event_time} onChange={e => setField('event_time', e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Location / notes</label>
            <textarea value={form.location_notes} onChange={e => setField('location_notes', e.target.value)} placeholder="Courtroom, address, or any notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ background: '#f1efe8', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', color: '#888780', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Push notifications</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[{ key: 'notify_day_before', label: '1 day before' }, { key: 'notify_hour_before', label: '1 hour before' }].map(n => (
                <label key={n.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#2c2c2a' }}>
                  <input type="checkbox" checked={form[n.key]} onChange={e => setField(n.key, e.target.checked)} style={{ accentColor: '#0C447C', width: '14px', height: '14px' }} />
                  {n.label}
                </label>
              ))}
            </div>
          </div>
          {error && <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EventDetail({ event, onClose, onDeleted, staff }) {
  const [deleting, setDeleting] = useState(false)
  const style = getEventStyle(event.event_type)

  async function deleteEvent() {
    setDeleting(true)
    await supabase.from('calendar_events').delete().eq('id', event.id)
    setDeleting(false)
    onDeleted(event.id)
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', overflow: 'hidden', border: '0.5px solid #d3d1c7' }}>
        <div style={{ background: style.bg, padding: '1.25rem', borderBottom: `2px solid ${style.color}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '500', color: style.text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {EVENT_TYPES.find(t => t.value === event.event_type)?.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>{event.title}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#888780', cursor: 'pointer', flexShrink: 0 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {[
            { label: 'Date', value: new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
            { label: 'Time', value: event.event_time ? formatTime(event.event_time) : '—' },
            { label: 'Attorney', value: event.staff?.full_name || '—' },
            { label: 'Linked case', value: event.cases ? `${event.cases.sb_number}` : '—' },
            { label: 'Location / notes', value: event.location_notes || '—' },
            { label: 'Notifications', value: [event.notify_day_before && '1 day before', event.notify_hour_before && '1 hour before'].filter(Boolean).join(' · ') || 'None' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px', gap: '8px' }}>
              <span style={{ color: '#888780', flexShrink: 0 }}>{row.label}</span>
              <span style={{ color: '#2c2c2a', fontWeight: '500', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid #f1efe8' }}>
          {(staff?.role === 'admin' || event.attorney_id === staff?.id) ? (
            <button onClick={deleteEvent} disabled={deleting} style={{ padding: '7px 14px', border: '0.5px solid #f09595', borderRadius: '8px', background: '#fff', color: '#a32d2d', fontSize: '12px', cursor: 'pointer' }}>
              {deleting ? 'Deleting...' : 'Delete event'}
            </button>
          ) : <div />}
          <button onClick={onClose} style={{ padding: '7px 18px', border: 'none', borderRadius: '8px', background: '#0C447C', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Calendar({ staff }) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [attorneys, setAttorneys] = useState([])
  const [selectedAttorneys, setSelectedAttorneys] = useState([])
  const [selectedTypes, setSelectedTypes] = useState(EVENT_TYPES.map(t => t.value))
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEventDate, setNewEventDate] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadAttorneys() {
      const { data } = await supabase.from('staff').select('*').eq('active', true).order('full_name')
      if (cancelled) return
      setAttorneys(data || [])
      setSelectedAttorneys((data || []).map(a => a.id))
    }

    loadAttorneys()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      setLoading(true)
      const firstDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate()
      const lastDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`
      let query = supabase.from('calendar_events')
        .select('*, staff:attorney_id(id, full_name, initials), cases(sb_number, brief_description)')
        .gte('event_date', firstDay).lte('event_date', lastDay).order('event_time')
      if (staff?.role === 'attorney') query = query.eq('attorney_id', staff.id)
      const { data } = await query
      if (cancelled) return
      setEvents(data || [])
      setLoading(false)
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [currentYear, currentMonth, staff?.id, staff?.role])

  function changeMonth(dir) {
    let m = currentMonth + dir, y = currentYear
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setCurrentMonth(m); setCurrentYear(y)
  }

  function toggleAttorney(id) { setSelectedAttorneys(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function toggleType(type) { setSelectedTypes(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]) }

  const filteredEvents = events.filter(e => selectedAttorneys.includes(e.attorney_id) && selectedTypes.includes(e.event_type))

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate()
  const cells = []
  for (let i = firstDayOfMonth - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, current: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true })
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDayOfMonth - daysInMonth + 1, current: false })

  function getEventsForDay(cell) {
    if (!cell.current) return []
    const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
    return filteredEvents.filter(e => e.event_date === key)
  }

  function isToday(cell) {
    return cell.current && cell.day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  }

  const upcoming = filteredEvents.filter(e => e.event_date >= today.toISOString().split('T')[0]).slice(0, 5)
  const formatTime = (t) => { if (!t) return ''; const [h, m] = t.split(':'); const hour = parseInt(h); return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}` }
  const attyColors = ['#185FA5', '#1D9E75', '#854F0B', '#993556', '#534AB7', '#993C1D']

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Calendar</div>
        <button onClick={() => { setNewEventDate(null); setShowNewEvent(true) }}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New event
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1rem', alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '0.5px solid #d3d1c7', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => changeMonth(-1)} style={{ width: '28px', height: '28px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '16px', color: '#5f5e5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', minWidth: '150px', textAlign: 'center' }}>{MONTHS[currentMonth]} {currentYear}</div>
              <button onClick={() => changeMonth(1)} style={{ width: '28px', height: '28px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '16px', color: '#5f5e5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              <button onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }} style={{ padding: '4px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}>Today</button>
            </div>
            {loading && <span style={{ fontSize: '12px', color: '#888780' }}>Loading...</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '0.5px solid #d3d1c7' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '500', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {cells.map((cell, idx) => {
              const dayEvents = getEventsForDay(cell)
              const tod = isToday(cell)
              return (
                <div key={idx}
                  onClick={() => { if (cell.current) { const d = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`; setNewEventDate(d); setShowNewEvent(true) } }}
                  style={{ minHeight: '88px', borderRight: (idx+1)%7===0?'none':'0.5px solid #d3d1c7', borderBottom: '0.5px solid #d3d1c7', padding: '5px 4px', cursor: cell.current?'pointer':'default', background: cell.current?'#fff':'#faf9f7' }}
                  onMouseEnter={e => { if(cell.current) e.currentTarget.style.background='#f5f4f0' }}
                  onMouseLeave={e => { e.currentTarget.style.background=cell.current?'#fff':'#faf9f7' }}
                >
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3px', background: tod?'#0C447C':'transparent' }}>
                    <span style={{ fontSize: '12px', fontWeight: tod?'500':'400', color: tod?'#fff':cell.current?'#2c2c2a':'#b4b2a9' }}>{cell.day}</span>
                  </div>
                  {dayEvents.slice(0, 2).map(ev => {
                    const s = getEventStyle(ev.event_type)
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                        style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '3px', marginBottom: '2px', background: s.bg, color: s.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        {ev.event_time ? formatTime(ev.event_time).replace(':00','').replace(' ','') + ' ' : ''}{ev.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 2 && <div style={{ fontSize: '10px', color: '#888780', paddingLeft: '3px' }}>+{dayEvents.length-2} more</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {staff?.role === 'admin' && (
            <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.625rem' }}>Attorneys</div>
              {attorneys.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }} onClick={() => toggleAttorney(a.id)}>
                  <input type="checkbox" checked={selectedAttorneys.includes(a.id)} readOnly style={{ accentColor: attyColors[i%attyColors.length], width: '13px', height: '13px', cursor: 'pointer' }} />
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: attyColors[i%attyColors.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#2c2c2a', flex: 1 }}>{a.full_name}</span>
                  <span style={{ fontSize: '11px', color: '#888780' }}>{events.filter(e => e.attorney_id === a.id).length}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.625rem' }}>Event types</div>
            {EVENT_TYPES.map(t => (
              <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }} onClick={() => toggleType(t.value)}>
                <input type="checkbox" checked={selectedTypes.includes(t.value)} readOnly style={{ accentColor: t.color, width: '13px', height: '13px', cursor: 'pointer' }} />
                <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: t.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#5f5e5a' }}>{t.label}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.625rem' }}>Upcoming</div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#b4b2a9', fontStyle: 'italic' }}>No upcoming events.</div>
            ) : upcoming.map(ev => {
              const s = getEventStyle(ev.event_type)
              return (
                <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                  style={{ padding: '8px 0', borderBottom: '0.5px solid #f1efe8', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='#faf9f7'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <div style={{ fontSize: '11px', color: '#888780', marginBottom: '2px' }}>
                    {new Date(ev.event_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    {ev.event_time && ` · ${formatTime(ev.event_time)}`}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c2c2a', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: s.bg, color: s.text, padding: '1px 6px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>
                      {EVENT_TYPES.find(t => t.value === ev.event_type)?.label.split('/')[0].trim()}
                    </span>
                    {ev.cases?.sb_number && <span style={{ fontSize: '10px', color: '#185FA5' }}>{ev.cases.sb_number}</span>}
                    {ev.staff?.initials && (
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                        {ev.staff.initials}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showNewEvent && (
        <NewEventForm staff={staff} attorneys={attorneys} selectedDate={newEventDate}
          onClose={() => setShowNewEvent(false)}
          onSaved={(newEv) => { setEvents(prev => [...prev, newEv]); setShowNewEvent(false) }}
        />
      )}
      {selectedEvent && (
        <EventDetail event={selectedEvent} staff={staff}
          onClose={() => setSelectedEvent(null)}
          onDeleted={(id) => { setEvents(prev => prev.filter(e => e.id !== id)); setSelectedEvent(null) }}
        />
      )}
    </div>
  )
}
