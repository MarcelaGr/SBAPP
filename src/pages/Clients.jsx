import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// ─── NEW / EDIT CLIENT FORM ───────────────────────────────────
function ClientForm({ client, onClose, onSaved }) {
  const isEdit = !!client
  const [associations, setAssociations] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: client?.first_name || '',
    last_name: client?.last_name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    client_type: client?.client_type || '',
    association_id: client?.association_id || '',
    member_id: client?.member_id || '',
    address_street: client?.address_street || '',
    address_city_state_zip: client?.address_city_state_zip || '',
    notes: client?.notes || '',
  })

  useEffect(() => {
    supabase.from('associations').select('*').eq('active', true).order('short_name')
      .then(({ data }) => setAssociations(data || []))
  }, [])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    if (!form.last_name.trim()) { setError('Last name is required.'); return }
    if (!form.client_type) { setError('Please select a client type.'); return }
    if (form.client_type === 'association' && !form.association_id) { setError('Please select an association.'); return }

    setSaving(true)
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      client_type: form.client_type,
      association_id: form.client_type === 'association' ? form.association_id : null,
      member_id: form.member_id.trim() || null,
      address_street: form.address_street.trim() || null,
      address_city_state_zip: form.address_city_state_zip.trim() || null,
      notes: form.notes.trim() || null,
      active: true,
    }

    let data, dbError
    if (isEdit) {
      const res = await supabase.from('clients').update(payload).eq('id', client.id).select('*, associations(short_name, name)').single()
      data = res.data; dbError = res.error
    } else {
      const res = await supabase.from('clients').insert(payload).select('*, associations(short_name, name)').single()
      data = res.data; dbError = res.error
    }

    if (dbError) { setError('Error saving client: ' + dbError.message); setSaving(false); return }
    setSaving(false)
    onSaved(data)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
  const sectionLabel = { fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', margin: '18px 0 12px', paddingBottom: '6px', borderBottom: '0.5px solid #f1efe8' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '1.75rem', border: '0.5px solid #d3d1c7', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>{isEdit ? 'Edit client' : 'New client'}</div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{isEdit ? `Editing ${client.first_name} ${client.last_name}` : 'Add a new client to the database'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={sectionLabel}>Personal information</div>
          <div style={{ ...fieldStyle, ...gridStyle }}>
            <div>
              <label style={labelStyle}>First name <span style={{ color: '#a32d2d' }}>*</span></label>
              <input type="text" value={form.first_name} onChange={e => setField('first_name', e.target.value)} placeholder="First name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last name <span style={{ color: '#a32d2d' }}>*</span></label>
              <input type="text" value={form.last_name} onChange={e => setField('last_name', e.target.value)} placeholder="Last name" style={inputStyle} />
            </div>
          </div>
          <div style={{ ...fieldStyle, ...gridStyle }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="client@email.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(xxx) xxx-xxxx" style={inputStyle} />
            </div>
          </div>

          <div style={sectionLabel}>Client type</div>
          <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['association', 'private'].map(t => (
              <div key={t} onClick={() => setField('client_type', t)}
                style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: form.client_type === t ? '2px solid #0C447C' : '0.5px solid #d3d1c7', background: form.client_type === t ? '#E6F1FB' : '#fff', color: form.client_type === t ? '#0C447C' : '#5f5e5a', fontWeight: form.client_type === t ? '500' : '400', fontSize: '13px' }}>
                {t === 'association' ? '🏛 Association member' : '👤 Private client'}
              </div>
            ))}
          </div>

          {form.client_type === 'association' && (
            <div style={{ ...gridStyle, marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Association <span style={{ color: '#a32d2d' }}>*</span></label>
                <select value={form.association_id} onChange={e => setField('association_id', e.target.value)} style={inputStyle}>
                  <option value="">Select association...</option>
                  {associations.map(a => <option key={a.id} value={a.id}>{a.short_name} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Member ID</label>
                <input type="text" value={form.member_id} onChange={e => setField('member_id', e.target.value)} placeholder="Association member no." style={inputStyle} />
              </div>
            </div>
          )}

          <div style={sectionLabel}>Address</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Street address</label>
            <input type="text" value={form.address_street} onChange={e => setField('address_street', e.target.value)} placeholder="123 Main St" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>City, state, ZIP</label>
            <input type="text" value={form.address_city_state_zip} onChange={e => setField('address_city_state_zip', e.target.value)} placeholder="Los Angeles, CA 90001" style={inputStyle} />
          </div>

          <div style={sectionLabel}>Notes</div>
          <div style={fieldStyle}>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any relevant notes about this client..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} />
          </div>

          {error && (
            <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Save client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CLIENT DETAIL ────────────────────────────────────────────
function ClientDetail({ client: initialClient, onBack, onDeleted, staff }) {
  const [client, setClient] = useState(initialClient)
  const [cases, setCases] = useState([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchClientCases() }, [client.id])

  async function fetchClientCases() {
    setCasesLoading(true)
    const { data } = await supabase
      .from('cases')
      .select('*, associations(short_name), case_attorneys(is_lead, staff(full_name, initials))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setCases(data || [])
    setCasesLoading(false)
  }

  async function deleteClient() {
    setDeleting(true)
    await supabase.from('clients').update({ active: false }).eq('id', client.id)
    setDeleting(false)
    onDeleted(client.id)
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const statusBadge = (status) => {
    const styles = { active: { background: '#eaf3de', color: '#27500a' }, pending: { background: '#faeeda', color: '#633806' }, closed: { background: '#f1efe8', color: '#5f5e5a' } }
    return <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
  }

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
          ← Back to clients
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {staff?.role === 'admin' && (
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: '6px 14px', background: '#fff', color: '#a32d2d', border: '0.5px solid #f09595', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Delete client
            </button>
          )}
          <button onClick={() => setShowEditForm(true)}
            style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
            Edit client
          </button>
        </div>
      </div>

      {/* Client header */}
      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '500', color: '#0C447C', border: '2px solid #B5D4F4', flexShrink: 0 }}>
          {client.first_name[0]}{client.last_name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a' }}>{client.first_name} {client.last_name}</div>
          <div style={{ fontSize: '13px', color: '#888780', marginTop: '2px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {client.email && <span>{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {client.associations?.short_name && (
            <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              {client.associations.short_name}
            </span>
          )}
          <span style={{ background: client.client_type === 'association' ? '#E6F1FB' : '#EEEDFE', color: client.client_type === 'association' ? '#0C447C' : '#3C3489', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
            {client.client_type === 'association' ? 'Association member' : 'Private client'}
          </span>
        </div>
      </div>

      {/* Two col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '1rem', alignItems: 'start' }}>

        {/* Client info */}
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Client information</div>
          {[
            { label: 'Full name', value: `${client.first_name} ${client.last_name}` },
            { label: 'Email', value: client.email || '—' },
            { label: 'Phone', value: client.phone || '—' },
            { label: 'Type', value: client.client_type === 'association' ? 'Association member' : 'Private client' },
            { label: 'Association', value: client.associations?.name || '—' },
            { label: 'Member ID', value: client.member_id || '—' },
            { label: 'Address', value: client.address_street || '—' },
            { label: 'City / ZIP', value: client.address_city_state_zip || '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px', gap: '8px' }}>
              <span style={{ color: '#888780', flexShrink: 0 }}>{row.label}</span>
              <span style={{ color: '#2c2c2a', fontWeight: '500', textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</span>
            </div>
          ))}
          {client.notes && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '11px', color: '#888780', marginBottom: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
              <p style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6', margin: 0 }}>{client.notes}</p>
            </div>
          )}
        </div>

        {/* Related cases */}
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780' }}>Related cases</div>
            <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
              {cases.length} case{cases.length !== 1 ? 's' : ''}
            </span>
          </div>

          {casesLoading ? (
            <div style={{ fontSize: '13px', color: '#888780', textAlign: 'center', padding: '1.5rem' }}>Loading cases...</div>
          ) : cases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#b4b2a9', fontSize: '13px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
              No cases linked to this client yet.
            </div>
          ) : (
            <div>
              {cases.map((c, idx) => (
                <div key={c.id} style={{ padding: '12px 0', borderBottom: idx < cases.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#185FA5' }}>{c.sb_number}</span>
                        {c.associations?.short_name && (
                          <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>{c.associations.short_name}</span>
                        )}
                        {c.case_type && (
                          <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>{c.case_type}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#2c2c2a', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.brief_description || '—'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#888780' }}>Opened {formatDate(c.opened_at)}</span>
                        <span style={{ fontSize: '11px', color: '#888780' }}>· {c.billing_type === 'hourly' ? 'Hourly' : 'Flat fee'}</span>
                        {c.case_attorneys?.filter(a => a.is_lead).map((a, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                              {a.staff?.initials}
                            </div>
                            <span style={{ fontSize: '11px', color: '#888780' }}>{a.staff?.full_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>{statusBadge(c.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditForm && (
        <ClientForm
          client={client}
          onClose={() => setShowEditForm(false)}
          onSaved={(updated) => { setClient(updated); setShowEditForm(false) }}
        />
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '360px', border: '0.5px solid #d3d1c7' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Delete this client?</div>
            <p style={{ fontSize: '13px', color: '#5f5e5a', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              This will deactivate <strong>{client.first_name} {client.last_name}</strong>. Their cases will remain in the system.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '7px 16px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={deleteClient} disabled={deleting} style={{ padding: '7px 16px', border: 'none', borderRadius: '8px', background: '#a32d2d', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CLIENTS LIST ─────────────────────────────────────────────
export default function Clients({ staff }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showNewClient, setShowNewClient] = useState(false)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*, associations(short_name, name)')
      .eq('active', true)
      .order('last_name')
    setClients(data || [])
    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.member_id?.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || c.client_type === typeFilter
    return matchQ && matchType
  })

  if (selectedClient) {
    return (
      <ClientDetail
        client={selectedClient}
        staff={staff}
        onBack={() => setSelectedClient(null)}
        onDeleted={(id) => { setClients(clients.filter(c => c.id !== id)); setSelectedClient(null) }}
      />
    )
  }

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Clients</div>
        <button onClick={() => setShowNewClient(true)}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New client
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px', marginBottom: '1rem' }}>
        {[
          { label: 'Total clients', value: clients.length },
          { label: 'Association members', value: clients.filter(c => c.client_type === 'association').length },
          { label: 'Private clients', value: clients.filter(c => c.client_type === 'private').length },
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients, email, member ID..."
              style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '200px', color: '#2c2c2a' }} />
          </div>
          {['all', 'association', 'private'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: typeFilter === t ? '#0C447C' : '#d3d1c7', background: typeFilter === t ? '#0C447C' : '#fff', color: typeFilter === t ? '#fff' : '#5f5e5a' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <span style={{ fontSize: '12px', color: '#888780', marginLeft: 'auto' }}>{filtered.length} clients</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>No clients found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Phone', 'Type', 'Association', 'Member ID', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelectedClient(c)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4', flexShrink: 0 }}>
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <span style={{ fontWeight: '500', color: '#2c2c2a' }}>{c.last_name}, {c.first_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', color: '#5f5e5a' }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px', color: '#5f5e5a', whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ background: c.client_type === 'association' ? '#E6F1FB' : '#EEEDFE', color: c.client_type === 'association' ? '#0C447C' : '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                      {c.client_type === 'association' ? 'Association' : 'Private'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {c.associations?.short_name
                      ? <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.associations.short_name}</span>
                      : <span style={{ color: '#b4b2a9' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '10px', color: '#5f5e5a', fontFamily: 'monospace', fontSize: '12px' }}>{c.member_id || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#b4b2a9" strokeWidth="1.5"><path d="M6 3l5 5-5 5"/></svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewClient && (
        <ClientForm
          onClose={() => setShowNewClient(false)}
          onSaved={(newClient) => {
            setClients(prev => [newClient, ...prev].sort((a, b) => a.last_name.localeCompare(b.last_name)))
            setShowNewClient(false)
            setSelectedClient(newClient)
          }}
        />
      )}
    </div>
  )
}