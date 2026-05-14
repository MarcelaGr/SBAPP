import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getClientSearchValues, matchesSearch } from '../lib/search'
import { normalizeSbNumber } from '../lib/sb'
import { FormActions, FormModal, FormStatusMessage, PageNotice } from '../components/FormUi'

function formatClientName(client) {
  return [client?.title, client?.first_name, client?.last_name].filter(Boolean).join(' ').trim()
}

function ClientForm({ client, onClose, onSaved }) {
  const isEdit = !!client
  const [associations, setAssociations] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    sb_number: client?.sb_number || '',
    title: client?.title || '',
    serial_number: client?.serial_number || '',
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
      sb_number: normalizeSbNumber(form.sb_number) || null,
      title: form.title.trim() || null,
      serial_number: form.serial_number.trim() || null,
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

    const query = supabase.from('clients')
    const result = isEdit
      ? await query.update(payload).eq('id', client.id).select('*, associations(short_name, name)').single()
      : await query.insert(payload).select('*, associations(short_name, name)').single()

    if (result.error) {
      setError('Error saving client: ' + result.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved(result.data, isEdit)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
  const sectionLabel = { fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', margin: '18px 0 12px', paddingBottom: '6px', borderBottom: '0.5px solid #f1efe8' }

  return (
    <FormModal
      title={isEdit ? 'Edit client' : 'New client'}
      subtitle={isEdit ? `Editing ${formatClientName(client)}` : 'Add a new client to the database'}
      onClose={onClose}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit}>
        <div style={sectionLabel}>Personal information</div>
        <div style={{ ...fieldStyle, ...gridStyle }}>
          <div>
            <label style={labelStyle}>SB No.</label>
            <input type="text" value={form.sb_number} onChange={e => setField('sb_number', e.target.value)} placeholder="e.g. SB 26-0142" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Employee number</label>
            <input type="text" value={form.serial_number} onChange={e => setField('serial_number', e.target.value)} placeholder="e.g. 123456" style={inputStyle} />
          </div>
        </div>
        <div style={{ ...fieldStyle, ...gridStyle }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Sgt." style={inputStyle} />
          </div>
          <div />
        </div>
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
            <div
              key={t}
              onClick={() => setField('client_type', t)}
              style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: form.client_type === t ? '2px solid #0C447C' : '0.5px solid #d3d1c7', background: form.client_type === t ? '#E6F1FB' : '#fff', color: form.client_type === t ? '#0C447C' : '#5f5e5a', fontWeight: form.client_type === t ? '500' : '400', fontSize: '13px' }}
            >
              {t === 'association' ? 'Association member' : 'Private client'}
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
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any relevant notes about this client..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} />
        </div>

        <FormStatusMessage message={error} />
        <FormActions onCancel={onClose} saving={saving} saveLabel="Save client" />
      </form>
    </FormModal>
  )
}

function ClientDetail({ client: initialClient, onBack, onDeleted, onUpdated, onNotice, staff }) {
  const [client, setClient] = useState(initialClient)
  const [cases, setCases] = useState([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteClient() {
    setDeleting(true)
    const { error } = await supabase.from('clients').update({ active: false }).eq('id', client.id)
    setDeleting(false)
    if (error) {
      onNotice({ type: 'error', message: `Unable to delete client: ${error.message}` })
      return
    }
    onNotice({ type: 'success', message: `${formatClientName(client)} was deleted.` })
    onDeleted(client.id)
  }

  useEffect(() => {
    let cancelled = false

    async function loadClientCases() {
      setCasesLoading(true)

      const { data } = await supabase
        .from('cases')
        .select('*, associations(short_name), case_attorneys(is_lead, staff(full_name, initials))')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      setCases(data || [])
      setCasesLoading(false)
    }

    loadClientCases()

    return () => {
      cancelled = true
    }
  }, [client.id])

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
            <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '6px 14px', background: '#fff', color: '#a32d2d', border: '0.5px solid #f09595', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Delete client
            </button>
          )}
          <button onClick={() => setShowEditForm(true)} style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
            Edit client
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '500', color: '#0C447C', border: '2px solid #B5D4F4', flexShrink: 0 }}>
          {client.first_name?.[0]}{client.last_name?.[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a' }}>{formatClientName(client)}</div>
          <div style={{ fontSize: '13px', color: '#888780', marginTop: '2px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {client.serial_number && <span>Employee no. {client.serial_number}</span>}
            {client.email && <span>{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {client.associations?.short_name && <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>{client.associations.short_name}</span>}
          <span style={{ background: client.client_type === 'association' ? '#E6F1FB' : '#EEEDFE', color: client.client_type === 'association' ? '#0C447C' : '#3C3489', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
            {client.client_type === 'association' ? 'Association member' : 'Private client'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '1rem', alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Client information</div>
          {[
            { label: 'SB No.', value: client.sb_number || '—' },
            { label: 'Employee No.', value: client.serial_number || '—' },
            { label: 'Title', value: client.title || '—' },
            { label: 'Full name', value: formatClientName(client) || '—' },
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
                        {c.associations?.short_name && <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>{c.associations.short_name}</span>}
                        {c.case_type && <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: '500' }}>{c.case_type}</span>}
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
          onSaved={(updated) => {
            setClient(updated)
            setShowEditForm(false)
            onUpdated(updated)
            onNotice({ type: 'success', message: `${formatClientName(updated)} was saved.` })
          }}
        />
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '360px', border: '0.5px solid #d3d1c7' }}>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Delete this client?</div>
            <p style={{ fontSize: '13px', color: '#5f5e5a', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              This will deactivate <strong>{formatClientName(client)}</strong>. Their cases will remain in the system.
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

export default function Clients({ staff }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showNewClient, setShowNewClient] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      const { data } = await supabase
        .from('clients')
        .select('*, associations(short_name, name)')
        .eq('active', true)
        .order('last_name')

      if (cancelled) return
      setClients(data || [])
      setLoading(false)
    }

    loadClients()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = clients.filter(c => {
    const matchQ = matchesSearch(getClientSearchValues(c), search)
    const matchType = typeFilter === 'all' || c.client_type === typeFilter
    return matchQ && matchType
  })

  if (selectedClient) {
    return (
      <ClientDetail
        client={selectedClient}
        staff={staff}
        onBack={() => setSelectedClient(null)}
        onNotice={setNotice}
        onUpdated={(updated) => {
          setClients(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.last_name.localeCompare(b.last_name)))
          setSelectedClient(updated)
        }}
        onDeleted={(id) => {
          setClients(prev => prev.filter(c => c.id !== id))
          setSelectedClient(null)
        }}
      />
    )
  }

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Clients</div>
        <button onClick={() => setShowNewClient(true)} style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New client
        </button>
      </div>

      <PageNotice notice={notice} onDismiss={() => setNotice(null)} />

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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients, employee no., email, member ID..." style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '240px', color: '#2c2c2a' }} />
          </div>
          {['all', 'association', 'private'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: typeFilter === t ? '#0C447C' : '#d3d1c7', background: typeFilter === t ? '#0C447C' : '#fff', color: typeFilter === t ? '#fff' : '#5f5e5a' }}>
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
                {['Name', 'Employee No.', 'Email', 'Phone', 'Type', 'Association', 'Member ID', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelectedClient(c)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4', flexShrink: 0 }}>
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <span style={{ fontWeight: '500', color: '#2c2c2a' }}>{formatClientName(c)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', color: '#5f5e5a', fontFamily: 'monospace', fontSize: '12px' }}>{c.serial_number || '—'}</td>
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
            setNotice({ type: 'success', message: `${formatClientName(newClient)} was created.` })
          }}
        />
      )}
    </div>
  )
}
