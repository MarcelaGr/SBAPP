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
  const [viewMode, setViewMode] = useState('association') // ✅ NEW
  const [expandedRuns, setExpandedRuns] = useState({})
  const [selected, setSelected] = useState([])
  const [previewInvoice, setPreviewInvoice] = useState(null)

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
        cases(sb_number, brief_description, clients(first_name, last_name)),
        associations(short_name),
        invoice_runs(id, association_id, associations(short_name))
      `)
      .eq('period_month', selectedMonth)
      .eq('period_year', selectedYear)

    setInvoices(data || [])

    const runsMap = {}
    data?.forEach(inv => {
      if (inv.invoice_runs) {
        runsMap[inv.invoice_runs.id] = inv.invoice_runs
      }
    })

    const runs = Object.values(runsMap)
    setInvoiceRuns(runs)

    const expanded = {}
    runs.forEach(r => (expanded[r.id] = true))
    setExpandedRuns(expanded)

    setLoading(false)
  }

  function toggleSelect(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function updateInvoiceStatus(id, status) {
    setInvoices(prev =>
      prev.map(inv => (inv.id === id ? { ...inv, status } : inv))
    )
  }

  const statusBadge = status => {
    const styles = {
      draft: { background: '#f1efe8', color: '#5f5e5a' },
      sent: { background: '#E6F1FB', color: '#0C447C' },
      paid: { background: '#eaf3de', color: '#27500a' }
    }
    return (
      <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>
        {status}
      </span>
    )
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const invoicesByRun = invoiceRuns.map(run => ({
    run,
    invoices: invoices.filter(i => i.invoice_runs?.id === run.id)
  }))

  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>

      {/* Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1efe8', borderRadius: '8px', padding: '3px' }}>
            {['association', 'case'].map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === v ? '#0C447C' : 'transparent',
                  color: viewMode === v ? '#fff' : '#5f5e5a'
                }}>
                {v === 'association' ? 'By association' : 'By case'}
              </button>
            ))}
          </div>

          {/* Association filter */}
          {['all', ...associations.map(a => a.short_name), 'private'].map(a => (
            <button key={a} onClick={() => setAssocFilter(a)}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid #ccc',
                background: assocFilter === a ? '#0C447C' : '#fff',
                color: assocFilter === a ? '#fff' : '#333'
              }}>
              {a}
            </button>
          ))}

        </div>
      </div>

      {/* ASSOCIATION VIEW */}
      {viewMode === 'association' && (
        loading ? <div>Loading...</div> : (
          invoicesByRun.map(({ run, invoices: runInvoices }) => (
            <div key={run.id} style={{ marginBottom: '1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
              <div style={{ padding: '10px', background: '#f1efe8' }}>
                {run.associations?.short_name || 'Private'}
              </div>

              {runInvoices.map(inv => (
                <div key={inv.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  {inv.invoice_number} — ${inv.total_due}
                </div>
              ))}
            </div>
          ))
        )
      )}

      {/* CASE VIEW */}
      {viewMode === 'case' && (
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
          <table style={{ width: '100%' }}>
            <tbody>
              {invoices
                .filter(inv => inv.invoice_kind === 'case')
                .map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{inv.cases?.sb_number}</td>
                    <td>{inv.cases?.clients?.last_name}</td>
                    <td>{inv.associations?.short_name || 'Private'}</td>
                    <td>${inv.total_due}</td>
                    <td>{statusBadge(inv.status)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}