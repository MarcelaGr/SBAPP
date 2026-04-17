import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Invoices({ staff }) {
  const [invoiceRuns, setInvoiceRuns] = useState([])
  const [invoices, setInvoices] = useState([])
  const [associations, setAssociations] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [assocFilter, setAssocFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('association')
  const [expandedRuns, setExpandedRuns] = useState({})
  const [selected, setSelected] = useState([])
  const [previewInvoice, setPreviewInvoice] = useState(null)
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
    fetchInvoices()
  }, [selectedMonth, selectedYear])

  async function fetchAssociations() {
    const { data } = await supabase.from('associations').select('*').eq('active', true).order('short_name')
    setAssociations(data || [])
  }

  async function fetchInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        cases(sb_number, brief_description, association_case_number,
          clients(first_name, last_name),
          case_attorneys(is_lead, staff(full_name, initials))
        ),
        associations(id, short_name, name, billing_contact_name, billing_contact_email, address_street, address_city_state_zip),
        invoice_runs(id, period_month, period_year, association_id, associations(short_name, name))
      `)
      .eq('period_month', selectedMonth)
      .eq('period_year', selectedYear)
      .order('invoice_number', { ascending: true })

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
    setLoading(false)
  }

  async function generateRun() {
    setGenerating(true)
    const { data: cases } = await supabase
      .from('cases')
      .select(`*, clients(first_name, last_name), associations(id, short_name, name), time_entries(id, hours, computed_amount, status)`)
      .eq('status', 'active')

    if (!cases || cases.length === 0) { alert('No active cases found.'); setGenerating(false); return }

    const byAssoc = {}
    cases.forEach(c => {
      const key = c.case_category === 'private' ? '__private__' : (c.association_id || '__private__')
      if (!byAssoc[key]) byAssoc[key] = []
      byAssoc[key].push(c)
    })

    for (const [assocKey, assocCases] of Object.entries(byAssoc)) {
      const isPrivate = assocKey === '__private__'
      const assocId = isPrivate ? null : assocKey

      const { data: run, error: runError } = await supabase
        .from('invoice_runs')
        .upsert({ period_month: selectedMonth, period_year: selectedYear, association_id: assocId, generated_by: staff?.id }, { onConflict: 'period_month,period_year,association_id' })
        .select().single()

      if (runError || !run) continue

      for (const c of assocCases) {
        const approvedEntries = (c.time_entries || []).filter(e => e.status === 'approved')
        const subtotal = approvedEntries.reduce((s, e) => s + (e.computed_amount || 0), 0)
        const { data: existingInv } = await supabase.from('invoices').select('id').eq('case_id', c.id).eq('period_month', selectedMonth).eq('period_year', selectedYear).eq('invoice_kind', 'case').single()
        if (!existingInv) {
          await supabase.from('invoices').insert({
            invoice_run_id: run.id, case_id: c.id, client_id: c.client_id, association_id: assocId,
            invoice_kind: 'case', period_month: selectedMonth, period_year: selectedYear,
            subtotal, total_due: subtotal, status: 'draft',
            issued_at: new Date().toISOString().split('T')[0],
            due_at: new Date(selectedYear, selectedMonth, 15).toISOString().split('T')[0],
          })
        }
      }

      if (!isPrivate) {
        const { data: existingSummary } = await supabase.from('invoices').select('id').eq('invoice_run_id', run.id).eq('invoice_kind', 'association_summary').single()
        if (!existingSummary) {
          const totalSubtotal = assocCases.reduce((s, c) => s + (c.time_entries || []).filter(e => e.status === 'approved').reduce((ss, e) => ss + (e.computed_amount || 0), 0), 0)
          await supabase.from('invoices').insert({
            invoice_run_id: run.id, case_id: assocCases[0].id, client_id: assocCases[0].client_id, association_id: assocId,
            invoice_kind: 'association_summary', period_month: selectedMonth, period_year: selectedYear,
            subtotal: totalSubtotal, total_due: totalSubtotal, status: 'draft',
            issued_at: new Date().toISOString().split('T')[0],
            due_at: new Date(selectedYear, selectedMonth, 15).toISOString().split('T')[0],
          })
        }
      }
    }
    setGenerating(false)
    fetchInvoices()
  }

  async function updateInvoiceStatus(id, status) {
    await supabase.from('invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString().split('T')[0] : null }).eq('id', id)
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv))
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

  function printInvoice(inv) {
    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>${inv.invoice_number} — Stone Busailah LLP</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:2cm;color:#222}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:1rem;border-bottom:3px solid #0C447C;margin-bottom:1.5rem}
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
      <div><div class="firm-name">${firmInfo.name}</div><div class="firm-sub">${firmInfo.address}<br>${firmInfo.city}<br>Tel: ${firmInfo.phone} · ${firmInfo.website}</div></div>
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

  const statusBadge = (status) => {
    const styles = { draft: { background: '#f1efe8', color: '#5f5e5a' }, sent: { background: '#E6F1FB', color: '#0C447C' }, paid: { background: '#eaf3de', color: '#27500a' } }
    return <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</span>
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const years = [2024, 2025, 2026, 2027]

  // Grouped by run for association view
  const filteredRuns = invoiceRuns.filter(run => {
    if (assocFilter === 'all') return true
    if (assocFilter === 'private') return !run.association_id
    return run.associations?.short_name === assocFilter
  })

  // Flat list for case view
  const caseInvoices = invoices
    .filter(inv => inv.invoice_kind === 'case')
    .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
    .filter(inv => assocFilter === 'all' || inv.associations?.short_name === assocFilter || (assocFilter === 'private' && !inv.association_id))

  const totalInvoiced = invoices.filter(i => i.invoice_kind === 'case').reduce((s, i) => s + (i.total_due || 0), 0)
  const totalPaid = invoices.filter(i => i.invoice_kind === 'case' && i.status === 'paid').reduce((s, i) => s + (i.total_due || 0), 0)

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Invoices</div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>Admin view — monthly billing runs</div>
        </div>
        <button onClick={generateRun} disabled={generating}
          style={{ padding: '6px 16px', background: generating ? '#888' : '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
          {generating ? 'Generating...' : 'Generate invoice run'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px', marginBottom: '1rem' }}>
        {[
          { label: `Invoiced (${months[selectedMonth-1]} ${selectedYear})`, value: `$${totalInvoiced.toFixed(2)}` },
          { label: 'Outstanding', value: `$${(totalInvoiced - totalPaid).toFixed(2)}` },
          { label: 'Paid', value: `$${totalPaid.toFixed(2)}` },
          { label: 'Total invoices', value: invoices.filter(i => i.invoice_kind === 'case').length },
        ].map(s => (
          <div key={s.label} style={{ background: '#e8e6df', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: '#2c2c2a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Month / Year */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
            style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a' }}>
            {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
            style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div style={{ width: '1px', height: '24px', background: '#d3d1c7' }} />

          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: '3px', background: '#f1efe8', borderRadius: '8px', padding: '3px' }}>
            {[{ key: 'association', label: 'By association' }, { key: 'case', label: 'By case' }].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                style={{ padding: '4px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: 'none', background: viewMode === v.key ? '#0C447C' : 'transparent', color: viewMode === v.key ? '#fff' : '#5f5e5a' }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: '#d3d1c7' }} />

          {/* Association pills */}
          <div style={{ fontSize: '12px', color: '#888780' }}>Filter:</div>
          {['all', ...associations.map(a => a.short_name), 'private'].map(a => (
            <button key={a} onClick={() => setAssocFilter(a)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: assocFilter === a ? '#0C447C' : '#d3d1c7', background: assocFilter === a ? '#0C447C' : '#fff', color: assocFilter === a ? '#fff' : '#5f5e5a' }}>
              {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}

          <div style={{ width: '1px', height: '24px', background: '#d3d1c7' }} />

          {/* Status pills */}
          {['all', 'draft', 'sent', 'paid'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: statusFilter === s ? '#185FA5' : '#d3d1c7', background: statusFilter === s ? '#185FA5' : '#fff', color: statusFilter === s ? '#fff' : '#5f5e5a' }}>
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888', fontSize: '13px', background: '#fff', borderRadius: '12px', border: '0.5px solid #d3d1c7' }}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px', border: '0.5px solid #d3d1c7' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a', marginBottom: '4px' }}>No invoices for {months[selectedMonth-1]} {selectedYear}</div>
          <div style={{ fontSize: '13px', color: '#888780' }}>Click "Generate invoice run" to create invoices from approved time entries.</div>
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
                                  <button onClick={() => setPreviewInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Preview</button>
                                  <button onClick={() => printInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>🖨</button>
                                  {inv.status === 'draft' && <button onClick={() => updateInvoiceStatus(inv.id, 'sent')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark sent</button>}
                                  {inv.status === 'sent' && <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark paid</button>}
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
                            <button onClick={() => setPreviewInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>Preview</button>
                            <button onClick={() => printInvoice(inv)} style={{ padding: '3px 10px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '11px', cursor: 'pointer' }}>🖨</button>
                            {inv.status === 'draft' && <button onClick={() => updateInvoiceStatus(inv.id, 'sent')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark sent</button>}
                            {inv.status === 'sent' && <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} style={{ padding: '3px 10px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Mark paid</button>}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '2rem 1rem', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', marginBottom: '2rem', overflow: 'hidden', border: '0.5px solid #d3d1c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '0.5px solid #d3d1c7', background: '#f1efe8' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>Invoice preview — {previewInvoice.invoice_number}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => printInvoice(previewInvoice)} style={{ padding: '6px 14px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}>🖨 Print / PDF</button>
                <button onClick={() => setPreviewInvoice(null)} style={{ padding: '6px 14px', border: 'none', borderRadius: '8px', background: '#0C447C', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '3px solid #0C447C' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '500', color: '#0C447C' }}>{firmInfo.name}</div>
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px', lineHeight: '1.6' }}>{firmInfo.address}<br />{firmInfo.city}<br />Tel: {firmInfo.phone} · {firmInfo.website}</div>
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
                    SB File No.: <strong>{previewInvoice.cases?.sb_number || '—'}</strong>
                    {previewInvoice.cases?.association_case_number && <><br />Assoc. Case No.: <strong>{previewInvoice.cases.association_case_number}</strong></>}
                    <br />Matter: {previewInvoice.cases?.brief_description || '—'}
                  </div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    {['Date', 'Attorney', 'Description', 'Hours', 'Rate', 'Amount'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Hours' || h === 'Rate' || h === 'Amount' ? 'right' : 'left', padding: '7px 8px', background: '#0C447C', color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={6} style={{ padding: '12px 8px', color: '#888780', fontStyle: 'italic', textAlign: 'center', fontSize: '12px' }}>Time entries from approved timesheets will appear here.</td></tr>
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
    </div>
  )
}