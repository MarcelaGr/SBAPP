import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// ─── ASSOCIATIONS TAB ─────────────────────────────────────────
function AssociationsTab() {
  const [associations, setAssociations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAssoc, setEditAssoc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', short_name: '', billing_contact_name: '',
    billing_contact_email: '', address_street: '', address_city_state_zip: '', notes: ''
  })

  useEffect(() => { fetchAssociations() }, [])

  async function fetchAssociations() {
    const { data } = await supabase.from('associations').select('*').order('short_name')
    setAssociations(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditAssoc(null)
    setForm({ name: '', short_name: '', billing_contact_name: '', billing_contact_email: '', address_street: '', address_city_state_zip: '', notes: '' })
    setError('')
    setShowForm(true)
  }

  function openEdit(assoc) {
    setEditAssoc(assoc)
    setForm({
      name: assoc.name || '', short_name: assoc.short_name || '',
      billing_contact_name: assoc.billing_contact_name || '',
      billing_contact_email: assoc.billing_contact_email || '',
      address_street: assoc.address_street || '',
      address_city_state_zip: assoc.address_city_state_zip || '',
      notes: assoc.notes || ''
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Full name is required.'); return }
    if (!form.short_name.trim()) { setError('Short name is required.'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), short_name: form.short_name.trim().toUpperCase(),
      billing_contact_name: form.billing_contact_name.trim() || null,
      billing_contact_email: form.billing_contact_email.trim() || null,
      address_street: form.address_street.trim() || null,
      address_city_state_zip: form.address_city_state_zip.trim() || null,
      notes: form.notes.trim() || null, active: true,
    }
    let dbError
    if (editAssoc) {
      const res = await supabase.from('associations').update(payload).eq('id', editAssoc.id)
      dbError = res.error
    } else {
      const res = await supabase.from('associations').insert(payload)
      dbError = res.error
    }
    if (dbError) { setError('Error: ' + dbError.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    fetchAssociations()
  }

  async function toggleActive(assoc) {
    await supabase.from('associations').update({ active: !assoc.active }).eq('id', assoc.id)
    fetchAssociations()
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#888780' }}>{associations.length} associations</div>
        <button onClick={openNew}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New association
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888780', fontSize: '13px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {associations.map((assoc, idx) => (
            <div key={assoc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < associations.length - 1 ? '0.5px solid #f1efe8' : 'none', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>{assoc.short_name}</span>
                  <span style={{ background: assoc.active ? '#eaf3de' : '#f1efe8', color: assoc.active ? '#27500a' : '#5f5e5a', padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                    {assoc.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#888780' }}>{assoc.name}</div>
                {assoc.billing_contact_email && <div style={{ fontSize: '12px', color: '#888780' }}>{assoc.billing_contact_email}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openEdit(assoc)}
                  style={{ padding: '4px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}>
                  Edit
                </button>
                <button onClick={() => toggleActive(assoc)}
                  style={{ padding: '4px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: assoc.active ? '#a32d2d' : '#27500a' }}>
                  {assoc.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '1.75rem', border: '0.5px solid #d3d1c7', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>{editAssoc ? 'Edit association' : 'New association'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Full name <span style={{ color: '#a32d2d' }}>*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Association for Los Angeles Deputy Sheriffs" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Short name <span style={{ color: '#a32d2d' }}>*</span></label>
                  <input type="text" value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="e.g. ALADS" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Billing contact name</label>
                  <input type="text" value={form.billing_contact_name} onChange={e => setForm(p => ({ ...p, billing_contact_name: e.target.value }))} placeholder="Contact name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Billing contact email</label>
                  <input type="email" value={form.billing_contact_email} onChange={e => setForm(p => ({ ...p, billing_contact_email: e.target.value }))} placeholder="billing@assoc.org" style={inputStyle} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Mailing address</label>
                <input type="text" value={form.address_street} onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))} placeholder="Street address" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>City, state, ZIP</label>
                <input type="text" value={form.address_city_state_zip} onChange={e => setForm(p => ({ ...p, address_city_state_zip: e.target.value }))} placeholder="e.g. Montebello, CA 90640" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes about this association..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              {error && <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : editAssoc ? 'Save changes' : 'Create association'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── STAFF / MEMBERS TAB ──────────────────────────────────────
function StaffTab() {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    full_name: '', initials: '', email: '', phone: '',
    role: 'attorney', bar_number: '', default_deposit: ''
  })

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    const { data } = await supabase.from('staff').select('*').order('role').order('full_name')
    setStaffList(data || [])
    setLoading(false)
  }

  function openNew() {
    setForm({ full_name: '', initials: '', email: '', phone: '', role: 'attorney', bar_number: '', default_deposit: '' })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.full_name.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (!form.initials.trim()) { setError('Initials are required.'); return }

    setSaving(true)

    // 1. Create auth user via Supabase Admin (inviteUserByEmail)
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      form.email.trim(),
      { redirectTo: window.location.origin }
    )

    // If admin API not available, use signUp instead
    let userId
    if (authError) {
      // Fallback: create with a temp password
      const tempPassword = 'TempPass123!' + Math.random().toString(36).slice(2, 8)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: tempPassword,
        options: { emailRedirectTo: window.location.origin }
      })
      if (signUpError) { setError('Error creating login: ' + signUpError.message); setSaving(false); return }
      userId = signUpData?.user?.id
    } else {
      userId = authData?.user?.id
    }

    if (!userId) { setError('Could not create user account. Please try again.'); setSaving(false); return }

    // 2. Insert into staff table
    const { error: staffError } = await supabase.from('staff').insert({
      id: userId,
      full_name: form.full_name.trim(),
      initials: form.initials.trim().toUpperCase(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      bar_number: form.bar_number.trim() || null,
      default_deposit: form.default_deposit ? parseFloat(form.default_deposit) : null,
      active: true,
    })

    if (staffError) { setError('Error saving staff: ' + staffError.message); setSaving(false); return }

    setSaving(false)
    setSuccess(`${form.full_name} has been added. They will receive an email invitation to set their password.`)
    setForm({ full_name: '', initials: '', email: '', phone: '', role: 'attorney', bar_number: '', default_deposit: '' })
    fetchStaff()
  }

  async function toggleActive(member) {
    await supabase.from('staff').update({ active: !member.active }).eq('id', member.id)
    fetchStaff()
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }

  const avatarColor = (role) => role === 'admin'
    ? { bg: '#EEEDFE', color: '#3C3489' }
    : { bg: '#E6F1FB', color: '#0C447C' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#888780' }}>{staffList.length} team members</div>
        <button onClick={openNew}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + New member
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888780', fontSize: '13px' }}>Loading...</div>
      ) : (
        <div>
          {['admin', 'attorney'].map(role => {
            const roleMembers = staffList.filter(s => s.role === role)
            if (roleMembers.length === 0) return null
            return (
              <div key={role} style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>
                  {role === 'admin' ? 'Administrators' : 'Attorneys'}
                </div>
                {roleMembers.map((member, idx) => {
                  const ac = avatarColor(member.role)
                  return (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: idx < roleMembers.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', color: ac.color, flexShrink: 0 }}>
                        {member.initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{member.full_name}</span>
                          <span style={{ background: member.active ? '#eaf3de' : '#f1efe8', color: member.active ? '#27500a' : '#5f5e5a', padding: '1px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#888780' }}>
                          {member.email}
                          {member.bar_number && <span style={{ marginLeft: '8px' }}>· Bar #{member.bar_number}</span>}
                          {member.default_deposit && <span style={{ marginLeft: '8px' }}>· Default deposit: ${member.default_deposit}</span>}
                        </div>
                      </div>
                      <button onClick={() => toggleActive(member)}
                        style={{ padding: '4px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: member.active ? '#a32d2d' : '#27500a', flexShrink: 0 }}>
                        {member.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* New member modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '1.75rem', border: '0.5px solid #d3d1c7', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>New team member</div>
                <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>They will receive an email invitation to set their password</div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer' }}>✕</button>
            </div>

            {success && (
              <div style={{ background: '#eaf3de', border: '0.5px solid #97C459', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#27500a', marginBottom: '1rem' }}>
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Full name <span style={{ color: '#a32d2d' }}>*</span></label>
                  <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="First and last name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Initials <span style={{ color: '#a32d2d' }}>*</span></label>
                  <input type="text" value={form.initials} onChange={e => setForm(p => ({ ...p, initials: e.target.value.toUpperCase() }))} placeholder="e.g. MS, RG, MB" maxLength={3} style={inputStyle} />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email <span style={{ color: '#a32d2d' }}>*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="their@email.com" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(xxx) xxx-xxxx" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Role <span style={{ color: '#a32d2d' }}>*</span></label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="attorney">Attorney</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              {form.role === 'attorney' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Bar number</label>
                    <input type="text" value={form.bar_number} onChange={e => setForm(p => ({ ...p, bar_number: e.target.value }))} placeholder="State bar number" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Default deposit ($)</label>
                    <input type="number" value={form.default_deposit} onChange={e => setForm(p => ({ ...p, default_deposit: e.target.value }))} placeholder="e.g. 1500" style={inputStyle} />
                  </div>
                </div>
              )}
              {error && <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Creating...' : 'Create member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RATE TABLE TAB ───────────────────────────────────────────
function RateTableTab() {
  const [rates, setRates] = useState([])
  const [attorneys, setAttorneys] = useState([])
  const [associations, setAssociations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRate, setEditRate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ attorney_id: '', association_id: '', billing_type: 'hourly', hourly_rate: '', flat_fee: '' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [ratesRes, attysRes, assocsRes] = await Promise.all([
      supabase.from('rate_table').select('*, staff:attorney_id(full_name, initials), associations(short_name, name)').order('attorney_id'),
      supabase.from('staff').select('*').eq('role', 'attorney').eq('active', true).order('full_name'),
      supabase.from('associations').select('*').eq('active', true).order('short_name'),
    ])
    setRates(ratesRes.data || [])
    setAttorneys(attysRes.data || [])
    setAssociations(assocsRes.data || [])
    setLoading(false)
  }

  function openNew() {
    setEditRate(null)
    setForm({ attorney_id: '', association_id: '', billing_type: 'hourly', hourly_rate: '', flat_fee: '' })
    setError('')
    setShowForm(true)
  }

  function openEdit(rate) {
    setEditRate(rate)
    setForm({
      attorney_id: rate.attorney_id, association_id: rate.association_id,
      billing_type: rate.billing_type, hourly_rate: rate.hourly_rate || '',
      flat_fee: rate.flat_fee || ''
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.attorney_id) { setError('Select an attorney.'); return }
    if (!form.association_id) { setError('Select an association.'); return }
    setSaving(true)
    const payload = {
      attorney_id: form.attorney_id, association_id: form.association_id,
      billing_type: form.billing_type,
      hourly_rate: form.billing_type === 'hourly' ? parseFloat(form.hourly_rate) || null : null,
      flat_fee: form.billing_type === 'flat' ? parseFloat(form.flat_fee) || null : null,
      effective_from: new Date().toISOString().split('T')[0],
    }
    let dbError
    if (editRate) {
      const res = await supabase.from('rate_table').update(payload).eq('id', editRate.id)
      dbError = res.error
    } else {
      const res = await supabase.from('rate_table').upsert(payload, { onConflict: 'attorney_id,association_id' })
      dbError = res.error
    }
    if (dbError) { setError('Error: ' + dbError.message); setSaving(false); return }
    setSaving(false)
    setShowForm(false)
    fetchAll()
  }

  async function deleteRate(id) {
    if (!window.confirm('Delete this rate?')) return
    await supabase.from('rate_table').delete().eq('id', id)
    fetchAll()
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }

  // Group rates by attorney
  const byAttorney = attorneys.map(atty => ({
    atty,
    rates: rates.filter(r => r.attorney_id === atty.id)
  })).filter(g => g.rates.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '13px', color: '#888780' }}>Attorney × Association billing rates</div>
        <button onClick={openNew}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
          + Add rate
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888780', fontSize: '13px' }}>Loading...</div>
      ) : rates.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#b4b2a9', fontSize: '13px' }}>
          No rates configured yet. Add rates for each attorney × association combination.
        </div>
      ) : (
        byAttorney.map(({ atty, rates: attyRates }) => (
          <div key={atty.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                {atty.initials}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{atty.full_name}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Association', 'Billing type', 'Rate', 'Effective from', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attyRates.map(rate => (
                  <tr key={rate.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                      <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                        {rate.associations?.short_name}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8', color: '#5f5e5a' }}>
                      {rate.billing_type === 'hourly' ? 'Hourly' : 'Flat fee'}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500', color: '#2c2c2a' }}>
                      {rate.billing_type === 'hourly' ? `$${rate.hourly_rate}/hr` : `$${rate.flat_fee}`}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8', color: '#888780' }}>
                      {rate.effective_from}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => openEdit(rate)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteRate(rate.id)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Rate form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '1.75rem', border: '0.5px solid #d3d1c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>{editRate ? 'Edit rate' : 'Add rate'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Attorney</label>
                <select value={form.attorney_id} onChange={e => setForm(p => ({ ...p, attorney_id: e.target.value }))} style={inputStyle} disabled={!!editRate}>
                  <option value="">Select attorney...</option>
                  {attorneys.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.initials})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Association</label>
                <select value={form.association_id} onChange={e => setForm(p => ({ ...p, association_id: e.target.value }))} style={inputStyle} disabled={!!editRate}>
                  <option value="">Select association...</option>
                  {associations.map(a => <option key={a.id} value={a.id}>{a.short_name} — {a.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Billing type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['hourly', 'flat'].map(t => (
                    <div key={t} onClick={() => setForm(p => ({ ...p, billing_type: t }))}
                      style={{ padding: '10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: form.billing_type === t ? '2px solid #0C447C' : '0.5px solid #d3d1c7', background: form.billing_type === t ? '#E6F1FB' : '#fff', color: form.billing_type === t ? '#0C447C' : '#5f5e5a', fontWeight: form.billing_type === t ? '500' : '400', fontSize: '13px' }}>
                      {t === 'hourly' ? '⏱ Hourly' : '💰 Flat fee'}
                    </div>
                  ))}
                </div>
              </div>
              {form.billing_type === 'hourly' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Hourly rate ($/hr)</label>
                  <input type="number" value={form.hourly_rate} onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="e.g. 275" style={inputStyle} />
                </div>
              )}
              {form.billing_type === 'flat' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Flat fee amount ($)</label>
                  <input type="number" value={form.flat_fee} onChange={e => setForm(p => ({ ...p, flat_fee: e.target.value }))} placeholder="e.g. 1500" style={inputStyle} />
                </div>
              )}
              {error && <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : editRate ? 'Save changes' : 'Add rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── IMPORT TAB ───────────────────────────────────────────────
function ImportTab() {
  const [step, setStep] = useState(1)
  const [importType, setImportType] = useState('cases')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)

  const caseFields = ['SB file number', 'Client last name', 'Client first name', 'Association', 'Brief description', 'Date opened', 'Status', '— Skip —']
  const clientFields = ['Last name', 'First name', 'Email', 'Phone', 'Association', 'Member ID', 'Address', 'City/State/ZIP', '— Skip —']

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const hdrs = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
      const data = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.replace(/"/g, '').trim())
        const row = {}
        hdrs.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })
      setHeaders(hdrs)
      setRows(data)
      const initMap = {}
      hdrs.forEach(h => { initMap[h] = '— Skip —' })
      setMapping(initMap)
      setStep(2)
    }
    reader.readAsText(file)
  }

  function preview() { setStep(3) }

  async function runImport() {
    setImporting(true)
    let success = 0, errors = 0
    for (const row of rows.slice(0, 50)) {
      try {
        if (importType === 'clients') {
          const payload = {
            last_name: row[Object.keys(mapping).find(k => mapping[k] === 'Last name')] || '',
            first_name: row[Object.keys(mapping).find(k => mapping[k] === 'First name')] || '',
            email: row[Object.keys(mapping).find(k => mapping[k] === 'Email')] || null,
            phone: row[Object.keys(mapping).find(k => mapping[k] === 'Phone')] || null,
            client_type: 'association',
            active: true,
          }
          if (!payload.last_name) { errors++; continue }
          const { error } = await supabase.from('clients').insert(payload)
          if (error) errors++; else success++
        }
      } catch { errors++ }
    }
    setImporting(false)
    setResults({ success, errors, total: rows.length })
    setStep(4)
  }

  return (
    <div>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '1.5rem' }}>
        {[
          { n: 1, label: 'Upload file' },
          { n: 2, label: 'Map columns' },
          { n: 3, label: 'Preview' },
          { n: 4, label: 'Done' },
        ].map((s, idx) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= s.n ? '#0C447C' : '#d3d1c7', color: step >= s.n ? '#fff' : '#888780', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500' }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: '12px', color: step >= s.n ? '#2c2c2a' : '#888780', fontWeight: step === s.n ? '500' : '400' }}>{s.label}</span>
            </div>
            {idx < 3 && <div style={{ width: '24px', height: '0.5px', background: '#d3d1c7' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
            {['cases', 'clients'].map(t => (
              <button key={t} onClick={() => setImportType(t)}
                style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: importType === t ? '#0C447C' : '#d3d1c7', background: importType === t ? '#0C447C' : '#fff', color: importType === t ? '#fff' : '#5f5e5a' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <label style={{ display: 'block', border: '2px dashed #d3d1c7', borderRadius: '12px', padding: '3rem', textAlign: 'center', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a', marginBottom: '4px' }}>Click to upload your file</div>
            <div style={{ fontSize: '12px', color: '#888780' }}>.csv, .xlsx, .xls · Max 10MB</div>
          </label>
          <div style={{ marginTop: '1rem', padding: '10px 14px', background: '#f1efe8', borderRadius: '8px', fontSize: '12px', color: '#5f5e5a' }}>
            Tip: Export your existing Excel or Word data as a CSV file first, then upload it here. You'll match the columns manually in the next step.
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '1rem' }}>
            File: <strong style={{ color: '#2c2c2a' }}>{fileName}</strong> · {rows.length} rows detected. Match your columns to the app fields.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase' }}>Your column</th>
                <th style={{ padding: '6px', borderBottom: '0.5px solid #d3d1c7' }} />
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase' }}>App field</th>
              </tr>
            </thead>
            <tbody>
              {headers.map(h => (
                <tr key={h}>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                    <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{h}</span>
                  </td>
                  <td style={{ padding: '8px 6px', borderBottom: '0.5px solid #f1efe8', color: '#888780', fontSize: '16px', textAlign: 'center' }}>→</td>
                  <td style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                    <select value={mapping[h] || '— Skip —'}
                      onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                      style={{ padding: '5px 8px', border: '0.5px solid #d3d1c7', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#2c2c2a' }}>
                      {(importType === 'cases' ? caseFields : clientFields).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
            <button onClick={() => setStep(1)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Back</button>
            <button onClick={preview} style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Preview import →</button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '1rem' }}>
            Previewing first 5 of {rows.length} rows. Review before importing.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '500px' }}>
              <thead>
                <tr>
                  {Object.entries(mapping).filter(([, v]) => v !== '— Skip —').map(([k, v]) => (
                    <th key={k} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}>
                    {Object.entries(mapping).filter(([, v]) => v !== '— Skip —').map(([k]) => (
                      <td key={k} style={{ padding: '8px 10px', borderBottom: '0.5px solid #f1efe8', color: '#2c2c2a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[k] || <span style={{ color: '#b4b2a9' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <div style={{ fontSize: '12px', color: '#888780', marginTop: '8px' }}>... and {rows.length - 5} more rows</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
            <button onClick={() => setStep(2)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>Back</button>
            <button onClick={runImport} disabled={importing}
              style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: importing ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: importing ? 'not-allowed' : 'pointer' }}>
              {importing ? 'Importing...' : `Confirm import (${rows.length} rows)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && results && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>{results.errors === 0 ? '🎉' : '⚠️'}</div>
          <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Import complete</div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '1.5rem' }}>
            {results.success} imported successfully · {results.errors} errors · {results.total} total rows
          </div>
          <button onClick={() => { setStep(1); setFileName(''); setRows([]); setHeaders([]); setMapping({}); setResults(null) }}
            style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SETTINGS MAIN ────────────────────────────────────────────
export default function Settings({ staff }) {
  const [activeTab, setActiveTab] = useState('associations')

  const tabs = [
    { key: 'associations', label: 'Associations' },
    { key: 'staff', label: 'Team members' },
    { key: 'rates', label: 'Rate table' },
    { key: 'import', label: 'Import data' },
  ]

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '1rem' }}>Settings</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px 12px 0 0', borderBottom: 'none', padding: '0 1.25rem', marginBottom: '0' }}>
        {tabs.map(tab => (
          <div key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer', color: activeTab === tab.key ? '#0C447C' : '#888780', fontWeight: activeTab === tab.key ? '500' : '400', borderBottom: activeTab === tab.key ? '2px solid #0C447C' : '2px solid transparent', whiteSpace: 'nowrap' }}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '1.25rem' }}>
        {activeTab === 'associations' && <AssociationsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'rates' && <RateTableTab />}
        {activeTab === 'import' && <ImportTab />}
      </div>
    </div>
  )
}