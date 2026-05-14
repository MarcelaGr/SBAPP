import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { getTimeslipSearchValues, matchesSearch } from '../lib/search'
import { FormActions, FormModal, FormStatusMessage, PageNotice } from '../components/FormUi'
import { EXPENSE_CATEGORIES } from '../lib/expenses'

// ─── NEW / EDIT TIMESLIP FORM ─────────────────────────────────
function TimeslipForm({ staff, editEntry, onClose, onSaved }) {
  const isEdit = !!editEntry
  const [caseSearch, setCaseSearch] = useState('')
  const [caseResults, setCaseResults] = useState([])
  const [selectedCase, setSelectedCase] = useState(
    editEntry ? { id: editEntry.case_id, sb_number: editEntry.cases?.sb_number, client: editEntry.cases?.clients } : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attorneys, setAttorneys] = useState([])
  const [form, setForm] = useState({
    attorney_id: editEntry?.attorney_id || (staff?.role === 'attorney' ? staff.id : ''),
    entry_date: editEntry?.entry_date || new Date().toISOString().split('T')[0],
    hours: editEntry ? Math.floor(editEntry.hours) : 0,
    minutes: editEntry ? Math.round((editEntry.hours % 1) * 60) : 0,
    description: editEntry?.description || '',
    billable: editEntry?.billable !== false ? true : false,
  })

  // Expense tracking
  const [expenses, setExpenses] = useState([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Court fees',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
    billable: true,
  })
  const [expenseFile, setExpenseFile] = useState(null)
  const [uploadingExpense, setUploadingExpense] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => {
    if (staff?.role === 'admin') {
      supabase.from('staff').select('*').eq('role', 'attorney').eq('active', true).order('full_name')
        .then(({ data }) => setAttorneys(data || []))
    }
  }, [staff])

  useEffect(() => {
    if (caseSearch.length < 2) { setCaseResults([]); return }
    const timer = setTimeout(() => searchCases(caseSearch), 300)
    return () => clearTimeout(timer)
  }, [caseSearch])

  async function searchCases(q) {
    let query = supabase
      .from('cases')
      .select('id, sb_number, brief_description, clients(first_name, last_name), associations(short_name), case_category, case_type, association_id, private_hourly_rate')
      .or(`sb_number.ilike.%${q}%,brief_description.ilike.%${q}%`)
      .limit(25)
    if (staff?.role === 'attorney') {
      query = query.eq('case_attorneys.attorney_id', staff.id)
    }
    const { data } = await query
    setCaseResults((data || []).filter(item => matchesSearch([item.sb_number, item.brief_description, item.clients?.first_name, item.clients?.last_name], q)).slice(0, 6))
  }

  function setField(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  function setExpenseField(key, value) { setExpenseForm(prev => ({ ...prev, [key]: value })) }

  async function handleExpenseFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File must be smaller than 10MB'); return }
    setExpenseFile(file)
  }

  async function handleAddExpense() {
    if (!expenseForm.title.trim()) { setError('Please enter an expense title.'); return }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) { setError('Please enter a valid amount.'); return }

    setUploadingExpense(true)
    let filePath = null

    // Upload file if provided
    if (expenseFile && selectedCase) {
      const fileName = `${Date.now()}_${expenseFile.name.replace(/[^\w.-]/g, '')}`
      const { error: uploadError } = await supabase.storage
        .from('case-expenses')
        .upload(`${selectedCase.id}/${fileName}`, expenseFile)
      
      if (uploadError) { setError('File upload failed: ' + uploadError.message); setUploadingExpense(false); return }
      filePath = `case-expenses/${selectedCase.id}/${fileName}`
    }

    // Add to local expenses array
    const newExpense = {
      ...expenseForm,
      amount: parseFloat(expenseForm.amount),
      file_path: filePath,
      file_name: expenseFile?.name,
      file_size_kb: expenseFile ? Math.ceil(expenseFile.size / 1024) : null,
    }

    setExpenses([...expenses, newExpense])
    setExpenseForm({ title: '', category: 'Court fees', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '', billable: true })
    setExpenseFile(null)
    setShowExpenseForm(false)
    setUploadingExpense(false)
  }

  function removeExpense(index) {
    setExpenses(prev => prev.filter((_, i) => i !== index))
  }

  const totalHours = (parseInt(form.hours) || 0) + ((parseInt(form.minutes) || 0) / 60)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!selectedCase) { setError('Please link this entry to a case.'); return }
    if (totalHours === 0) { setError('Please enter time spent.'); return }
    if (!form.description.trim()) { setError('Please add a description.'); return }
    if (!form.attorney_id) { setError('Please select an attorney.'); return }

    setSaving(true)
    const payload = {
      case_id: selectedCase.id,
      attorney_id: form.attorney_id,
      entry_date: form.entry_date,
      hours: totalHours,
      description: form.description.trim(),
      billable: form.billable,
      status: 'pending',
    }

    let data, dbError
    if (isEdit) {
      const res = await supabase.from('time_entries').update(payload).eq('id', editEntry.id)
        .select('*, staff:attorney_id(full_name, initials), cases(sb_number, brief_description, clients(first_name, last_name))').single()
      data = res.data; dbError = res.error
    } else {
      const res = await supabase.from('time_entries').insert(payload)
        .select('*, staff:attorney_id(full_name, initials), cases(sb_number, brief_description, clients(first_name, last_name))').single()
      data = res.data; dbError = res.error
    }

    if (dbError) { setError('Error: ' + dbError.message); setSaving(false); return }

    // Save expenses if any
    if (expenses.length > 0 && data?.id) {
      const expensePayloads = expenses.map(exp => ({
        time_entry_id: data.id,
        case_id: data.case_id,
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        expense_date: exp.expense_date,
        notes: exp.notes,
        billable: exp.billable,
        receipt_file_name: exp.file_name || null,
        receipt_file_path: exp.file_path || null,
        receipt_file_size_kb: exp.file_size_kb || null,
        created_by: staff?.id,
      }))

      const { error: expenseError } = await supabase.from('time_entry_expenses').insert(expensePayloads)
      if (expenseError) { setError('Error saving expenses: ' + expenseError.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved(data, isEdit)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
  const labelStyle = { fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }
  const fieldStyle = { marginBottom: '14px' }

  return (
    <FormModal
      title={isEdit ? 'Edit timeslip' : 'New timeslip'}
      subtitle={isEdit ? 'Changes will be resubmitted for admin approval' : 'Submitted as pending and reviewed before invoicing'}
      onClose={onClose}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit}>

          {/* Attorney selector (admin only) */}
          {staff?.role === 'admin' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Attorney <span style={{ color: '#a32d2d' }}>*</span></label>
              <select value={form.attorney_id} onChange={e => setField('attorney_id', e.target.value)} style={inputStyle}>
                <option value="">Select attorney...</option>
                {attorneys.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.initials})</option>)}
              </select>
            </div>
          )}

          {/* Case search */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Linked case <span style={{ color: '#a32d2d' }}>*</span></label>
            {selectedCase ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#E6F1FB', borderRadius: '8px', fontSize: '13px' }}>
                <div>
                  <span style={{ fontWeight: '500', color: '#0C447C' }}>{selectedCase.sb_number}</span>
                  {selectedCase.clients && <span style={{ color: '#185FA5', marginLeft: '8px', fontSize: '12px' }}>{selectedCase.clients.last_name}, {selectedCase.clients.first_name}</span>}
                  {selectedCase.brief_description && <span style={{ color: '#888780', marginLeft: '8px', fontSize: '12px' }}>· {selectedCase.brief_description}</span>}
                </div>
                <button type="button" onClick={() => { setSelectedCase(null); setCaseSearch('') }}
                  style={{ background: 'none', border: 'none', color: '#185FA5', cursor: 'pointer', fontSize: '14px', marginLeft: '8px' }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input type="text" value={caseSearch} onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Search by SB no. or client name..." style={inputStyle} />
                {caseResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '8px', zIndex: 10, marginTop: '4px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    {caseResults.map(c => (
                      <div key={c.id} onClick={() => { setSelectedCase(c); setCaseSearch(''); setCaseResults([]) }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '0.5px solid #f1efe8' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <span style={{ fontWeight: '500', color: '#185FA5' }}>{c.sb_number}</span>
                        <span style={{ color: '#888780', marginLeft: '8px' }}>{c.clients?.last_name}, {c.clients?.first_name}</span>
                        {c.brief_description && <span style={{ color: '#b4b2a9', marginLeft: '8px' }}>· {c.brief_description}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {caseSearch.length >= 2 && caseResults.length === 0 && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#888780' }}>No cases found. Try a different search.</div>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Date <span style={{ color: '#a32d2d' }}>*</span></label>
            <input type="date" value={form.entry_date} onChange={e => setField('entry_date', e.target.value)} style={inputStyle} />
          </div>

          {/* Description */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Description of work <span style={{ color: '#a32d2d' }}>*</span></label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
              placeholder="e.g. Hearing preparation, evidence review, client conference..."
              rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }} />
          </div>

          {/* Time */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Time spent <span style={{ color: '#a32d2d' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#888780', marginBottom: '4px' }}>Hours</div>
                <select value={form.hours} onChange={e => setField('hours', e.target.value)} style={inputStyle}>
                  {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#888780', marginBottom: '4px' }}>Minutes</div>
                <select value={form.minutes} onChange={e => setField('minutes', e.target.value)} style={inputStyle}>
                  <option value={0}>00</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#888780', marginBottom: '4px' }}>Total</div>
                <div style={{ padding: '8px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#f1efe8', fontWeight: '500' }}>
                  {totalHours.toFixed(2)} hrs
                </div>
              </div>
            </div>
          </div>

          {/* Billable toggle */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Billable status <span style={{ color: '#a32d2d' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setField('billable', true)}
                style={{
                  padding: '10px',
                  border: '0.5px solid',
                  borderColor: form.billable ? '#0C447C' : '#b4b2a9',
                  background: form.billable ? '#E6F1FB' : '#fff',
                  color: form.billable ? '#0C447C' : '#5f5e5a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ✓ Billable
              </button>
              <button
                type="button"
                onClick={() => setField('billable', false)}
                style={{
                  padding: '10px',
                  border: '0.5px solid',
                  borderColor: !form.billable ? '#A32D2D' : '#b4b2a9',
                  background: !form.billable ? '#FCEBEB' : '#fff',
                  color: !form.billable ? '#A32D2D' : '#5f5e5a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                — Non-billable
              </button>
            </div>
            {!form.billable && (
              <div style={{ marginTop: '6px', padding: '8px 10px', background: '#FEF5F5', border: '0.5px solid #F5D4D4', borderRadius: '6px', fontSize: '12px', color: '#633806' }}>
                This time will track productivity but won't appear on invoices.
              </div>
            )}
          </div>

          {/* Computed amount preview */}
          {selectedCase && totalHours > 0 && (
            <div style={{ background: '#f1efe8', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#5f5e5a' }}>
              {selectedCase.case_category === 'private' && selectedCase.private_hourly_rate
                ? <>Computed amount: <strong style={{ color: '#2c2c2a' }}>${(totalHours * selectedCase.private_hourly_rate).toFixed(2)}</strong> @ ${selectedCase.private_hourly_rate}/hr</>
                : <>Rate will be pulled from the rate table (attorney × association) after approval.</>
              }
            </div>
          )}

          {/* Expenses section */}
          <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #d3d1c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <label style={labelStyle}>Associated expenses (optional)</label>
              <button
                type="button"
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
              >
                {showExpenseForm ? '− Hide' : '+ Add expense'}
              </button>
            </div>

            {showExpenseForm && (
              <div style={{ background: '#f1efe8', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Title <span style={{ color: '#a32d2d' }}>*</span></label>
                  <input type="text" value={expenseForm.title} onChange={e => setExpenseField('title', e.target.value)}
                    placeholder="e.g. Court filing fee, mileage..." style={inputStyle} />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Category <span style={{ color: '#a32d2d' }}>*</span></label>
                  <select value={expenseForm.category} onChange={e => setExpenseField('category', e.target.value)} style={inputStyle}>
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Amount <span style={{ color: '#a32d2d' }}>*</span></label>
                    <input type="number" value={expenseForm.amount} onChange={e => setExpenseField('amount', e.target.value)}
                      placeholder="0.00" step="0.01" min="0" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Date <span style={{ color: '#a32d2d' }}>*</span></label>
                    <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseField('expense_date', e.target.value)} style={inputStyle} />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={expenseForm.notes} onChange={e => setExpenseField('notes', e.target.value)}
                    placeholder="Additional details..." rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: '50px' }} />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Billable <span style={{ color: '#a32d2d' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setExpenseField('billable', true)}
                      style={{
                        padding: '8px',
                        border: '0.5px solid',
                        borderColor: expenseForm.billable ? '#0C447C' : '#b4b2a9',
                        background: expenseForm.billable ? '#E6F1FB' : '#fff',
                        color: expenseForm.billable ? '#0C447C' : '#5f5e5a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Billable
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseField('billable', false)}
                      style={{
                        padding: '8px',
                        border: '0.5px solid',
                        borderColor: !expenseForm.billable ? '#A32D2D' : '#b4b2a9',
                        background: !expenseForm.billable ? '#FCEBEB' : '#fff',
                        color: !expenseForm.billable ? '#A32D2D' : '#5f5e5a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                      }}
                    >
                      — Non-billable
                    </button>
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Receipt / Proof (optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '8px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}
                    >
                      {expenseFile ? `✓ ${expenseFile.name}` : 'Choose file'}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" onChange={handleExpenseFileSelect} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>Max 10MB (PDF, DOC, JPG, PNG)</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleAddExpense}
                    disabled={uploadingExpense}
                    style={{ padding: '8px 12px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '12px', fontWeight: '500', cursor: uploadingExpense ? 'not-allowed' : 'pointer', opacity: uploadingExpense ? 0.6 : 1 }}
                  >
                    {uploadingExpense ? 'Uploading...' : 'Add expense'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExpenseForm(false); setExpenseFile(null) }}
                    style={{ padding: '8px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#888780', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expenses list */}
            {expenses.length > 0 && (
              <div style={{ background: '#faf9f7', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                {expenses.map((exp, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '9px', background: '#fff', borderRadius: '6px', marginBottom: idx < expenses.length - 1 ? '8px' : '0px', border: '0.5px solid #e8e6df' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c2c2a' }}>{exp.title}</div>
                      <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                        {exp.category} • ${exp.amount.toFixed(2)} • {new Date(exp.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {!exp.billable && <span style={{ color: '#791F1F', marginLeft: '8px' }}>• Non-billable</span>}
                        {exp.file_name && <span style={{ color: '#185FA5', marginLeft: '8px' }}>• 📎 {exp.file_name}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExpense(idx)}
                      style={{ background: 'none', border: 'none', color: '#888780', cursor: 'pointer', fontSize: '16px', padding: '2px 8px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        <FormStatusMessage message={error} />
        <FormActions onCancel={onClose} saving={saving} saveLabel="Save timeslip" />
      </form>
    </FormModal>
  )
}

// ─── TIMESHEETS MAIN ──────────────────────────────────────────
export default function Timesheets({ staff }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [attyFilter, setAttyFilter] = useState('all')
  const [attorneys, setAttorneys] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [selected, setSelected] = useState([])
  const [notice, setNotice] = useState(null)

  const isAdmin = staff?.role === 'admin'

  useEffect(() => {
    fetchEntries()
    if (isAdmin) fetchAttorneys()
  }, [])

  async function fetchAttorneys() {
    const { data } = await supabase.from('staff').select('*').eq('role', 'attorney').eq('active', true).order('full_name')
    setAttorneys(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        staff:attorney_id(full_name, initials),
        cases(sb_number, brief_description, clients(first_name, last_name))
      `)
      .order('entry_date', { ascending: false })

    if (!isAdmin) query = query.eq('attorney_id', staff?.id)

    const { data } = await query
    setEntries(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('time_entries').update({
      status,
      approved_by: status === 'approved' ? staff?.id : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    }).eq('id', id)
    if (error) {
      setNotice({ type: 'error', message: `Unable to update timeslip: ${error.message}` })
      return
    }
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    setNotice({ type: 'success', message: `Timeslip marked as ${status}.` })
  }

  async function bulkApprove() {
    for (const id of selected) await updateStatus(id, 'approved')
    setSelected([])
  }

  async function bulkFlag() {
    for (const id of selected) await updateStatus(id, 'review')
    setSelected([])
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    const visibleIds = filtered.map(e => e.id)
    if (selected.length === visibleIds.length) setSelected([])
    else setSelected(visibleIds)
  }

  const filtered = entries.filter(e => {
    const matchQ = matchesSearch(getTimeslipSearchValues(e), search)
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchAtty = attyFilter === 'all' || e.attorney_id === attyFilter
    return matchQ && matchStatus && matchAtty
  })

  const totalHrs = filtered.reduce((s, e) => s + (e.hours || 0), 0)
  const totalAmt = filtered.reduce((s, e) => s + (e.computed_amount || 0), 0)

  const statusBadge = (status) => {
    const styles = {
      pending: { background: '#faeeda', color: '#633806' },
      approved: { background: '#eaf3de', color: '#27500a' },
      review: { background: '#EEEDFE', color: '#3C3489' },
      billed: { background: '#E1F5EE', color: '#085041' },
    }
    const labels = { pending: 'Pending', approved: 'Approved', review: 'Need review', billed: 'Billed' }
    return (
      <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
        {labels[status] || status}
      </span>
    )
  }

  const canEdit = (entry) => {
    if (isAdmin) return false // admin approves, doesn't edit
    return entry.attorney_id === staff?.id && ['pending', 'review'].includes(entry.status)
  }

  const formatDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <PageNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Timesheets</div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>
            {isAdmin ? 'Admin view — approve and review all entries' : 'Your time entries'}
          </div>
        </div>
        <button onClick={() => { setEditEntry(null); setShowForm(true) }}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v10M3 8h10"/></svg>
          New timeslip
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px', marginBottom: '1rem' }}>
        {[
          { label: isAdmin ? 'Total hours' : 'My hours', value: `${filtered.reduce((s,e)=>s+e.hours,0).toFixed(1)} hrs` },
          { label: 'Pending', value: entries.filter(e=>e.status==='pending').length },
          { label: 'Need review', value: entries.filter(e=>e.status==='review').length },
          { label: 'Billed', value: entries.filter(e=>e.status==='billed').length },
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
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search case, client, description..."
              style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '180px', color: '#2c2c2a' }} />
          </div>

          {isAdmin && (
            <select value={attyFilter} onChange={e => setAttyFilter(e.target.value)}
              style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a' }}>
              <option value="all">All attorneys</option>
              {attorneys.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}

          {['all', 'pending', 'approved', 'review', 'billed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: statusFilter === s ? '#0C447C' : '#d3d1c7', background: statusFilter === s ? '#0C447C' : '#fff', color: statusFilter === s ? '#fff' : '#5f5e5a' }}>
              {s === 'all' ? 'All' : s === 'review' ? 'Need review' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}

          <span style={{ fontSize: '12px', color: '#888780', marginLeft: 'auto' }}>{filtered.length} entries</span>
        </div>

        {/* Bulk actions bar */}
        {isAdmin && selected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: '#E6F1FB', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '13px', color: '#0C447C' }}>
            <span>{selected.length} selected</span>
            <div style={{ width: '1px', height: '16px', background: '#B5D4F4' }} />
            <button onClick={bulkApprove} style={{ padding: '3px 12px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Approve all</button>
            <button onClick={bulkFlag} style={{ padding: '3px 12px', border: 'none', borderRadius: '6px', background: '#faeeda', color: '#633806', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Flag for review</button>
            <button onClick={() => setSelected([])} style={{ padding: '3px 12px', border: '0.5px solid #B5D4F4', borderRadius: '6px', background: '#fff', color: '#185FA5', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading timesheets...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>No time entries found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: '32px', padding: '7px 8px', borderBottom: '0.5px solid #d3d1c7' }}>
                      <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll} style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                    </th>
                  )}
                  {['Date', 'Attorney', 'Case', 'Description', 'Hours', 'Rate', 'Amount', 'Billable', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr key={entry.id}
                    style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#faf9f7'}
                  >
                    {isAdmin && (
                      <td style={{ padding: '9px 8px', borderBottom: '0.5px solid #f1efe8' }}>
                        <input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggleSelect(entry.id)}
                          style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                      </td>
                    )}
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap', color: '#888780' }}>{formatDate(entry.entry_date)}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                        {entry.staff?.initials}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                      <div style={{ fontWeight: '500', color: '#185FA5', fontSize: '13px' }}>{entry.cases?.sb_number}</div>
                      <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>{entry.cases?.clients?.last_name}, {entry.cases?.clients?.first_name}</div>
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#5f5e5a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500' }}>{entry.hours?.toFixed(1)}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#888780', whiteSpace: 'nowrap' }}>
                      {entry.computed_amount && entry.hours ? `$${(entry.computed_amount / entry.hours).toFixed(0)}/hr` : '—'}
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500' }}>
                      {entry.computed_amount ? `$${entry.computed_amount.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontSize: '12px' }}>
                      {entry.billable !== false ? (
                        <span style={{ background: '#eaf3de', color: '#27500a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                          Billable
                        </span>
                      ) : (
                        <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                          Non-billable
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>{statusBadge(entry.status)}</td>
                    <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {/* Admin actions */}
                        {isAdmin && entry.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(entry.id, 'approved')}
                              style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                              Approve
                            </button>
                            <button onClick={() => updateStatus(entry.id, 'review')}
                              style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#faeeda', color: '#633806', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                              Flag
                            </button>
                          </>
                        )}
                        {isAdmin && entry.status === 'review' && (
                          <>
                            <button onClick={() => updateStatus(entry.id, 'approved')}
                              style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                              Approve
                            </button>
                            <button onClick={() => updateStatus(entry.id, 'pending')}
                              style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#fcebeb', color: '#791F1F', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                              Reject
                            </button>
                          </>
                        )}
                        {isAdmin && entry.status === 'approved' && (
                          <button onClick={() => updateStatus(entry.id, 'review')}
                            style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#888780', fontSize: '11px', cursor: 'pointer' }}>
                            Flag
                          </button>
                        )}
                        {isAdmin && entry.status === 'billed' && (
                          <span style={{ fontSize: '11px', color: '#b4b2a9' }}>Billed — locked</span>
                        )}
                        {/* Attorney actions */}
                        {canEdit(entry) && (
                          <button onClick={() => { setEditEntry(entry); setShowForm(true) }}
                            style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>
                            Edit
                          </button>
                        )}
                        {!isAdmin && ['approved', 'billed'].includes(entry.status) && (
                          <span style={{ fontSize: '11px', color: '#b4b2a9' }}>Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: '#f1efe8' }}>
                  {isAdmin && <td />}
                  <td colSpan={4} style={{ padding: '9px 10px', fontSize: '12px', fontWeight: '500', color: '#888780', textAlign: 'right' }}>
                    Total ({filtered.length} entries)
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{totalHrs.toFixed(1)} hrs</td>
                  <td />
                  <td style={{ padding: '9px 10px', fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>
                    {totalAmt > 0 ? `$${totalAmt.toFixed(2)}` : '—'}
                  </td>
                  <td />
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <TimeslipForm
          staff={staff}
          editEntry={editEntry}
          onClose={() => { setShowForm(false); setEditEntry(null) }}
          onSaved={(saved, wasEdit) => {
            if (wasEdit) {
              setEntries(prev => prev.map(e => e.id === saved.id ? saved : e))
              setNotice({ type: 'success', message: 'Timeslip saved successfully.' })
            } else {
              setEntries(prev => [saved, ...prev])
              setNotice({ type: 'success', message: 'Timeslip created successfully.' })
            }
            setShowForm(false)
            setEditEntry(null)
          }}
        />
      )}
    </div>
  )
}
