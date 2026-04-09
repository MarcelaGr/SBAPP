import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Cases({ staff }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    fetchCases()
  }, [])

  async function fetchCases() {
    let query = supabase
      .from('cases')
      .select(`
        *,
        clients (first_name, last_name),
        associations (short_name),
        case_attorneys (attorney_id, is_lead,
          staff (full_name, initials)
        )
      `)
      .order('created_at', { ascending: false })

    if (staff?.role === 'attorney') {
      query = query.eq('case_attorneys.attorney_id', staff.id)
    }

    const { data, error } = await query
    if (!error) setCases(data || [])
    setLoading(false)
  }

  const filtered = cases.filter(c => {
    const clientName = `${c.clients?.first_name} ${c.clients?.last_name}`.toLowerCase()
    const q = search.toLowerCase()
    const matchQ = !q || c.sb_number?.toLowerCase().includes(q) || clientName.includes(q) || c.brief_description?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchCategory = categoryFilter === 'all' || c.case_category === categoryFilter
    return matchQ && matchStatus && matchCategory
  })

  const statusBadge = (status) => {
    const styles = {
      active: { background: '#eaf3de', color: '#27500a' },
      pending: { background: '#faeeda', color: '#633806' },
      closed: { background: '#f1efe8', color: '#5f5e5a' }
    }
    return (
      <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const categoryBadge = (category, caseType) => {
    const isPrivate = category === 'private'
    return (
      <span style={{
        background: isPrivate ? '#EEEDFE' : '#E6F1FB',
        color: isPrivate ? '#3C3489' : '#0C447C',
        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500'
      }}>
        {isPrivate ? (caseType || 'Private') : 'Assoc.'}
      </span>
    )
  }

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Cases</div>
        <button
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          + New case
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px', marginBottom: '1rem' }}>
        {[
          { label: 'Total cases', value: cases.length },
          { label: 'Active', value: cases.filter(c => c.status === 'active').length },
          { label: 'Pending', value: cases.filter(c => c.status === 'pending').length },
          { label: 'Closed', value: cases.filter(c => c.status === 'closed').length },
        ].map(s => (
          <div key={s.label} style={{ background: '#e8e6df', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '500', color: '#2c2c2a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1efe8', border: '0.5px solid #d3d1c7', borderRadius: '8px', padding: '5px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cases, clients..."
              style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '180px', color: '#2c2c2a' }}
            />
          </div>
          {['all', 'active', 'pending', 'closed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: statusFilter === s ? '#0C447C' : '#d3d1c7', background: statusFilter === s ? '#0C447C' : '#fff', color: statusFilter === s ? '#fff' : '#5f5e5a' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {['all', 'association', 'private'].map(s => (
            <button key={s} onClick={() => setCategoryFilter(s)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: categoryFilter === s ? '#185FA5' : '#d3d1c7', background: categoryFilter === s ? '#185FA5' : '#fff', color: categoryFilter === s ? '#fff' : '#5f5e5a' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading cases...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>No cases found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['SB file no.', 'Client', 'Association', 'Description', 'Atty', 'Opened', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px', color: '#185FA5', fontWeight: '500' }}>{c.sb_number}</td>
                  <td style={{ padding: '10px' }}>{c.clients?.last_name}, {c.clients?.first_name}</td>
                  <td style={{ padding: '10px' }}>
                    {c.case_category === 'association'
                      ? <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.associations?.short_name}</span>
                      : <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.case_type || 'Private'}</span>
                    }
                  </td>
                  <td style={{ padding: '10px', color: '#5f5e5a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.brief_description || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    {c.case_attorneys?.filter(a => a.is_lead).map(a => (
                      <span key={a.attorney_id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: '#E6F1FB', color: '#0C447C', fontSize: '10px', fontWeight: '500', border: '1px solid #B5D4F4' }}>
                        {a.staff?.initials}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '10px', color: '#888780', whiteSpace: 'nowrap' }}>{c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '10px' }}>{statusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}