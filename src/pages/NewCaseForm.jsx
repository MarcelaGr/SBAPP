import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { matchesSearch } from '../lib/search'
import { isValidSbNumber, normalizeSbNumber, sanitizeSbNumberInput } from '../lib/sb'
import { PRIVATE_CASE_TYPES, normalizeCaseType } from '../lib/caseTypes'
import { FormActions, FormModal, FormStatusMessage } from '../components/FormUi'

export default function NewCaseForm({ existingCase = null, onClose, onCreated, onSaved }) {
  const isEdit = !!existingCase
  const [associations, setAssociations] = useState([])
  const [attorneys, setAttorneys] = useState([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [selectedClient, setSelectedClient] = useState(existingCase?.clients || null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    sb_number: existingCase?.sb_number || '',
    case_category: existingCase?.case_category || '',
    association_id: existingCase?.association_id || '',
    association_case_number: existingCase?.association_case_number || '',
    case_type: normalizeCaseType(existingCase?.case_type) || '',
    billing_type: existingCase?.billing_type || 'hourly',
    private_hourly_rate: existingCase?.private_hourly_rate ?? '',
    flat_fee_amount: existingCase?.flat_fee_amount ?? '',
    deposit_amount: existingCase?.deposit_amount ?? '',
    brief_description: existingCase?.brief_description || '',
    full_description: existingCase?.full_description || '',
    opened_at: existingCase?.opened_at || new Date().toISOString().split('T')[0],
    status: existingCase?.status || 'active',
    lead_attorney_id: '',
    collaborator_ids: [],
  })

  useEffect(() => {
    let cancelled = false

    async function loadFormOptions() {
      const [associationsRes, attorneysRes] = await Promise.all([
        supabase.from('associations').select('*').eq('active', true).order('short_name'),
        supabase.from('staff').select('*').eq('role', 'attorney').eq('active', true).order('full_name'),
      ])

      if (cancelled) return
      setAssociations(associationsRes.data || [])
      setAttorneys(attorneysRes.data || [])
    }

    loadFormOptions()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false

    async function loadAssignedAttorneys() {
      const { data } = await supabase
        .from('case_attorneys')
        .select('attorney_id, is_lead')
        .eq('case_id', existingCase.id)

      if (cancelled) return

      const lead = (data || []).find(item => item.is_lead)?.attorney_id || ''
      const collaborators = (data || []).filter(item => !item.is_lead).map(item => item.attorney_id)
      setForm(prev => ({ ...prev, lead_attorney_id: lead, collaborator_ids: collaborators }))
    }

    loadAssignedAttorneys()

    return () => {
      cancelled = true
    }
  }, [existingCase, isEdit])

  useEffect(() => {
    let cancelled = false

    if (clientSearch.length < 2 || isEdit) {
      setClientResults([])
      return undefined
    }

    const timer = setTimeout(async () => {
      if (cancelled) return
      setSearching(true)

      const { data } = await supabase
        .from('clients')
        .select('*')
        .or(`first_name.ilike.%${clientSearch}%,last_name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`)
        .eq('active', true)
        .limit(25)

      if (cancelled) return
      setClientResults((data || []).filter(client => matchesSearch([client.first_name, client.last_name, client.email, client.sb_number, client.serial_number], clientSearch)).slice(0, 6))
      setSearching(false)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clientSearch, isEdit])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setSbNumber(value) {
    setField('sb_number', sanitizeSbNumberInput(value))
  }

  function toggleCollaborator(id) {
    setForm(prev => ({
      ...prev,
      collaborator_ids: prev.collaborator_ids.includes(id)
        ? prev.collaborator_ids.filter(x => x !== id)
        : [...prev.collaborator_ids, id],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!selectedClient) { setError('Please select a client.'); return }
    if (!form.case_category) { setError('Please select a case category.'); return }
    if (form.case_category === 'association' && !form.association_id) { setError('Please select an association.'); return }
    if (form.case_category === 'private' && !form.case_type) { setError('Please select a private case type.'); return }
    if (!form.brief_description.trim()) { setError('Please add a brief description.'); return }
    if (!isValidSbNumber(form.sb_number)) { setError('SB Number can include letters, numbers, spaces, and dashes only.'); return }

    setSaving(true)

    const caseData = {
      sb_number: normalizeSbNumber(form.sb_number) || null,
      client_id: selectedClient.id,
      case_category: form.case_category,
      billing_type: form.billing_type,
      brief_description: form.brief_description.trim(),
      full_description: form.full_description.trim() || null,
      opened_at: form.opened_at,
      status: form.status,
      association_id: null,
      association_case_number: null,
      case_type: null,
      private_hourly_rate: null,
      flat_fee_amount: null,
      deposit_amount: null,
    }

    if (form.case_category === 'association') {
      caseData.association_id = form.association_id
      caseData.association_case_number = form.association_case_number.trim() || null
    } else {
      caseData.case_type = form.case_type
      caseData.deposit_amount = form.deposit_amount ? parseFloat(form.deposit_amount) : null
      if (form.billing_type === 'hourly' && form.private_hourly_rate) {
        caseData.private_hourly_rate = parseFloat(form.private_hourly_rate)
      }
      if (form.billing_type === 'flat' && form.flat_fee_amount) {
        caseData.flat_fee_amount = parseFloat(form.flat_fee_amount)
      }
    }

    if (form.case_category === 'association' && form.billing_type === 'flat' && form.flat_fee_amount) {
      caseData.flat_fee_amount = parseFloat(form.flat_fee_amount)
    }

    delete caseData.serial_number

    const baseQuery = supabase.from('cases')
    const caseResult = isEdit
      ? await baseQuery.update(caseData).eq('id', existingCase.id).select('*, clients(*), associations(id, short_name, name), case_attorneys(attorney_id, is_lead, staff(full_name, initials))').single()
      : await baseQuery.insert(caseData).select('*, clients(*), associations(id, short_name, name), case_attorneys(attorney_id, is_lead, staff(full_name, initials))').single()

    if (caseResult.error) {
      setError(`Error ${isEdit ? 'saving' : 'creating'} case: ${caseResult.error.message}`)
      setSaving(false)
      return
    }

    const savedCase = caseResult.data
    const attorneyInserts = []

    if (form.lead_attorney_id) {
      attorneyInserts.push({ case_id: savedCase.id, attorney_id: form.lead_attorney_id, is_lead: true })
    }

    form.collaborator_ids.forEach(id => {
      if (id !== form.lead_attorney_id) {
        attorneyInserts.push({ case_id: savedCase.id, attorney_id: id, is_lead: false })
      }
    })

    if (isEdit) {
      const { error: deleteAttorneyError } = await supabase.from('case_attorneys').delete().eq('case_id', savedCase.id)
      if (deleteAttorneyError) {
        setError('Case saved, but attorney assignments could not be updated: ' + deleteAttorneyError.message)
        setSaving(false)
        return
      }
    }

    if (attorneyInserts.length > 0) {
      const { error: insertAttorneyError } = await supabase.from('case_attorneys').insert(attorneyInserts)
      if (insertAttorneyError) {
        setError('Case saved, but attorney assignments could not be updated: ' + insertAttorneyError.message)
        setSaving(false)
        return
      }
    }

    const { data: refreshedCase, error: refreshError } = await supabase
      .from('cases')
      .select('*, clients(id, first_name, last_name, email, phone), associations(id, short_name, name), case_attorneys(attorney_id, is_lead, staff(full_name, initials))')
      .eq('id', savedCase.id)
      .single()

    setSaving(false)

    if (refreshError) {
      setError('Case saved, but the refreshed record could not be loaded: ' + refreshError.message)
      return
    }

    if (isEdit) {
      onSaved?.(refreshedCase)
    } else {
      onCreated?.(refreshedCase)
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9',
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a',
    background: '#fff',
  }
  const labelStyle = {
    fontSize: '12px', fontWeight: '500', color: '#5f5e5a',
    display: 'block', marginBottom: '5px',
  }
  const fieldStyle = { marginBottom: '14px' }
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
  const sectionLabel = {
    fontSize: '11px', fontWeight: '500', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#888780', margin: '20px 0 12px',
    paddingBottom: '6px', borderBottom: '0.5px solid #f1efe8',
  }

  return (
    <FormModal
      title={isEdit ? 'Edit case' : 'New case'}
      subtitle={isEdit ? 'Update matter details, assignments, and billing configuration' : 'Create a new matter and assign attorneys'}
      onClose={onClose}
      maxWidth="620px"
    >
      <form onSubmit={handleSubmit}>
        <div style={sectionLabel}>Client</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Linked client</label>
          {selectedClient ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#E6F1FB', borderRadius: '8px', fontSize: '13px', gap: '10px' }}>
              <div>
                <span style={{ fontWeight: '500', color: '#0C447C' }}>{[selectedClient.title, selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ')}</span>
                {selectedClient.email && <span style={{ color: '#185FA5', marginLeft: '8px', fontSize: '12px' }}>{selectedClient.email}</span>}
                {selectedClient.serial_number && <span style={{ color: '#185FA5', marginLeft: '8px', fontSize: '12px' }}>Employee no. {selectedClient.serial_number}</span>}
              </div>
              {!isEdit && (
                <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }} style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontSize: '13px' }}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Type client name, employee no., or email..." style={inputStyle} />
              {clientSearch.length >= 2 && (clientResults.length > 0 || searching) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, marginTop: '4px', overflow: 'hidden' }}>
                  {searching && <div style={{ padding: '10px 12px', fontSize: '12px', color: '#888780' }}>Searching...</div>}
                  {clientResults.map(client => (
                    <div key={client.id} onClick={() => { setSelectedClient(client); setClientSearch(''); setClientResults([]) }} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '0.5px solid #f1efe8' }} onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <span style={{ fontWeight: '500', color: '#2c2c2a' }}>{client.last_name}, {client.first_name}</span>
                      {client.serial_number && <span style={{ color: '#185FA5', marginLeft: '8px', fontSize: '12px' }}>#{client.serial_number}</span>}
                      {client.email && <span style={{ color: '#888780', marginLeft: '8px', fontSize: '12px' }}>{client.email}</span>}
                    </div>
                  ))}
                  {!searching && clientResults.length === 0 && clientSearch.length >= 2 && (
                    <div style={{ padding: '10px 12px', fontSize: '12px', color: '#888780' }}>
                      No clients found. Create the client from the Clients screen first.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={sectionLabel}>Case type</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>SB Number</label>
          <input type="text" value={form.sb_number} onChange={e => setSbNumber(e.target.value)} placeholder="e.g. SB 26-0100" style={inputStyle} />
        </div>
        <div style={{ ...fieldStyle, ...gridStyle }}>
          {['association', 'private'].map(cat => (
            <div
              key={cat}
              onClick={() => setField('case_category', cat)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                border: form.case_category === cat ? '2px solid #0C447C' : '0.5px solid #d3d1c7',
                background: form.case_category === cat ? '#E6F1FB' : '#fff',
                color: form.case_category === cat ? '#0C447C' : '#5f5e5a',
                fontWeight: form.case_category === cat ? '500' : '400',
                fontSize: '13px',
              }}
            >
              {cat === 'association' ? 'Association' : 'Private'}
            </div>
          ))}
        </div>

        {form.case_category === 'association' && (
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Association</label>
              <select value={form.association_id} onChange={e => setField('association_id', e.target.value)} style={inputStyle}>
                <option value="">Select association...</option>
                {associations.map(a => <option key={a.id} value={a.id}>{a.short_name} — {a.name}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Association case no.</label>
              <input type="text" value={form.association_case_number} onChange={e => setField('association_case_number', e.target.value)} placeholder="e.g. ALADS-2026-441" style={inputStyle} />
            </div>
          </div>
        )}

        {form.case_category === 'private' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Private case type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PRIVATE_CASE_TYPES.map(t => (
                <div
                  key={t}
                  onClick={() => setField('case_type', t)}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: form.case_type === t ? '2px solid #3C3489' : '0.5px solid #d3d1c7',
                    background: form.case_type === t ? '#EEEDFE' : '#fff',
                    color: form.case_type === t ? '#3C3489' : '#5f5e5a',
                    fontWeight: form.case_type === t ? '500' : '400',
                    fontSize: '13px',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={sectionLabel}>Billing</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Billing type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['hourly', 'flat'].map(t => (
              <div
                key={t}
                onClick={() => setField('billing_type', t)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: form.billing_type === t ? '2px solid #0C447C' : '0.5px solid #d3d1c7',
                  background: form.billing_type === t ? '#E6F1FB' : '#fff',
                  color: form.billing_type === t ? '#0C447C' : '#5f5e5a',
                  fontWeight: form.billing_type === t ? '500' : '400',
                  fontSize: '13px',
                }}
              >
                {t === 'hourly' ? 'Hourly' : 'Flat fee'}
              </div>
            ))}
          </div>
        </div>

        {form.billing_type === 'hourly' && form.case_category === 'private' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Hourly rate ($/hr)</label>
            <input type="number" value={form.private_hourly_rate} onChange={e => setField('private_hourly_rate', e.target.value)} placeholder="e.g. 275" style={inputStyle} />
          </div>
        )}
        {form.billing_type === 'hourly' && form.case_category === 'association' && (
          <div style={{ padding: '8px 12px', background: '#f1efe8', borderRadius: '8px', fontSize: '12px', color: '#888780', marginBottom: '14px' }}>
            Rate will be pulled from the rate table (attorney × association)
          </div>
        )}
        {form.billing_type === 'flat' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Flat fee amount ($)</label>
            <input type="number" value={form.flat_fee_amount} onChange={e => setField('flat_fee_amount', e.target.value)} placeholder="e.g. 1500" style={inputStyle} />
          </div>
        )}
        {form.case_category === 'private' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Deposit amount ($)</label>
            <input type="number" value={form.deposit_amount} onChange={e => setField('deposit_amount', e.target.value)} placeholder="Pre-filled from attorney default" style={inputStyle} />
          </div>
        )}

        <div style={sectionLabel}>Description</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Brief description <span style={{ color: '#a32d2d' }}>*</span> <span style={{ fontWeight: '400', color: '#888780' }}>(appears on invoice)</span></label>
          <input type="text" value={form.brief_description} onChange={e => setField('brief_description', e.target.value)} placeholder="e.g. Termination appeal, disciplinary hearing..." style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Full description / notes</label>
          <textarea value={form.full_description} onChange={e => setField('full_description', e.target.value)} placeholder="Detailed background, context, notes..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} />
        </div>

        <div style={sectionLabel}>Attorneys</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Lead attorney</label>
          <select value={form.lead_attorney_id} onChange={e => setField('lead_attorney_id', e.target.value)} style={inputStyle}>
            <option value="">Select lead attorney...</option>
            {attorneys.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.initials})</option>)}
          </select>
        </div>
        {attorneys.length > 0 && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Collaborating attorneys</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '0.5px solid #d3d1c7', borderRadius: '8px', padding: '10px 12px', background: '#faf9f7' }}>
              {attorneys.filter(a => a.id !== form.lead_attorney_id).map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#2c2c2a' }}>
                  <input type="checkbox" checked={form.collaborator_ids.includes(a.id)} onChange={() => toggleCollaborator(a.id)} style={{ accentColor: '#0C447C', width: '14px', height: '14px', margin: 0 }} />
                  <span>{a.full_name} ({a.initials})</span>
                </label>
              ))}
              {attorneys.filter(a => a.id !== form.lead_attorney_id).length === 0 && (
                <div style={{ fontSize: '12px', color: '#888780' }}>No additional attorneys available.</div>
              )}
            </div>
          </div>
        )}

        <div style={sectionLabel}>Details</div>
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Date opened</label>
            <input type="date" value={form.opened_at} onChange={e => setField('opened_at', e.target.value)} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)} style={inputStyle}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <FormStatusMessage message={error} />
        <FormActions onCancel={onClose} saving={saving} saveLabel="Save case" savingLabel={isEdit ? 'Saving...' : 'Creating...'} />
      </form>
    </FormModal>
  )
}
