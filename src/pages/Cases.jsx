import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Cases({ staff }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedCase, setSelectedCase] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchCases() }, [])

  async function fetchCases() {
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        clients (id, first_name, last_name, email, phone),
        associations (id, short_name, name),
        case_attorneys (attorney_id, is_lead,
          staff (full_name, initials)
        )
      `)
      .order('created_at', { ascending: false })

    if (!error) setCases(data || [])
    setLoading(false)
  }

  async function deleteCase(id) {
    setDeleting(true)
    const { error } = await supabase.from('cases').delete().eq('id', id)
    if (!error) {
      setCases(cases.filter(c => c.id !== id))
      setShowDeleteConfirm(null)
      setSelectedCase(null)
    }
    setDeleting(false)
  }

  const filtered = cases.filter(c => {
    const clientName = `${c.clients?.first_name} ${c.clients?.last_name}`.toLowerCase()
    const q = search.toLowerCase()
    const matchQ = !q || c.sb_number?.toLowerCase().includes(q) || clientName.includes(q) || c.brief_description?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchCat = categoryFilter === 'all' || c.case_category === categoryFilter
    return matchQ && matchStatus && matchCat
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

  // Case detail panel
  if (selectedCase) {
    const c = selectedCase
    return (
      <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>

        {/* Back button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={() => setSelectedCase(null)}
            style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ← Back to cases
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowDeleteConfirm(c)}
              style={{ padding: '6px 14px', background: '#fff', color: '#a32d2d', border: '0.5px solid #f09595', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              Delete case
            </button>
            <button
              style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
              onClick={() => alert('Edit form coming soon!')}
            >
              Edit case
            </button>
          </div>
        </div>

        {/* Case header */}
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a', marginBottom: '4px' }}>
            {c.clients?.last_name}, {c.clients?.first_name}
            <span style={{ marginLeft: '8px', background: c.status === 'active' ? '#eaf3de' : '#f1efe8', color: c.status === 'active' ? '#27500a' : '#5f5e5a', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', verticalAlign: 'middle' }}>
              {c.status}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '12px' }}>
            {c.brief_description || '—'} ·{' '}
            {c.case_category === 'association'
              ? <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.associations?.short_name}</span>
              : <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.case_type || 'Private'}</span>
            }
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'SB file no.', value: c.sb_number },
              { label: 'Assoc. case no.', value: c.association_case_number || '—' },
              { label: 'Opened', value: c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
              { label: 'Billing', value: c.billing_type === 'hourly' ? `Hourly${c.private_hourly_rate ? ' · $' + c.private_hourly_rate + '/hr' : ''}` : `Flat fee${c.flat_fee_amount ? ' · $' + c.flat_fee_amount : ''}` },
            ].map(item => (
              <div key={item.label} style={{ fontSize: '12px' }}>
                <span style={{ color: '#888780' }}>{item.label} </span>
                <span style={{ color: '#2c2c2a', fontWeight: '500' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Two column detail */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '1rem' }}>
          <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Case details</div>
            {[
              { label: 'Client', value: `${c.clients?.first_name} ${c.clients?.last_name}` },
              { label: 'Email', value: c.clients?.email || '—' },
              { label: 'Phone', value: c.clients?.phone || '—' },
              { label: 'Association', value: c.associations?.name || (c.case_type || 'Private') },
              { label: 'Assoc. case no.', value: c.association_case_number || '—' },
              { label: 'Status', value: c.status },
              { label: 'Opened', value: c.opened_at || '—' },
              { label: 'Closed', value: c.closed_at || '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px' }}>
                <span style={{ color: '#888780' }}>{row.label}</span>
                <span style={{ color: '#2c2c2a', fontWeight: '500', textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
            {c.full_description && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '6px' }}>Description</div>
                <p style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6' }}>{c.full_description}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Attorneys assigned</div>
              {c.case_attorneys?.length > 0 ? c.case_attorneys.map(a => (
                <div key={a.attorney_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                    {a.staff?.initials}
                  </div>
                  <span style={{ fontSize: '13px', color: '#2c2c2a' }}>{a.staff?.full_name}</span>
                  {a.is_lead && <span style={{ fontSize: '11px', color: '#888780' }}>· Lead</span>}
                </div>
              )) : (
                <p style={{ fontSize: '13px', color: '#888780' }}>No attorneys assigned yet.</p>
              )}
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Billing</div>
              {[
                { label: 'Type', value: c.billing_type },
                { label: c.billing_type === 'hourly' ? 'Rate' : 'Flat fee', value: c.billing_type === 'hourly' ? (c.private_hourly_rate ? `$${c.private_hourly_rate}/hr` : 'From rate table') : (c.flat_fee_amount ? `$${c.flat_fee_amount}` : '—') },
                { label: 'Deposit', value: c.deposit_amount ? `$${c.deposit_amount}` : '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px' }}>
                  <span style={{ color: '#888780' }}>{row.label}</span>
                  <span style={{ color: '#2c2c2a', fontWeight: '500' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '360px', border: '0.5px solid #d3d1c7' }}>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Delete this case?</div>
              <p style={{ fontSize: '13px', color: '#5f5e5a', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                This will permanently delete <strong>{showDeleteConfirm.sb_number}</strong> — {showDeleteConfirm.clients?.last_name}, {showDeleteConfirm.clients?.first_name}. This cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: '7px 16px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => deleteCase(showDeleteConfirm.id)} disabled={deleting} style={{ padding: '7px 16px', border: 'none', borderRadius: '8px', background: '#a32d2d', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Cases list
  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Cases</div>
        <button style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New case
        </button>
      </div>

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

      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1efe8', border: '0.5px solid #d3d1c7', borderRadius: '8px', padding: '5px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases, clients..." style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '180px', color: '#2c2c2a' }} />
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading cases...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>No cases found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['SB file no.', 'Client', 'Association', 'Description', 'Atty', 'Opened', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px', color: '#185FA5', fontWeight: '500', cursor: 'pointer' }} onClick={() => setSelectedCase(c)}>{c.sb_number}</td>
                  <td style={{ padding: '10px', cursor: 'pointer' }} onClick={() => setSelectedCase(c)}>{c.clients?.last_name}, {c.clients?.first_name}</td>
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
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => setShowDeleteConfirm(c)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '360px', border: '0.5px solid #d3d1c7' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Delete this case?</div>
            <p style={{ fontSize: '13px', color: '#5f5e5a', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              This will permanently delete <strong>{showDeleteConfirm.sb_number}</strong> — {showDeleteConfirm.clients?.last_name}, {showDeleteConfirm.clients?.first_name}. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ padding: '7px 16px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteCase(showDeleteConfirm.id)} disabled={deleting} style={{ padding: '7px 16px', border: 'none', borderRadius: '8px', background: '#a32d2d', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}