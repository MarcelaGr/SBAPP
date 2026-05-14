import { useEffect, useMemo, useState } from 'react'
import logoImage from '../assets/logo.png'
import { supabase } from '../supabaseClient'
import { matchesSearch } from '../lib/search'
import { normalizeSbNumber } from '../lib/sb'

export default function Billing({ staff }) {
  const [invoiceRuns, setInvoiceRuns] = useState([])
  const [invoices, setInvoices] = useState([])
  const [associations, setAssociations] = useState([])
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [assocFilter, setAssocFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('association')
  const [expandedRuns, setExpandedRuns] = useState({})
  const [selected, setSelected] = useState([])
  const [previewInvoice, setPreviewInvoice] = useState(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState(null)
  const [deletingInvoice, setDeletingInvoice] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createError, setCreateError] = useState('')
  const [pageError, setPageError] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [savingSbNumber, setSavingSbNumber] = useState(false)
  const [showNonBillableItems, setShowNonBillableItems] = useState(false)
  const [createForm, setCreateForm] = useState(getDefaultCreateForm())
  const [firmInfo] = useState({
    name: 'Stone Busailah LLP',
    address: '100 N. Garfield Ave., Suite N210',
    city: 'Pasadena, CA 91101',
    phone: '(626) 555-0100',
    email: 'billing@stonebusailah.com',
    website: 'stonebusailah.com',
  })

  useEffect(() => {
    fetchAssociations()
    fetchCases()
    fetchInvoices()
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    const channel = supabase
      .channel(`invoices:${selectedMonth}:${selectedYear}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedMonth, selectedYear])

  function getDefaultCreateForm() {
    const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
    const dueDate = new Date(selectedYear, selectedMonth, 15).toISOString().split('T')[0]
    const invoiceDate = new Date().toISOString().split('T')[0]

    return {
      targetType: 'case',
      caseId: '',
      caseQuery: '',
      associationId: '',
      invoiceNumber: '',
      invoiceDate,
      startDate,
      endDate,
      dueDate,
    }
  }

  async function fetchAssociations() {
    const { data, error } = await supabase.from('associations').select('*').eq('active', true).order('short_name')
    if (error) {
      setPageError(error.message)
      return
    }
    setAssociations(data || [])
  }

  async function fetchCases() {
    const { data, error } = await supabase
      .from('cases')
      .select(`
        id, sb_number, brief_description, client_id, association_id, case_category, status,
        clients(first_name, last_name),
        associations(short_name, name)
      `)
      .order('sb_number', { ascending: true })

    if (error) {
      setPageError(error.message)
      return
    }

    setCases(data || [])
  }

  async function fetchInvoices() {
    setLoading(true)
    setPageError('')

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          cases(id, sb_number, brief_description, association_case_number,
            clients(first_name, last_name),
            case_attorneys(is_lead, staff(full_name, initials)),
            time_entries(id, entry_date, hours, description, computed_amount, status, billable, staff:attorney_id(full_name, initials), time_entry_expenses(id, title, amount, billable, expense_date)),
            case_expenses(id, expense_date, title, amount, billable)
          ),
          associations(id, short_name, name, billing_contact_name, billing_contact_email, address_street, address_city_state_zip),
          invoice_runs(id, period_month, period_year, association_id, associations(short_name, name))
        `)
        .eq('period_month', selectedMonth)
        .eq('period_year', selectedYear)
        .order('invoice_number', { ascending: true, nullsFirst: false })

      if (error) throw error

      setInvoices(data || [])

      const runsMap = {}
      data?.forEach(inv => {
        if (inv.invoice_runs?.id) runsMap[inv.invoice_runs.id] = inv.invoice_runs
      })
      const runs = Object.values(runsMap)
      setInvoiceRuns(runs)
      const expanded = {}
      runs.forEach(r => { expanded[r.id] = true })
      setExpandedRuns(expanded)
    } catch (error) {
      console.error('Failed to load invoices:', error)
      setPageError(error.message || 'Could not load invoices.')
      setInvoices([])
      setInvoiceRuns([])
      setExpandedRuns({})
    } finally {
      setLoading(false)
    }
  }

  async function updateInvoiceStatus(id, status) {
    await supabase.from('invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString().split('T')[0] : null }).eq('id', id)
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv))
  }

  async function deleteInvoice() {
    if (!invoiceToDelete) return

    setDeletingInvoice(true)
    setPageError('')

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceToDelete.id)

    if (error) {
      setPageError(`Could not delete invoice: ${error.message}`)
      setDeletingInvoice(false)
      return
    }

    setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id))
    setSelected(prev => prev.filter(id => id !== invoiceToDelete.id))
    setPreviewInvoice(prev => prev?.id === invoiceToDelete.id ? null : prev)
    setInvoiceToDelete(null)
    setDeletingInvoice(false)
    fetchInvoices()
  }

  async function bulkUpdateStatus(status) {
    for (const id of selected) await updateInvoiceStatus(id, status)
    setSelected([])
  }

  function toggleExpand(runId) { setExpandedRuns(prev => ({ ...prev, [runId]: !prev[runId] })) }
  function toggleSelect(id) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function toggleSelectAll(ids) {
    const allSelected = ids.every(id => selected.includes(id))
    if (allSelected) setSelected(prev => prev.filter(id => !ids.includes(id)))
    else setSelected(prev => [...new Set([...prev, ...ids])])
  }

  function setCreateField(key, value) {
    setCreateForm(prev => ({ ...prev, [key]: value }))
  }

  function openCreateForm() {
    setCreateError('')
    setCreateForm(getDefaultCreateForm())
    setShowCreateForm(true)
  }

  async function ensureInvoiceRun(periodMonth, periodYear, associationId) {
    const existingRunQuery = supabase
      .from('invoice_runs')
      .select('id')
      .eq('period_month', periodMonth)
      .eq('period_year', periodYear)

    const runLookup = associationId
      ? existingRunQuery.eq('association_id', associationId)
      : existingRunQuery.is('association_id', null)

    const { data: existingRun, error: existingRunError } = await runLookup.maybeSingle()
    if (existingRunError) throw existingRunError
    if (existingRun) return existingRun

    const { data: insertedRun, error: runInsertError } = await supabase
      .from('invoice_runs')
      .insert({
        period_month: periodMonth,
        period_year: periodYear,
        association_id: associationId,
        generated_by: staff?.id,
      })
      .select('id')
      .single()

    if (runInsertError) throw runInsertError
    return insertedRun
  }

  function sumApprovedEntriesInRange(entries, startDate, endDate) {
    return (entries || [])
      .filter(entry => entry.status === 'approved' && entry.billable !== false && entry.entry_date >= startDate && entry.entry_date <= endDate)
      .reduce((sum, entry) => sum + (entry.computed_amount || 0), 0)
  }

  function sumBillableExpensesInRange(expenses, startDate, endDate) {
    return (expenses || [])
      .filter(expense => expense.billable && expense.expense_date >= startDate && expense.expense_date <= endDate)
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  }

  function sumTimeEntryExpensesInRange(entries, startDate, endDate) {
    return (entries || [])
      .filter(entry => entry.status === 'approved' && entry.billable !== false && entry.entry_date >= startDate && entry.entry_date <= endDate)
      .flatMap(entry => entry.time_entry_expenses || [])
      .filter(expense => expense.billable && expense.expense_date >= startDate && expense.expense_date <= endDate)
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  }

  async function handleCreateInvoice(e) {
    e.preventDefault()
    setCreateError('')

    if (!createForm.startDate || !createForm.endDate) {
      setCreateError('Please choose a start date and end date.')
      return
    }
    if (createForm.startDate > createForm.endDate) {
      setCreateError('The start date must be before the end date.')
      return
    }
    if (createForm.targetType === 'case' && !createForm.caseId) {
      setCreateError('Please select a case.')
      return
    }
    if (createForm.targetType === 'association' && !createForm.associationId) {
      setCreateError('Please select an association.')
      return
    }

    setCreatingInvoice(true)

    try {
      const periodDate = new Date(`${createForm.endDate}T00:00:00`)
      const periodMonth = periodDate.getMonth() + 1
      const periodYear = periodDate.getFullYear()

      if (createForm.targetType === 'case') {
        const { data: selectedCase, error: caseError } = await supabase
          .from('cases')
          .select(`
            id, sb_number, client_id, association_id, case_category,
            time_entries(entry_date, computed_amount, status, billable, time_entry_expenses(expense_date, amount, billable)),
            case_expenses(expense_date, amount, billable)
          `)
          .eq('id', createForm.caseId)
          .single()

        if (caseError) throw caseError

        const associationId = selectedCase.case_category === 'private' ? null : (selectedCase.association_id || null)
        const run = await ensureInvoiceRun(periodMonth, periodYear, associationId)

        const selectedCaseSb = normalizeSbNumber(selectedCase.sb_number)

        const { data: existingInvoice, error: existingInvoiceError } = await supabase
          .from('invoices')
          .select('id, case_id')
          .eq('period_month', periodMonth)
          .eq('period_year', periodYear)
          .eq('invoice_kind', 'case')
          .in('case_id', [selectedCase.id])
          .maybeSingle()

        if (existingInvoiceError) throw existingInvoiceError
        if (existingInvoice) {
          setCreateError('An invoice for that case already exists for the selected billing period.')
          setCreatingInvoice(false)
          return
        }

        if (selectedCaseSb) {
          const { data: duplicateBySb } = await supabase
            .from('invoices')
            .select('id, cases!inner(sb_number)')
            .eq('period_month', periodMonth)
            .eq('period_year', periodYear)
            .eq('invoice_kind', 'case')
            .eq('cases.sb_number', selectedCaseSb)
            .maybeSingle()

          if (duplicateBySb) {
            setCreateError('An invoice for that SB number already exists for the selected billing period.')
            setCreatingInvoice(false)
            return
          }
        }

        const subtotal =
          sumApprovedEntriesInRange(selectedCase.time_entries, createForm.startDate, createForm.endDate) +
          sumBillableExpensesInRange(selectedCase.case_expenses, createForm.startDate, createForm.endDate) +
          sumTimeEntryExpensesInRange(selectedCase.time_entries, createForm.startDate, createForm.endDate)

        const { error: insertError } = await supabase.from('invoices').insert({
          invoice_run_id: run.id,
          case_id: selectedCase.id,
          client_id: selectedCase.client_id,
          association_id: associationId,
          invoice_number: createForm.invoiceNumber.trim() || null,
          invoice_kind: 'case',
          period_month: periodMonth,
          period_year: periodYear,
          subtotal,
          total_due: subtotal,
          status: 'draft',
          issued_at: createForm.invoiceDate,
          due_at: createForm.dueDate,
        })

        if (insertError) throw insertError
      } else {
        const { data: associationCases, error: associationCasesError } = await supabase
          .from('cases')
          .select('id, client_id, time_entries(entry_date, computed_amount, status, billable, time_entry_expenses(expense_date, amount, billable)), case_expenses(expense_date, amount, billable)')
          .eq('association_id', createForm.associationId)
          .eq('case_category', 'association')

        if (associationCasesError) throw associationCasesError
        if (!associationCases || associationCases.length === 0) {
          setCreateError('No association cases were found for that association.')
          setCreatingInvoice(false)
          return
        }

        const run = await ensureInvoiceRun(periodMonth, periodYear, createForm.associationId)

        const { data: existingSummary, error: existingSummaryError } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_run_id', run.id)
          .eq('invoice_kind', 'association_summary')
          .maybeSingle()

        if (existingSummaryError) throw existingSummaryError
        if (existingSummary) {
          setCreateError('An association invoice already exists for the selected billing period.')
          setCreatingInvoice(false)
          return
        }

        const subtotal = associationCases.reduce(
          (sum, currentCase) => sum +
            sumApprovedEntriesInRange(currentCase.time_entries, createForm.startDate, createForm.endDate) +
            sumBillableExpensesInRange(currentCase.case_expenses, createForm.startDate, createForm.endDate) +
            sumTimeEntryExpensesInRange(currentCase.time_entries, createForm.startDate, createForm.endDate),
          0
        )

        const { error: insertError } = await supabase.from('invoices').insert({
          invoice_run_id: run.id,
          case_id: associationCases[0].id,
          client_id: associationCases[0].client_id,
          association_id: createForm.associationId,
          invoice_number: createForm.invoiceNumber.trim() || null,
          invoice_kind: 'association_summary',
          period_month: periodMonth,
          period_year: periodYear,
          subtotal,
          total_due: subtotal,
          status: 'draft',
          issued_at: createForm.invoiceDate,
          due_at: createForm.dueDate,
        })

        if (insertError) throw insertError
      }

      setShowCreateForm(false)
      await fetchInvoices()
      alert('Invoice created.')
    } catch (error) {
      console.error('Failed to create invoice:', error)
      setCreateError(error.message || 'Could not create invoice.')
    } finally {
      setCreatingInvoice(false)
    }
  }

  function printInvoice(inv) {
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })
    const win = window.open('', '_blank')
    if (!win) {
      alert('Your browser blocked the invoice print window. Please allow pop-ups for this site and try again.')
      return
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${inv.invoice_number} — Stone Busailah LLP</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:2cm;color:#222}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:1rem;border-bottom:3px solid #0C447C;margin-bottom:1.5rem}
      .brand{max-width:320px}
      .brand-logo{display:block;width:140px;max-width:100%;height:auto;margin:0 0 10px 0}
      .firm-name{font-size:20px;font-weight:bold;color:#0C447C}
      .firm-sub{font-size:11px;color:#666;margin-top:4px;line-height:1.6}
      .inv-meta{text-align:right;font-size:12px;color:#444;line-height:1.8}
      .inv-no{font-size:16px;font-weight:bold;color:#0C447C}
      .parties{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-bottom:1.5rem}
      .party-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;margin-bottom:4px}
      .party-val{font-size:12px;color:#222;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin-bottom:1rem}
      th{text-align:left;padding:7px 8px;background:#0C447C;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      td{padding:6px 8px;border-bottom:.5px solid #e0e0e0;vertical-align:top}
      tr:nth-child(even) td{background:#f7f7f7}
      .totals{margin-left:auto;width:260px;margin-top:1rem}
      .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:.5px solid #e0e0e0}
      .grand{font-weight:bold;font-size:14px;color:#0C447C;border-top:2px solid #0C447C;padding-top:8px;margin-top:4px;border-bottom:none}
      .footer{margin-top:2rem;padding-top:1rem;border-top:.5px solid #ccc;font-size:10px;color:#888;text-align:center}
    </style></head><body>
    <div class="header">
      <div class="brand">${logoImage ? `<img src="${logoImage}" alt="Stone Busailah LLP" class="brand-logo" />` : ''}<div class="firm-name">${firmInfo.name}</div><div class="firm-sub">${firmInfo.address}<br>${firmInfo.city}<br>Tel: ${firmInfo.phone} · ${firmInfo.website}</div></div>
      <div class="inv-meta"><div class="inv-no">${inv.invoice_number}</div><div>Date: ${inv.issued_at || new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div>Period: ${monthName} ${selectedYear}</div><div>Due: ${inv.due_at||''}</div></div>
    </div>
    <div class="parties">
      <div><div class="party-label">Billed to</div><div class="party-val"><strong>${inv.associations?.name||'Private Client'}</strong><br>${inv.associations?.billing_contact_name||''}<br>${inv.associations?.address_street||''}<br>${inv.associations?.address_city_state_zip||''}</div></div>
      <div><div class="party-label">Re: Client / Matter</div><div class="party-val">${inv.cases?.clients?`${inv.cases.clients.first_name} ${inv.cases.clients.last_name}<br>`:''} SB File No.: <strong>${inv.cases?.sb_number||'—'}</strong>${inv.cases?.association_case_number?`<br>Assoc. Case No.: <strong>${inv.cases.association_case_number}</strong>`:''}<br>Matter: ${inv.cases?.brief_description||'—'}</div></div>
    </div>
    <table><thead><tr><th>Date</th><th>Attorney</th><th>Description</th><th style="text-align:right">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody><tr><td colspan="6" style="color:#888;font-style:italic;text-align:center;padding:1rem">Time entries from approved timesheets will appear here.</td></tr></tbody></table>
    <div class="totals">
      <div class="total-row"><span>Subtotal (${monthName} ${selectedYear})</span><span>$${(inv.subtotal||0).toFixed(2)}</span></div>
      <div class="total-row"><span>Previous balance</span><span>$${(inv.previous_balance||0).toFixed(2)}</span></div>
      <div class="total-row"><span>Deposit applied</span><span>${inv.deposit_applied?'$'+inv.deposit_applied.toFixed(2):'—'}</span></div>
      <div class="total-row grand"><span>Total due</span><span>$${(inv.total_due||0).toFixed(2)}</span></div>
    </div>
    <div class="footer">Please remit payment within 15 days. Make checks payable to ${firmInfo.name}.<br>Questions? Contact ${firmInfo.email} · ${firmInfo.phone}</div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  function printBulk(ids) { invoices.filter(inv => ids.includes(inv.id)).forEach(inv => printInvoice(inv)) }

  async function updateInvoiceSbNumber(invoice, nextSbNumber) {
    const normalized = normalizeSbNumber(nextSbNumber)
    if (!invoice?.cases?.id || !normalized) return

    setSavingSbNumber(true)
    const { error } = await supabase.from('cases').update({ sb_number: normalized }).eq('id', invoice.cases.id)

    if (error) {
      setPageError(error.message)
      setSavingSbNumber(false)
      return
    }

    setInvoices(prev =>
      prev.map(item =>
        item.cases?.id === invoice.cases.id
          ? { ...item, cases: { ...item.cases, sb_number: normalized } }
          : item
      )
    )
    setCases(prev => prev.map(item => item.id === invoice.cases.id ? { ...item, sb_number: normalized } : item))
    setPreviewInvoice(prev => prev?.id === invoice.id ? { ...prev, cases: { ...prev.cases, sb_number: normalized } } : prev)
    setSavingSbNumber(false)
  }

  const statusBadge = (status) => {
    const styles = {
      draft: { background: '#F1EFE8', color: '#6b6a65', border: '1px solid #d3d1c7', dot: '#a8a5a0' },
      sent:  { background: '#E6F1FB', color: '#0C447C', border: '1px solid #B5D4F4', dot: '#378ADD' },
      paid:  { background: '#EAF3DE', color: '#27500a', border: '1px solid #b3d98a', dot: '#4CAF50' },
    }
    const s = styles[status] || styles.draft
    return (
      <span style={{ ...s, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    )
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const years = [2024, 2025, 2026, 2027]

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesAssoc = assocFilter === 'all' || invoice.associations?.short_name === assocFilter || (assocFilter === 'private' && !invoice.association_id)
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
      const matchesText = matchesSearch(
        [
          invoice.invoice_number,
          invoice.cases?.sb_number,
          invoice.cases?.clients?.first_name,
          invoice.cases?.clients?.last_name,
          invoice.cases?.brief_description,
          invoice.associations?.short_name,
          invoice.associations?.name,
        ],
        invoiceSearch
      )

      return matchesAssoc && matchesStatus && matchesText
    })
  }, [assocFilter, invoiceSearch, invoices, statusFilter])

  // Grouped by run for association view
  const filteredRuns = invoiceRuns.filter(run => {
    if (assocFilter === 'all') return true
    if (assocFilter === 'private') return !run.association_id
    return run.associations?.short_name === assocFilter
  })

  // Flat list for case view
  const caseInvoices = filteredInvoices
    .filter(inv => inv.invoice_kind === 'case')
    .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
    .filter(inv => assocFilter === 'all' || inv.associations?.short_name === assocFilter || (assocFilter === 'private' && !inv.association_id))

  const totalInvoiced = filteredInvoices.filter(i => i.invoice_kind === 'case').reduce((s, i) => s + (i.total_due || 0), 0)
  const totalPaid = filteredInvoices.filter(i => i.invoice_kind === 'case' && i.status === 'paid').reduce((s, i) => s + (i.total_due || 0), 0)

  return (
    <div style={{ padding: '1.75rem 2rem', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", maxWidth: '1400px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5h6M5 11h4"/>
              </svg>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a18', letterSpacing: '-0.3px' }}>Billing</div>
          </div>
          <div style={{ fontSize: '13px', color: '#888780', marginLeft: '42px' }}>Invoices — monthly billing runs</div>
          <div style={{ display: 'flex', gap: '6px', marginLeft: '42px', marginTop: '10px' }}>
            <button
              type="button"
              style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: '#0C447C', color: '#fff', fontSize: '12px', fontWeight: '500', cursor: 'default' }}
            >
              Invoices
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={openCreateForm}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 2px 8px rgba(12,68,124,0.28)', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(12,68,124,0.38)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(12,68,124,0.28)'}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 3v10M3 8h10"/></svg>
            New invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        {[
          { label: `Invoiced`, sub: `${months[selectedMonth-1]} ${selectedYear}`, value: `$${totalInvoiced.toFixed(2)}`, icon: '💰', accent: '#0C447C', bg: '#E6F1FB' },
          { label: 'Outstanding', sub: 'Unpaid balance', value: `$${(totalInvoiced - totalPaid).toFixed(2)}`, icon: '⏳', accent: '#91540a', bg: '#FEF3E2' },
          { label: 'Paid', sub: 'This period', value: `$${totalPaid.toFixed(2)}`, icon: '✅', accent: '#27500a', bg: '#EAF3DE' },
          { label: 'Total invoices', sub: 'This month', value: invoices.filter(i => i.invoice_kind === 'case').length, icon: '🧾', accent: '#5f5e5a', bg: '#F1EFE8' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '1.1rem 1.25rem', border: '1px solid #e8e6e0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: s.bg, borderRadius: '12px 12px 0 0' }} />
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '11px', color: '#b4b2a9', marginBottom: '10px' }}>{s.sub}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: s.accent, letterSpacing: '-0.5px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8f7f5', border: '1px solid #e8e6e0', borderRadius: '10px', padding: '7px 12px', minWidth: '220px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#aaa8a0" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>
            <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Search SB no., client, invoice…"
              style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '190px', color: '#2c2c2a' }} />
          </div>

          {/* Month / Year */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
            style={{ fontSize: '13px', padding: '7px 10px', border: '1px solid #e8e6e0', borderRadius: '10px', background: '#fff', color: '#2c2c2a', cursor: 'pointer', outline: 'none' }}>
            {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
            style={{ fontSize: '13px', padding: '7px 10px', border: '1px solid #e8e6e0', borderRadius: '10px', background: '#fff', color: '#2c2c2a', cursor: 'pointer', outline: 'none' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div style={{ width: '1px', height: '24px', background: '#e8e6e0' }} />

          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: '2px', background: '#f1efe8', borderRadius: '10px', padding: '3px' }}>
            {[{ key: 'association', label: 'By association' }, { key: 'case', label: 'By case' }].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: 'none', background: viewMode === v.key ? '#0C447C' : 'transparent', color: viewMode === v.key ? '#fff' : '#5f5e5a', transition: 'all 0.15s' }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: '#e8e6e0' }} />

          {/* Association pills */}
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#aaa8a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assoc:</span>
          {['all', ...associations.map(a => a.short_name), 'private'].map(a => (
            <button key={a} onClick={() => setAssocFilter(a)}
              style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '1px solid', borderColor: assocFilter === a ? '#0C447C' : '#e8e6e0', background: assocFilter === a ? '#0C447C' : '#fff', color: assocFilter === a ? '#fff' : '#5f5e5a', transition: 'all 0.15s' }}>
              {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}

          <div style={{ width: '1px', height: '24px', background: '#e8e6e0' }} />

          {/* Status pills */}
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#aaa8a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status:</span>
          {['all', 'draft', 'sent', 'paid'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '1px solid', borderColor: statusFilter === s ? '#185FA5' : '#e8e6e0', background: statusFilter === s ? '#185FA5' : '#fff', color: statusFilter === s ? '#fff' : '#5f5e5a', transition: 'all 0.15s' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 1rem', background: '#E6F1FB', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '13px', color: '#0C447C' }}>
          <span style={{ fontWeight: '500' }}>{selected.length} selected</span>
          <div style={{ width: '1px', height: '16px', background: '#B5D4F4' }} />
          <button onClick={() => printBulk(selected)} style={{ padding: '4px 12px', borderRadius: '6px', background: '#fff', color: '#0C447C', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid #B5D4F4' }}>🖨 Print selected</button>
          <button onClick={() => bulkUpdateStatus('sent')} style={{ padding: '4px 12px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Mark as sent</button>
          <button onClick={() => bulkUpdateStatus('paid')} style={{ padding: '4px 12px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Mark as paid</button>
          <button onClick={() => setSelected([])} style={{ padding: '4px 12px', border: '0.5px solid #B5D4F4', borderRadius: '6px', background: '#fff', color: '#185FA5', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {/* Empty / loading state */}
      {pageError && !loading && (
        <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '12px', padding: '10px 14px', marginBottom: '1rem', color: '#a32d2d', fontSize: '13px' }}>
          {pageError}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888', fontSize: '13px', background: '#fff', borderRadius: '14px', border: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #E6F1FB', borderTopColor: '#0C447C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: '#888780' }}>Loading invoices…</span>
        </div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: '14px', border: '1px solid #e8e6e0' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '24px' }}>🧾</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a18', marginBottom: '6px', letterSpacing: '-0.2px' }}>No invoices for {months[selectedMonth-1]} {selectedYear}</div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '1.5rem' }}>Create a new invoice from an existing case or association.</div>
          <button onClick={openCreateForm}
            style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(12,68,124,0.28)' }}>
            New invoice
          </button>
        </div>
      ) : (
        <>
          {/* ── BY ASSOCIATION VIEW ── */}
          {viewMode === 'association' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredRuns.map(run => {
                const runInvoices = invoices.filter(inv => inv.invoice_runs?.id === run.id && inv.invoice_kind === 'case')
                const summary = invoices.find(inv => inv.invoice_runs?.id === run.id && inv.invoice_kind === 'association_summary')
                const assocName = run.associations?.short_name || 'Private cases'
                const runTotal = runInvoices.reduce((s, inv) => s + (inv.total_due || 0), 0)
                const runIds = runInvoices.map(inv => inv.id)
                const allSelected = runIds.length > 0 && runIds.every(id => selected.includes(id))
                const filteredRunInvoices = statusFilter === 'all' ? runInvoices : runInvoices.filter(inv => inv.status === statusFilter)

                return (
                  <div key={run.id} style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', overflow: 'hidden' }}>

                    {/* Run header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 1.25rem', background: '#f1efe8', cursor: 'pointer', flexWrap: 'wrap', gap: '8px' }}
                      onClick={() => toggleExpand(run.id)}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>{assocName} — {months[selectedMonth-1]} {selectedYear}</div>
                        <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{runInvoices.length} case invoice{runInvoices.length !== 1 ? 's' : ''} · ${runTotal.toFixed(2)} total</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        {runInvoices.filter(i => i.status === 'draft').length > 0 && <span style={{ background: '#f1efe8', color: '#5f5e5a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{runInvoices.filter(i=>i.status==='draft').length} draft</span>}
                        {runInvoices.filter(i => i.status === 'sent').length > 0 && <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{runInvoices.filter(i=>i.status==='sent').length} sent</span>}
                        {runInvoices.filter(i => i.status === 'paid').length > 0 && <span style={{ background: '#eaf3de', color: '#27500a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{runInvoices.filter(i=>i.status==='paid').length} paid</span>}
                        <button onClick={() => printBulk(runIds)} style={{ padding: '5px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}>🖨 Print all</button>
                        <div style={{ fontSize: '14px', color: '#888780' }}>{expandedRuns[run.id] ? '▲' : '▼'}</div>
                      </div>
                    </div>

                    {/* Invoices table */}
                    {expandedRuns[run.id] && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '32px', padding: '7px 10px', borderBottom: '0.5px solid #d3d1c7', textAlign: 'left' }}>
                              <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(runIds)} style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                            </th>
                            {['Invoice no.', 'SB file no.', 'Client', 'Description', 'Amount', 'Balance', 'Status', ''].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRunInvoices.map((inv, idx) => (
                            <tr key={inv.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                              onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#faf9f7'}
                            >
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                                <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggleSelect(inv.id)} style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                              </td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500', color: '#185FA5', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{inv.invoice_number}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#185FA5', fontWeight: '500', whiteSpace: 'nowrap' }}>{inv.cases?.sb_number}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500' }}>{inv.cases?.clients?.last_name}, {inv.cases?.clients?.first_name}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#5f5e5a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.cases?.brief_description || '—'}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500', whiteSpace: 'nowrap' }}>${(inv.subtotal||0).toFixed(2)}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#888780', whiteSpace: 'nowrap' }}>${(inv.total_due||0).toFixed(2)}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>{statusBadge(inv.status)}</td>
                              <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                  <button onClick={() => { setPreviewInvoice(inv); setShowNonBillableItems(false) }} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Preview</button>
                                  <button onClick={() => printInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>🖨</button>
                                  {inv.status === 'draft' && <button onClick={() => updateInvoiceStatus(inv.id, 'sent')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark sent</button>}
                                  {inv.status === 'sent' && <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark paid</button>}
                                  <button onClick={() => setInvoiceToDelete(inv)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Summary row */}
                          {summary && (
                            <tr style={{ background: '#f1efe8' }}>
                              <td style={{ padding: '9px 10px' }} />
                              <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: '12px', color: '#185FA5', fontWeight: '500' }}>{summary.invoice_number}</td>
                              <td colSpan={3} style={{ padding: '9px 10px', fontSize: '12px', fontWeight: '500', color: '#5f5e5a' }}>{assocName} — Summary invoice</td>
                              <td style={{ padding: '9px 10px', fontWeight: '500' }}>${(summary.subtotal||0).toFixed(2)}</td>
                              <td style={{ padding: '9px 10px', color: '#888780' }}>${(summary.total_due||0).toFixed(2)}</td>
                              <td style={{ padding: '9px 10px' }}>{statusBadge(summary.status)}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button onClick={() => setPreviewInvoice(summary)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Preview</button>
                                  <button onClick={() => printInvoice(summary)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>🖨</button>
                                  <button onClick={() => setInvoiceToDelete(summary)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── BY CASE VIEW ── */}
          {viewMode === 'case' && (
            <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 1.25rem', background: '#f1efe8', borderBottom: '0.5px solid #d3d1c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>All case invoices — {months[selectedMonth-1]} {selectedYear}</div>
                <div style={{ fontSize: '12px', color: '#888780' }}>{caseInvoices.length} invoice{caseInvoices.length !== 1 ? 's' : ''}</div>
              </div>
              {caseInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#b4b2a9', fontSize: '13px' }}>No invoices match the current filters.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '32px', padding: '7px 10px', borderBottom: '0.5px solid #d3d1c7', textAlign: 'left' }}>
                        <input type="checkbox"
                          checked={caseInvoices.length > 0 && caseInvoices.every(inv => selected.includes(inv.id))}
                          onChange={() => toggleSelectAll(caseInvoices.map(i => i.id))}
                          style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                      </th>
                      {['Invoice no.', 'SB file no.', 'Client', 'Association', 'Description', 'Amount', 'Status', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {caseInvoices.map((inv, idx) => (
                      <tr key={inv.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#faf9f7'}
                      >
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                          <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggleSelect(inv.id)} style={{ accentColor: '#0C447C', cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500', color: '#185FA5', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#185FA5', fontWeight: '500', whiteSpace: 'nowrap' }}>{inv.cases?.sb_number}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500' }}>{inv.cases?.clients?.last_name}, {inv.cases?.clients?.first_name}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                          {inv.associations?.short_name
                            ? <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{inv.associations.short_name}</span>
                            : <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>Private</span>
                          }
                        </td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', color: '#5f5e5a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.cases?.brief_description || '—'}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', fontWeight: '500', whiteSpace: 'nowrap' }}>${(inv.total_due||0).toFixed(2)}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>{statusBadge(inv.status)}</td>
                        <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button onClick={() => { setPreviewInvoice(inv); setShowNonBillableItems(false) }} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Preview</button>
                            <button onClick={() => printInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>🖨</button>
                            {inv.status === 'draft' && <button onClick={() => updateInvoiceStatus(inv.id, 'sent')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark sent</button>}
                            {inv.status === 'sent' && <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark paid</button>}
                            <button onClick={() => setInvoiceToDelete(inv)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Invoice preview modal */}
      {previewInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px', marginBottom: '2rem', overflow: 'hidden', border: '1px solid #e8e6e0', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid #e8e6e0', background: 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5">
                  <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5h6M5 11h4"/>
                </svg>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Invoice Preview</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>{previewInvoice.invoice_number}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => printInvoice(previewInvoice)} style={{ padding: '6px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', fontSize: '12px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M3 9V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5M5 3V2h6v1"/></svg>
                  Print / PDF
                </button>
                <button onClick={() => setInvoiceToDelete(previewInvoice)} style={{ padding: '6px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', fontSize: '12px', cursor: 'pointer', color: '#fff' }}>
                  Delete
                </button>
                <button onClick={() => setPreviewInvoice(null)} style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '18px', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '3px solid #0C447C' }}>
                <div>
                  {logoImage && <img src={logoImage} alt="Stone Busailah LLP" style={{ display: 'block', width: '160px', maxWidth: '100%', height: 'auto', marginBottom: '12px' }} />}
                  <div style={{ fontSize: '20px', fontWeight: '600', color: '#0C447C', letterSpacing: '-0.3px' }}>{firmInfo.name}</div>
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px', lineHeight: '1.7' }}>{firmInfo.address}<br />{firmInfo.city}<br />Tel: {firmInfo.phone} · {firmInfo.website}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#5f5e5a', lineHeight: '1.8' }}>
                  <div style={{ fontSize: '18px', fontWeight: '500', color: '#0C447C', marginBottom: '4px' }}>{previewInvoice.invoice_number}</div>
                  <div>Date: {previewInvoice.issued_at || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  <div>Period: {months[selectedMonth-1]} {selectedYear}</div>
                  <div>Due: {previewInvoice.due_at}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780', marginBottom: '6px' }}>Billed to</div>
                  <div style={{ fontSize: '13px', color: '#2c2c2a', lineHeight: '1.6' }}>
                    <strong>{previewInvoice.associations?.name || 'Private Client'}</strong>
                    {previewInvoice.associations?.billing_contact_name && <><br />{previewInvoice.associations.billing_contact_name}</>}
                    {previewInvoice.associations?.address_street && <><br />{previewInvoice.associations.address_street}</>}
                    {previewInvoice.associations?.address_city_state_zip && <><br />{previewInvoice.associations.address_city_state_zip}</>}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780', marginBottom: '6px' }}>Re: Client / Matter</div>
                  <div style={{ fontSize: '13px', color: '#2c2c2a', lineHeight: '1.6' }}>
                    {previewInvoice.cases?.clients && <><strong>{previewInvoice.cases.clients.first_name} {previewInvoice.cases.clients.last_name}</strong><br /></>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>SB File No.:</span>
                      <input
                        type="text"
                        value={previewInvoice.cases?.sb_number || ''}
                        onChange={e => setPreviewInvoice(prev => ({ ...prev, cases: { ...prev.cases, sb_number: e.target.value } }))}
                        onBlur={e => updateInvoiceSbNumber(previewInvoice, e.target.value)}
                        disabled={savingSbNumber}
                        style={{ padding: '4px 8px', border: '0.5px solid #d3d1c7', borderRadius: '6px', fontSize: '12px', color: '#185FA5', fontWeight: '600', minWidth: '120px' }}
                      />
                    </div>
                    {previewInvoice.cases?.association_case_number && <><br />Assoc. Case No.: <strong>{previewInvoice.cases.association_case_number}</strong></>}
                    <br />Matter: {previewInvoice.cases?.brief_description || '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #d3d1c7' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#2c2c2a' }}>Line Items</div>
                <button
                  type="button"
                  onClick={() => setShowNonBillableItems(!showNonBillableItems)}
                  style={{ fontSize: '11px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                >
                  {showNonBillableItems ? '− Hide non-billable items' : '+ Show non-billable items'}
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Hours/Qty', 'Rate', 'Billable', 'Amount'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Hours/Qty' || h === 'Rate' || h === 'Amount' ? 'right' : 'left', padding: '7px 8px', background: '#0C447C', color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const approvedTimeEntries = (previewInvoice.cases?.time_entries || [])
                      .filter(entry => entry.status === 'approved' && entry.billable !== false && entry.entry_date >= createForm.startDate && entry.entry_date <= createForm.endDate)
                    const nonBillableTimeEntries = (previewInvoice.cases?.time_entries || [])
                      .filter(entry => entry.status === 'approved' && entry.billable === false && entry.entry_date >= createForm.startDate && entry.entry_date <= createForm.endDate)
                    const billableExpenses = (previewInvoice.cases?.case_expenses || [])
                      .filter(expense => expense.billable && expense.expense_date >= createForm.startDate && expense.expense_date <= createForm.endDate)
                    const nonBillableExpenses = (previewInvoice.cases?.case_expenses || [])
                      .filter(expense => expense.billable === false && expense.expense_date >= createForm.startDate && expense.expense_date <= createForm.endDate)
                    const billableTimeEntryExpenses = approvedTimeEntries.flatMap(entry =>
                      (entry.time_entry_expenses || []).filter(exp => exp.billable && exp.expense_date >= createForm.startDate && exp.expense_date <= createForm.endDate)
                    )
                    const nonBillableTimeEntryExpenses = (previewInvoice.cases?.time_entries || [])
                      .filter(entry => entry.status === 'approved' && entry.entry_date >= createForm.startDate && entry.entry_date <= createForm.endDate)
                      .flatMap(entry =>
                        (entry.time_entry_expenses || []).filter(exp => exp.billable === false && exp.expense_date >= createForm.startDate && exp.expense_date <= createForm.endDate)
                      )
                    
                    const hasAnyItems = approvedTimeEntries.length > 0 || billableExpenses.length > 0 || billableTimeEntryExpenses.length > 0 || (showNonBillableItems && (nonBillableTimeEntries.length > 0 || nonBillableExpenses.length > 0 || nonBillableTimeEntryExpenses.length > 0))

                    if (!hasAnyItems) {
                      return (
                        <tr>
                          <td colSpan={6} style={{ padding: '12px 8px', color: '#888780', fontStyle: 'italic', textAlign: 'center', fontSize: '12px' }}>
                            No billable items for the selected period.
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <>
                        {approvedTimeEntries.map(entry => (
                          <tr key={`time-${entry.id}`} style={{ borderBottom: '0.5px solid #f1efe8' }}>
                            <td style={{ padding: '7px 8px', color: '#888780' }}>
                              {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.description}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c2c2a', fontWeight: '500' }}>{entry.hours?.toFixed(1)}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>
                              {entry.computed_amount && entry.hours ? `$${(entry.computed_amount / entry.hours).toFixed(0)}/hr` : '—'}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              <span style={{ background: '#eaf3de', color: '#27500a', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                Yes
                              </span>
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c2c2a', fontWeight: '500' }}>${(entry.computed_amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {billableExpenses.map(expense => (
                          <tr key={`exp-${expense.id}`} style={{ borderBottom: '0.5px solid #f1efe8' }}>
                            <td style={{ padding: '7px 8px', color: '#888780' }}>
                              {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.title}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              <span style={{ background: '#eaf3de', color: '#27500a', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                Yes
                              </span>
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c2c2a', fontWeight: '500' }}>${(Number(expense.amount) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {billableTimeEntryExpenses.map((expense, idx) => (
                          <tr key={`time-exp-${idx}`} style={{ borderBottom: '0.5px solid #f1efe8' }}>
                            <td style={{ padding: '7px 8px', color: '#888780' }}>
                              {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.title}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              <span style={{ background: '#eaf3de', color: '#27500a', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                Yes
                              </span>
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c2c2a', fontWeight: '500' }}>${(Number(expense.amount) || 0).toFixed(2)}</td>
                          </tr>
                        ))}

                        {/* Non-billable items section */}
                        {showNonBillableItems && (
                          <>
                            {nonBillableTimeEntries.length > 0 && (
                              <>
                                <tr style={{ background: '#FEF5F5' }}>
                                  <td colSpan={6} style={{ padding: '8px 8px', fontSize: '11px', fontWeight: '500', color: '#791F1F' }}>
                                    — NO CHARGE ITEMS —
                                  </td>
                                </tr>
                                {nonBillableTimeEntries.map(entry => (
                                  <tr key={`non-time-${entry.id}`} style={{ borderBottom: '0.5px solid #f1efe8', background: '#FEF9F9', opacity: 0.85 }}>
                                    <td style={{ padding: '7px 8px', color: '#888780' }}>
                                      {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {entry.description}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#2c2c2a', fontWeight: '500' }}>{entry.hours?.toFixed(1)}</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                      <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                        No
                                      </span>
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#791F1F', fontWeight: '500' }}>No Charge</td>
                                  </tr>
                                ))}
                              </>
                            )}
                            {nonBillableExpenses.length > 0 && (
                              <>
                                {nonBillableTimeEntries.length === 0 && (
                                  <tr style={{ background: '#FEF5F5' }}>
                                    <td colSpan={6} style={{ padding: '8px 8px', fontSize: '11px', fontWeight: '500', color: '#791F1F' }}>
                                      — NO CHARGE ITEMS —
                                    </td>
                                  </tr>
                                )}
                                {nonBillableExpenses.map(expense => (
                                  <tr key={`non-exp-${expense.id}`} style={{ borderBottom: '0.5px solid #f1efe8', background: '#FEF9F9', opacity: 0.85 }}>
                                    <td style={{ padding: '7px 8px', color: '#888780' }}>
                                      {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {expense.title}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                      <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                        No
                                      </span>
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#791F1F', fontWeight: '500' }}>No Charge</td>
                                  </tr>
                                ))}
                              </>
                            )}
                            {nonBillableTimeEntryExpenses.length > 0 && (
                              <>
                                {nonBillableTimeEntries.length === 0 && nonBillableExpenses.length === 0 && (
                                  <tr style={{ background: '#FEF5F5' }}>
                                    <td colSpan={6} style={{ padding: '8px 8px', fontSize: '11px', fontWeight: '500', color: '#791F1F' }}>
                                      — NO CHARGE ITEMS —
                                    </td>
                                  </tr>
                                )}
                                {nonBillableTimeEntryExpenses.map((expense, idx) => (
                                  <tr key={`non-time-exp-${idx}`} style={{ borderBottom: '0.5px solid #f1efe8', background: '#FEF9F9', opacity: 0.85 }}>
                                    <td style={{ padding: '7px 8px', color: '#888780' }}>
                                      {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '7px 8px', color: '#2c2c2a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {expense.title}
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888780' }}>—</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                      <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: '500' }}>
                                        No
                                      </span>
                                    </td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#791F1F', fontWeight: '500' }}>No Charge</td>
                                  </tr>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </>
                    )
                  })()}
                </tbody>
              </table>
              <div style={{ marginLeft: 'auto', width: '260px' }}>
                {[
                  { label: `Subtotal (${months[selectedMonth-1]} ${selectedYear})`, value: `$${(previewInvoice.subtotal||0).toFixed(2)}` },
                  { label: 'Previous balance', value: `$${(previewInvoice.previous_balance||0).toFixed(2)}` },
                  { label: 'Deposit applied', value: previewInvoice.deposit_applied ? `$${previewInvoice.deposit_applied.toFixed(2)}` : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px', color: '#5f5e5a', borderBottom: '0.5px solid #f1efe8' }}>
                    <span>{row.label}</span><span>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 5px', fontSize: '15px', fontWeight: '500', color: '#0C447C', borderTop: '2px solid #0C447C', marginTop: '4px' }}>
                  <span>Total due</span><span>${(previewInvoice.total_due||0).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '0.5px solid #d3d1c7', fontSize: '11px', color: '#888780', textAlign: 'center' }}>
                Please remit payment within 15 days. Make checks payable to {firmInfo.name}.<br />
                Questions? Contact {firmInfo.email} · {firmInfo.phone}
              </div>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '380px', background: '#fff', borderRadius: '14px', border: '1px solid #e8e6e0', boxShadow: '0 18px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1efe8', background: '#faf9f7' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#2c2c2a' }}>Delete invoice?</div>
              <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px' }}>This action cannot be undone.</div>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6', marginBottom: '1rem' }}>
                Delete <strong style={{ color: '#2c2c2a' }}>{invoiceToDelete.invoice_number || 'this invoice'}</strong>
                {invoiceToDelete.cases?.sb_number ? <> for <strong style={{ color: '#2c2c2a' }}>{invoiceToDelete.cases.sb_number}</strong></> : null}?
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setInvoiceToDelete(null)} disabled={deletingInvoice} style={{ padding: '8px 14px', border: '1px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#5f5e5a', fontSize: '13px', cursor: deletingInvoice ? 'not-allowed' : 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={deleteInvoice} disabled={deletingInvoice} style={{ padding: '8px 14px', border: 'none', borderRadius: '8px', background: deletingInvoice ? '#b4b2a9' : '#a32d2d', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: deletingInvoice ? 'not-allowed' : 'pointer' }}>
                  {deletingInvoice ? 'Deleting…' : 'Delete invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 110, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', overflow: 'hidden', border: '1px solid #e8e6e0', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.5rem', borderBottom: '1px solid #e8e6e0', background: 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', letterSpacing: '-0.2px' }}>Create new invoice</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>Create a draft invoice from approved time entries</div>
              </div>
              <button onClick={() => setShowCreateForm(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', fontSize: '16px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '1.75rem' }}>

            <form onSubmit={handleCreateInvoice}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Invoice type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'case', label: 'Case invoice' },
                    { key: 'association', label: 'Association invoice' },
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, targetType: option.key, caseId: '', associationId: '' }))}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: createForm.targetType === option.key ? '2px solid #0C447C' : '0.5px solid #d3d1c7',
                        background: createForm.targetType === option.key ? '#E6F1FB' : '#fff',
                        color: createForm.targetType === option.key ? '#0C447C' : '#5f5e5a',
                        fontSize: '13px',
                        fontWeight: createForm.targetType === option.key ? '500' : '400',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {createForm.targetType === 'case' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Case</label>
                  <input
                    type="text"
                    value={createForm.caseQuery}
                    onChange={e => setCreateField('caseQuery', e.target.value)}
                    placeholder="Search by SB no., client, or matter..."
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff', marginBottom: '8px' }}
                  />
                  <select value={createForm.caseId} onChange={e => setCreateField('caseId', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }}>
                    <option value="">Select case...</option>
                    {cases
                      .filter(c => matchesSearch([c.sb_number, c.clients?.first_name, c.clients?.last_name, c.brief_description], createForm.caseQuery))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.sb_number} - {c.clients?.last_name}, {c.clients?.first_name} {c.brief_description ? `- ${c.brief_description}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {createForm.targetType === 'association' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Association</label>
                  <select value={createForm.associationId} onChange={e => setCreateField('associationId', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }}>
                    <option value="">Select association...</option>
                    {associations.map(assoc => (
                      <option key={assoc.id} value={assoc.id}>{assoc.short_name} - {assoc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Invoice number</label>
                  <input type="text" value={createForm.invoiceNumber} onChange={e => setCreateField('invoiceNumber', e.target.value)} placeholder="Leave blank to auto-generate" style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Invoice date</label>
                  <input type="date" value={createForm.invoiceDate} onChange={e => setCreateField('invoiceDate', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Start date</label>
                  <input type="date" value={createForm.startDate} onChange={e => setCreateField('startDate', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>End date</label>
                  <input type="date" value={createForm.endDate} onChange={e => setCreateField('endDate', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '6px' }}>Due date</label>
                <input type="date" value={createForm.dueDate} onChange={e => setCreateField('dueDate', e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', color: '#2c2c2a', background: '#fff' }} />
              </div>

              <div style={{ background: '#f1efe8', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#5f5e5a' }}>
                The invoice amount will be calculated from approved time entries between the selected dates. The invoice will be saved as a draft in the billing period for the selected end date.
              </div>

              {createError && (
                <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d', marginBottom: '1rem' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowCreateForm(false)} style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingInvoice} style={{ padding: '8px 18px', border: 'none', borderRadius: '10px', background: creatingInvoice ? '#8aadcf' : 'linear-gradient(135deg, #0C447C 0%, #185FA5 100%)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: creatingInvoice ? 'not-allowed' : 'pointer', boxShadow: creatingInvoice ? 'none' : '0 2px 8px rgba(12,68,124,0.28)' }}>
                  {creatingInvoice ? 'Creating…' : 'Create invoice'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
