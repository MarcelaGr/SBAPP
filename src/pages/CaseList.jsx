import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function CaseList() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [assocFilter, setAssocFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [associations, setAssociations] = useState([])
  const [sortCol, setSortCol] = useState('sb_number')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      const [casesRes, assocRes] = await Promise.all([
        supabase.from('cases').select(`
          *,
          clients(first_name, last_name),
          associations(short_name, name),
          case_attorneys(is_lead, staff(full_name, initials))
        `).order('sb_number', { ascending: true }),
        supabase.from('associations').select('*').eq('active', true).order('short_name')
      ])

      if (cancelled) return
      setCases(casesRes.data || [])
      setAssociations(assocRes.data || [])
      setLoading(false)
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const years = [...new Set(cases.map(c => c.sb_number?.slice(3, 5)).filter(Boolean))].sort().reverse()

  const filtered = cases.filter(c => {
    const q = search.toLowerCase()
    const clientName = `${c.clients?.first_name} ${c.clients?.last_name}`.toLowerCase()
    const matchQ = !q || c.sb_number?.toLowerCase().includes(q) || clientName.includes(q) || c.brief_description?.toLowerCase().includes(q) || c.associations?.short_name?.toLowerCase().includes(q)
    const matchAssoc = assocFilter === 'all' || (assocFilter === 'private' ? c.case_category === 'private' : c.associations?.short_name === assocFilter)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchYear = yearFilter === 'all' || c.sb_number?.startsWith('SB ' + yearFilter)
    return matchQ && matchAssoc && matchStatus && matchYear
  }).sort((a, b) => {
    let av, bv
    switch (sortCol) {
      case 'sb_number': av = a.sb_number; bv = b.sb_number; break
      case 'client': av = `${a.clients?.last_name} ${a.clients?.first_name}`; bv = `${b.clients?.last_name} ${b.clients?.first_name}`; break
      case 'association': av = a.associations?.short_name || a.case_type || 'ZZZ'; bv = b.associations?.short_name || b.case_type || 'ZZZ'; break
      case 'description': av = a.brief_description || ''; bv = b.brief_description || ''; break
      case 'attorney': av = a.case_attorneys?.find(x => x.is_lead)?.staff?.full_name || ''; bv = b.case_attorneys?.find(x => x.is_lead)?.staff?.full_name || ''; break
      case 'opened': av = a.opened_at || ''; bv = b.opened_at || ''; break
      case 'status': av = a.status; bv = b.status; break
      default: av = a.sb_number; bv = b.sb_number
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    const rows = filtered.map(c => {
      const lead = c.case_attorneys?.find(a => a.is_lead)
      const assoc = c.case_category === 'association' ? (c.associations?.short_name || '—') : (c.case_type || 'Private')
      const date = c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
      return `<tr>
        <td>${c.sb_number || '—'}</td>
        <td>${c.clients?.last_name || ''}, ${c.clients?.first_name || ''}</td>
        <td>${assoc}</td>
        <td>${c.brief_description || '—'}</td>
        <td>${lead?.staff?.initials || '—'}</td>
        <td>${date}</td>
        <td>${c.status || '—'}</td>
      </tr>`
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Stone Busailah LLP — Case List</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 1.5cm; color: #222; }
          h1 { font-size: 16px; color: #0C447C; margin-bottom: 2px; }
          .sub { font-size: 11px; color: #888; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 6px 8px; background: #0C447C; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
          td { padding: 5px 8px; border-bottom: 0.5px solid #e0e0e0; vertical-align: top; }
          tr:nth-child(even) td { background: #f7f7f7; }
          .footer { margin-top: 20px; font-size: 10px; color: #888; text-align: right; }
        </style>
      </head>
      <body>
        <h1>Stone Busailah LLP</h1>
        <div class="sub">Case List — Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${filtered.length} cases</div>
        <table>
          <thead>
            <tr>
              <th>SB File No.</th>
              <th>Client / Matter</th>
              <th>Association</th>
              <th>Description</th>
              <th>Atty</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Stone Busailah LLP · Pasadena, CA · Confidential</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  function exportCSV() {
    const headers = ['SB File No.', 'Client Name', 'Association', 'Description', 'Attorney', 'Date Opened', 'Status']
    const rows = filtered.map(c => {
      const lead = c.case_attorneys?.find(a => a.is_lead)
      const assoc = c.case_category === 'association' ? (c.associations?.short_name || '') : (c.case_type || 'Private')
      const date = c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-US') : ''
      return [
        c.sb_number || '',
        `${c.clients?.last_name || ''}, ${c.clients?.first_name || ''}`,
        assoc,
        c.brief_description || '',
        lead?.staff?.full_name || '',
        date,
        c.status || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `StoneBusailah_CaseList_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '10px' }}>▲</span>
    return <span style={{ marginLeft: '4px', fontSize: '10px', color: '#185FA5' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const statusBadge = (status) => {
    const styles = { active: { background: '#eaf3de', color: '#27500a' }, pending: { background: '#faeeda', color: '#633806' }, closed: { background: '#f1efe8', color: '#5f5e5a' } }
    return <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</span>
  }

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Case list</div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>Admin view · Replaces the Word document</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCSV}
            style={{ padding: '6px 14px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ↓ Export CSV
          </button>
          <button onClick={handlePrint}
            style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '10px', marginBottom: '1rem' }}>
        {[
          { label: 'Total cases', value: cases.length },
          { label: 'Active', value: cases.filter(c => c.status === 'active').length },
          { label: 'Closed', value: cases.filter(c => c.status === 'closed').length },
          { label: 'Showing', value: filtered.length },
        ].map(s => (
          <div key={s.label} style={{ background: '#e8e6df', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '12px', color: '#5f5e5a', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '500', color: '#2c2c2a' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1efe8', border: '0.5px solid #d3d1c7', borderRadius: '8px', padding: '5px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SB no., client, description..."
              style={{ border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', width: '200px', color: '#2c2c2a' }} />
          </div>

          {/* Association filter */}
          <select value={assocFilter} onChange={e => setAssocFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a', cursor: 'pointer' }}>
            <option value="all">All associations</option>
            {associations.map(a => <option key={a.id} value={a.short_name}>{a.short_name}</option>)}
            <option value="private">Private (TRS / FL-TRST)</option>
          </select>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a', cursor: 'pointer' }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>

          {/* Year filter */}
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 10px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', color: '#2c2c2a', cursor: 'pointer' }}>
            <option value="all">All years</option>
            {years.map(y => <option key={y} value={y}>20{y}</option>)}
          </select>

          <span style={{ fontSize: '12px', color: '#888780', marginLeft: 'auto' }}>{filtered.length} of {cases.length} cases</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading case list...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>No cases match your filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
              <thead>
                <tr>
                  {[
                    { key: 'sb_number', label: 'SB File No.' },
                    { key: 'client', label: 'Client / Matter' },
                    { key: 'association', label: 'Association' },
                    { key: 'description', label: 'Description' },
                    { key: 'attorney', label: 'Atty' },
                    { key: 'opened', label: 'Date' },
                    { key: 'status', label: 'Status' },
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      style={{ textAlign: 'left', padding: '7px 10px', fontSize: '11px', fontWeight: '500', color: sortCol === col.key ? '#185FA5' : '#888780', borderBottom: '0.5px solid #d3d1c7', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      {col.label}<SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const lead = c.case_attorneys?.find(a => a.is_lead)
                  const assoc = c.case_category === 'association' ? c.associations?.short_name : (c.case_type || 'Private')
                  const isPrivate = c.case_category === 'private'
                  const date = c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                  return (
                    <tr key={c.id}
                      style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f7' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#faf9f7'}
                    >
                      <td style={{ padding: '10px', fontWeight: '500', color: '#185FA5', whiteSpace: 'nowrap' }}>{c.sb_number}</td>
                      <td style={{ padding: '10px', fontWeight: '500', color: '#2c2c2a' }}>
                        {c.clients?.last_name}, {c.clients?.first_name}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {assoc ? (
                          <span style={{ background: isPrivate ? '#EEEDFE' : '#E6F1FB', color: isPrivate ? '#3C3489' : '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>
                            {assoc}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px', color: '#5f5e5a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.brief_description || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        {lead ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4', flexShrink: 0 }}>
                              {lead.staff?.initials}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px', color: '#888780', whiteSpace: 'nowrap' }}>{date}</td>
                      <td style={{ padding: '10px' }}>{statusBadge(c.status)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
