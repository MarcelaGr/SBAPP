import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import NewCaseForm from './NewCaseForm'
import { getCaseSearchValues, matchesSearch } from '../lib/search'
import { PRIVATE_CASE_TYPES, normalizeCaseType } from '../lib/caseTypes'
import { PageNotice } from '../components/FormUi'

const DOCUMENT_FOLDERS = [
  'Audio',
  'Authorization',
  'Billing',
  'Correspondense',
  'Drafts',
  'Notes',
  'Pleadings',
  'Scans',
  'Status Reports',
]

function getFolderSlug(folder) {
  return folder.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getDocumentFolder(doc) {
  if (DOCUMENT_FOLDERS.includes(doc.folder)) return doc.folder
  if (DOCUMENT_FOLDERS.includes(doc.folder_category)) return doc.folder_category
  if (DOCUMENT_FOLDERS.includes(doc.category)) return doc.category

  const path = doc.file_path || ''
  const match = DOCUMENT_FOLDERS.find(folder => path.includes(`/${getFolderSlug(folder)}/`))
  return match || 'Notes'
}

function getStorageFileName(fileName) {
  return String(fileName || 'document').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_')
}

function getDefaultTrustForm() {
  return {
    transaction_type: 'deposit',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    invoice_id: '',
    notes: '',
  }
}

function isSchemaCacheMissing(error) {
  const message = error?.message || ''
  return error?.code === 'PGRST205' || error?.code === 'PGRST202' || message.includes('schema cache')
}

function isTrustEligibleCase(caseRecord) {
  return caseRecord?.case_category === 'private' && PRIVATE_CASE_TYPES.includes(normalizeCaseType(caseRecord.case_type))
}

function getTrustTransactionResult(data) {
  return Array.isArray(data) ? data[0] : data
}

export default function Cases({ staff, isAttorney }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedCase, setSelectedCase] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showNewCase, setShowNewCase] = useState(false)
  const [showEditCase, setShowEditCase] = useState(false)
  const [notice, setNotice] = useState(null)

  // Documents state
  const [documents, setDocuments] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingFolder, setUploadingFolder] = useState('')
  const [pendingDocumentFolder, setPendingDocumentFolder] = useState('Notes')
  const [expandedDocumentFolders, setExpandedDocumentFolders] = useState(() => new Set(DOCUMENT_FOLDERS))
  const fileInputRef = useRef()

  // Comments/chat state
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const chatEndRef = useRef()

  // Status reports state
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportUploading, setReportUploading] = useState(false)
  const [reportNotes, setReportNotes] = useState('')
  const [showReportForm, setShowReportForm] = useState(false)
  const reportFileRef = useRef()

  const isAdmin = staff?.role === 'admin'
  const [trustAccount, setTrustAccount] = useState(null)
  const [trustTransactions, setTrustTransactions] = useState([])
  const [trustLoading, setTrustLoading] = useState(false)
  const [trustInvoices, setTrustInvoices] = useState([])
  const [savingTrust, setSavingTrust] = useState(false)
  const [trustError, setTrustError] = useState('')
  const [trustForm, setTrustForm] = useState(getDefaultTrustForm)

  useEffect(() => { fetchCases() }, [])

  useEffect(() => {
    if (selectedCase) {
      fetchDocuments(selectedCase.id)
      fetchComments(selectedCase.id)
      fetchReports(selectedCase.id)
      if (isTrustEligibleCase(selectedCase)) {
        fetchTrustData(selectedCase)
      } else {
        setTrustAccount(null)
        setTrustTransactions([])
        setTrustInvoices([])
        setTrustError('')
        setActiveTab(prev => prev === 'trust_account' ? 'overview' : prev)
      }
    }
  }, [selectedCase])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function fetchCases() {
    const { data, error } = await supabase
      .from('cases')
      .select(`*, clients(id, first_name, last_name, email, phone), associations(id, short_name, name), case_attorneys(attorney_id, is_lead, staff(full_name, initials))`)
      .order('created_at', { ascending: false })
    if (!error) setCases(data || [])
    setLoading(false)
  }

  async function fetchDocuments(caseId) {
    setDocsLoading(true)
    const { data } = await supabase.from('documents').select('*, staff(full_name, initials)').eq('case_id', caseId).order('created_at', { ascending: false })
    setDocuments(data || [])
    setDocsLoading(false)
  }

  function toggleDocumentFolder(folder) {
    setExpandedDocumentFolders(prev => {
      const next = new Set(prev)
      if (next.has(folder)) {
        next.delete(folder)
      } else {
        next.add(folder)
      }
      return next
    })
  }

  function chooseDocumentFolder(folder) {
    setPendingDocumentFolder(folder)
    fileInputRef.current?.click()
  }

  async function fetchComments(caseId) {
    setCommentsLoading(true)
    const { data } = await supabase.from('comments').select('*, staff:author_id(full_name, initials, role)').eq('case_id', caseId).order('created_at', { ascending: true })
    setComments(data || [])
    setCommentsLoading(false)
  }

  async function fetchReports(caseId) {
    setReportsLoading(true)
    const { data } = await supabase
      .from('status_reports')
      .select('*, attorney:attorney_id(full_name, initials), approver:approved_by(full_name), sender:sent_by(full_name)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
    setReports(data || [])
    setReportsLoading(false)
  }

  async function fetchTrustData(caseRecord) {
    if (!caseRecord?.id || !isTrustEligibleCase(caseRecord)) return
    setTrustLoading(true)
    setTrustError('')

    const [{ data: accountData, error: accountError }, { data: transactionData, error: transactionError }, { data: invoiceData, error: invoiceError }] = await Promise.all([
      supabase
        .from('trust_accounts')
        .select('*')
        .eq('case_id', caseRecord.id)
        .maybeSingle(),
      supabase
        .from('trust_transactions')
        .select('*, staff:performed_by(full_name, initials), invoices(invoice_number)')
        .eq('case_id', caseRecord.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, status, total_due')
        .eq('case_id', caseRecord.id)
        .in('status', ['draft', 'sent'])
        .order('issued_at', { ascending: false }),
    ])

    const trustLoadError = accountError || transactionError || invoiceError
    if (trustLoadError) {
      setTrustError(isSchemaCacheMissing(trustLoadError)
        ? 'Trust account tables/functions are not installed in the database yet. Apply the trust_account_management migration first.'
        : `Unable to load trust data: ${trustLoadError.message}`)
    }

    setTrustAccount(accountData || null)
    setTrustTransactions(transactionData || [])
    setTrustInvoices(invoiceData || [])
    setTrustLoading(false)
  }

  function setTrustField(key, value) {
    setTrustForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveTrustTransaction(e) {
    e.preventDefault()
    if (!selectedCase) return

    setTrustError('')
    if (!isTrustEligibleCase(selectedCase)) {
      setTrustError('Trust accounts are only available for private TRST and FL-TRST cases.')
      return
    }

    const amount = Number(trustForm.amount)
    const resolvedClientId = selectedCase.client_id || selectedCase.clients?.id

    if (!Number.isFinite(amount) || amount <= 0) {
      setTrustError('Please enter a valid amount greater than zero.')
      return
    }
    if (!trustForm.transaction_date) {
      setTrustError('Please select a transaction date.')
      return
    }
    if (trustForm.transaction_type === 'invoice_payment' && !trustForm.invoice_id) {
      setTrustError('Please choose an invoice to apply trust funds.')
      return
    }
    if (!resolvedClientId) {
      setTrustError('Case is missing linked client. Please refresh and try again.')
      return
    }

    if (trustForm.transaction_type !== 'deposit') {
      const currentBalance = Number(trustAccount?.current_balance || 0)
      if (amount > currentBalance) {
        setTrustError(`Insufficient trust balance. Available: $${currentBalance.toFixed(2)}`)
        return
      }
    }

    setSavingTrust(true)
    try {
      let savedTransaction = null

      if (trustForm.transaction_type === 'invoice_payment') {
        const { data, error } = await supabase.rpc('apply_trust_to_invoice', {
          p_invoice_id: trustForm.invoice_id,
          p_amount: amount,
          p_transaction_date: trustForm.transaction_date,
          p_notes: trustForm.notes || null,
          p_performed_by: staff?.id || null,
        })
        if (error) throw error
        savedTransaction = getTrustTransactionResult(data)
      } else {
        const { data: txResult, error } = await supabase.rpc('record_trust_transaction', {
          p_case_id: selectedCase.id,
          p_client_id: resolvedClientId,
          p_transaction_type: trustForm.transaction_type,
          p_amount: amount,
          p_transaction_date: trustForm.transaction_date,
          p_notes: trustForm.notes || null,
          p_performed_by: staff?.id || null,
          p_invoice_id: null,
        })
        if (error) throw error
        savedTransaction = getTrustTransactionResult(txResult)
      }

      setTrustForm(getDefaultTrustForm())
      if (savedTransaction) {
        setTrustTransactions(prev => [savedTransaction, ...prev])
        setTrustAccount(prev => ({
          ...(prev || {}),
          id: savedTransaction.trust_account_id || prev?.id,
          current_balance: savedTransaction.running_balance,
        }))
      }
      await fetchTrustData(selectedCase)
      setNotice({ type: 'success', message: 'Trust transaction recorded.' })
    } catch (error) {
      setTrustError(isSchemaCacheMissing(error)
        ? 'Trust account tables/functions are not installed in the database yet. Apply the trust_account_management migration first.'
        : `Trust transaction failed: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingTrust(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedCase) return
    const folder = DOCUMENT_FOLDERS.includes(pendingDocumentFolder) ? pendingDocumentFolder : 'Notes'
    const duplicate = documents.some(doc => getDocumentFolder(doc) === folder && doc.file_name === file.name)
    if (duplicate) {
      setNotice({ type: 'error', message: `${file.name} already exists in ${folder}. Rename the file or delete the existing upload first.` })
      e.target.value = ''
      return
    }

    setUploading(true)
    setUploadingFolder(folder)
    const filePath = `cases/${selectedCase.id}/${getFolderSlug(folder)}/${Date.now()}_${getStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
    if (!uploadError) {
      const documentData = {
        case_id: selectedCase.id,
        uploaded_by: staff.id,
        file_name: file.name,
        file_path: filePath,
        file_size_kb: Math.round(file.size / 1024),
        folder,
      }
      let insertResult = await supabase.from('documents').insert(documentData)

      if (insertResult.error && insertResult.error.message?.includes("'folder' column")) {
        const legacyDocumentData = { ...documentData }
        delete legacyDocumentData.folder
        insertResult = await supabase.from('documents').insert(legacyDocumentData)
      }

      if (insertResult.error) {
        setNotice({ type: 'error', message: `Document uploaded, but the record could not be saved: ${insertResult.error.message}` })
      } else {
        fetchDocuments(selectedCase.id)
      }
    } else {
      setNotice({ type: 'error', message: `Unable to upload document: ${uploadError.message}` })
    }
    setUploading(false)
    setUploadingFolder('')
    e.target.value = ''
  }

  async function downloadDocument(doc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(doc) {
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    fetchDocuments(selectedCase.id)
  }

  async function postComment() {
    if (!newComment.trim() || !selectedCase) return
    setPosting(true)
    await supabase.from('comments').insert({ case_id: selectedCase.id, author_id: staff.id, body: newComment.trim() })
    setNewComment('')
    fetchComments(selectedCase.id)
    setPosting(false)
  }

  async function handleReportUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedCase) return
    setReportUploading(true)
    const filePath = `status_reports/${selectedCase.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
    if (!uploadError) {
      await supabase.from('status_reports').insert({
        case_id: selectedCase.id,
        attorney_id: staff.id,
        file_name: file.name,
        file_path: filePath,
        file_size_kb: Math.round(file.size / 1024),
        notes: reportNotes.trim() || null,
        status: 'pending',
      })
      setReportNotes('')
      setShowReportForm(false)
      fetchReports(selectedCase.id)
    }
    setReportUploading(false)
    reportFileRef.current.value = ''
  }

  async function updateReportStatus(reportId, status) {
    const updates = { status }
    if (status === 'approved') { updates.approved_by = staff.id; updates.approved_at = new Date().toISOString() }
    if (status === 'sent') { updates.sent_by = staff.id; updates.sent_at = new Date().toISOString() }
    await supabase.from('status_reports').update(updates).eq('id', reportId)
    fetchReports(selectedCase.id)
  }

  async function downloadReport(report) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(report.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteCase(id) {
    setDeleting(true)
    const caseToDelete = cases.find(c => c.id === id)
    const { error } = await supabase.from('cases').delete().eq('id', id)
    if (error) {
      setNotice({ type: 'error', message: `Unable to delete case: ${error.message}` })
      setDeleting(false)
      return
    }
    setCases(cases.filter(c => c.id !== id))
    setShowDeleteConfirm(null)
    setSelectedCase(null)
    setNotice({ type: 'success', message: `${caseToDelete?.sb_number || 'Case'} was deleted.` })
    setDeleting(false)
  }

  const filtered = cases.filter(c => {
    const matchQ = matchesSearch(getCaseSearchValues(c), search)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const matchCat = categoryFilter === 'all' || c.case_category === categoryFilter
    return matchQ && matchStatus && matchCat
  })

  const statusBadge = (status) => {
    const styles = { active: { background: '#eaf3de', color: '#27500a' }, pending: { background: '#faeeda', color: '#633806' }, closed: { background: '#f1efe8', color: '#5f5e5a' } }
    return <span style={{ ...styles[status], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</span>
  }

  const reportStatusBadge = (status) => {
    const styles = {
      pending: { background: '#faeeda', color: '#633806', label: 'Pending approval' },
      approved: { background: '#eaf3de', color: '#27500a', label: 'Approved' },
      sent: { background: '#E6F1FB', color: '#0C447C', label: 'Sent' },
      rejected: { background: '#fcebeb', color: '#791F1F', label: 'Rejected' },
    }
    const s = styles[status] || styles.pending
    return <span style={{ background: s.background, color: s.color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{s.label}</span>
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatFileSize = (kb) => {
    if (!kb) return ''
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
  }

  // ─── CASE DETAIL VIEW ────────────────────────────────────────
  if (selectedCase) {
    const c = selectedCase
    const isMine = (authorId) => authorId === staff?.id
    const showTrustAccount = isTrustEligibleCase(c)
    const tabs = ['Overview', 'Status reports', 'Documents', 'Chat']
    if (showTrustAccount) tabs.splice(2, 0, 'Trust account')
    const documentsByFolder = DOCUMENT_FOLDERS.reduce((grouped, folder) => {
      grouped[folder] = documents.filter(doc => getDocumentFolder(doc) === folder)
      return grouped
    }, {})

    return (
      <div style={{ padding: '1.25rem', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <PageNotice notice={notice} onDismiss={() => setNotice(null)} />

        {/* Back + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <button onClick={() => { setSelectedCase(null); setActiveTab('overview') }}
            style={{ background: 'none', border: 'none', color: '#185FA5', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
            ← Back to cases
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && (
              <button onClick={() => setShowDeleteConfirm(c)}
                style={{ padding: '6px 14px', background: '#fff', color: '#a32d2d', border: '0.5px solid #f09595', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                Delete
              </button>
            )}
            <button onClick={() => setShowEditCase(true)}
              style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              Edit case
            </button>
          </div>
        </div>

        {/* Case header card */}
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#2c2c2a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {c.clients?.last_name}, {c.clients?.first_name} {statusBadge(c.status)}
          </div>
          <div style={{ fontSize: '13px', color: '#888780', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {c.brief_description || '—'} ·
            {c.case_category === 'association'
              ? <span style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{c.associations?.short_name}</span>
              : <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{normalizeCaseType(c.case_type) || 'Private'}</span>
            }
          </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Assoc. case no.', value: c.association_case_number || '—' },
              { label: 'Opened', value: formatDate(c.opened_at) },
              { label: 'Billing', value: c.billing_type === 'hourly' ? `Hourly${c.private_hourly_rate ? ' · $' + c.private_hourly_rate + '/hr' : ''}` : `Flat fee${c.flat_fee_amount ? ' · $' + c.flat_fee_amount : ''}` },
              { label: 'Employee no.', value: c.serial_number || '—' },
              { label: 'SB file no.', value: c.sb_number || '—' },
            ].map(item => (
              <div key={item.label} style={{ fontSize: '12px' }}>
                <span style={{ color: '#888780' }}>{item.label} </span>
                <span style={{ color: '#2c2c2a', fontWeight: '500' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '12px 12px 0 0', borderBottom: 'none', padding: '0 1.25rem' }}>
          {tabs.map(tab => (
            <div key={tab} onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '_'))}
              style={{ padding: '12px 16px', fontSize: '13px', cursor: 'pointer', color: activeTab === tab.toLowerCase().replace(' ', '_') ? '#0C447C' : '#888780', fontWeight: activeTab === tab.toLowerCase().replace(' ', '_') ? '500' : '400', borderBottom: activeTab === tab.toLowerCase().replace(' ', '_') ? '2px solid #0C447C' : '2px solid transparent', whiteSpace: 'nowrap' }}>
              {tab}
              {tab === 'Status reports' && reports.length > 0 && (
                <span style={{ marginLeft: '5px', background: reports.some(r => r.status === 'pending') ? '#faeeda' : '#E6F1FB', color: reports.some(r => r.status === 'pending') ? '#633806' : '#0C447C', borderRadius: '20px', fontSize: '10px', padding: '1px 6px', fontWeight: '500' }}>
                  {reports.length}
                </span>
              )}
              {tab === 'Documents' && documents.length > 0 && (
                <span style={{ marginLeft: '5px', background: '#E6F1FB', color: '#0C447C', borderRadius: '20px', fontSize: '10px', padding: '1px 6px', fontWeight: '500' }}>{documents.length}</span>
              )}
              {tab === 'Trust account' && showTrustAccount && trustTransactions.length > 0 && (
                <span style={{ marginLeft: '5px', background: '#EAF3DE', color: '#27500a', borderRadius: '20px', fontSize: '10px', padding: '1px 6px', fontWeight: '500' }}>{trustTransactions.length}</span>
              )}
              {tab === 'Chat' && comments.length > 0 && (
                <span style={{ marginLeft: '5px', background: '#E6F1FB', color: '#0C447C', borderRadius: '20px', fontSize: '10px', padding: '1px 6px', fontWeight: '500' }}>{comments.length}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tab body */}
        <div style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '0 0 12px 12px', borderTop: 'none', padding: '1.25rem' }}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Case details</div>
                  {[
                    { label: 'Client', value: `${c.clients?.first_name} ${c.clients?.last_name}` },
                    { label: 'Email', value: c.clients?.email || '—' },
                    { label: 'Phone', value: c.clients?.phone || '—' },
                    { label: 'Association', value: c.associations?.name || (normalizeCaseType(c.case_type) || 'Private') },
                    { label: 'Employee No.', value: c.serial_number || '—' },
                    { label: 'SB file no.', value: c.sb_number || '—' },
                    { label: 'Assoc. case no.', value: c.association_case_number || '—' },
                    { label: 'Status', value: c.status },
                    { label: 'Opened', value: formatDate(c.opened_at) },
                    { label: 'Closed', value: formatDate(c.closed_at) },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1efe8', fontSize: '13px' }}>
                      <span style={{ color: '#888780' }}>{row.label}</span>
                      <span style={{ color: '#2c2c2a', fontWeight: '500', textAlign: 'right' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '8px' }}>Description</div>
                  {c.full_description
                    ? <p style={{ fontSize: '13px', color: '#5f5e5a', lineHeight: '1.6', margin: 0 }}>{c.full_description}</p>
                    : <p style={{ fontSize: '13px', color: '#b4b2a9', margin: 0, fontStyle: 'italic' }}>No description added yet.</p>
                  }
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780', marginBottom: '0.75rem' }}>Attorneys assigned</div>
                  {c.case_attorneys?.length > 0 ? c.case_attorneys.map(a => (
                    <div key={a.attorney_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: '#0C447C', border: '1px solid #B5D4F4' }}>
                        {a.staff?.initials}
                      </div>
                      <span style={{ fontSize: '13px', color: '#2c2c2a' }}>{a.staff?.full_name}</span>
                      {a.is_lead && <span style={{ fontSize: '11px', color: '#888780' }}>· Lead</span>}
                    </div>
                  )) : <p style={{ fontSize: '13px', color: '#888780' }}>No attorneys assigned yet.</p>}
                </div>
                <div>
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
          )}

          {/* ── STATUS REPORTS TAB ── */}
          {activeTab === 'status_reports' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', color: '#888780' }}>{reports.length} status report{reports.length !== 1 ? 's' : ''}</div>
                {(isAttorney || staff?.role === 'attorney') && (
                  <button onClick={() => setShowReportForm(!showReportForm)}
                    style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    + Submit status report
                  </button>
                )}
              </div>

              {/* Upload form for attorneys */}
              {showReportForm && (
                <div style={{ background: '#f1efe8', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', border: '0.5px solid #d3d1c7' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', marginBottom: '10px' }}>Submit new status report</div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#5f5e5a', display: 'block', marginBottom: '5px' }}>Notes (optional)</label>
                    <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} placeholder="Any notes about this status report..." rows={2}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="file" ref={reportFileRef} onChange={handleReportUpload} style={{ display: 'none' }} accept=".pdf,.doc,.docx" />
                    <button onClick={() => reportFileRef.current.click()} disabled={reportUploading}
                      style={{ padding: '7px 16px', background: reportUploading ? '#888' : '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: reportUploading ? 'not-allowed' : 'pointer' }}>
                      {reportUploading ? 'Uploading...' : '📎 Attach file & submit'}
                    </button>
                    <button onClick={() => setShowReportForm(false)}
                      style={{ padding: '7px 14px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#5f5e5a' }}>
                      Cancel
                    </button>
                    <span style={{ fontSize: '11px', color: '#888780' }}>PDF, DOC, DOCX accepted</span>
                  </div>
                </div>
              )}

              {/* Reports list */}
              {reportsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading reports...</div>
              ) : reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#b4b2a9', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                  No status reports submitted yet.
                </div>
              ) : (
                reports.map((report, idx) => (
                  <div key={report.id} style={{ padding: '14px 0', borderBottom: idx < reports.length - 1 ? '0.5px solid #f1efe8' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* File info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ width: '32px', height: '32px', background: '#E6F1FB', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="3" y="1" width="10" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{report.file_name || 'Status report'}</div>
                            <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>
                              Submitted by {report.attorney?.full_name} · {formatDate(report.created_at)} at {formatTime(report.created_at)}
                              {report.file_size_kb && ` · ${formatFileSize(report.file_size_kb)}`}
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {report.notes && (
                          <div style={{ fontSize: '12px', color: '#5f5e5a', background: '#f1efe8', padding: '6px 10px', borderRadius: '6px', marginBottom: '6px' }}>
                            {report.notes}
                          </div>
                        )}

                        {/* Status trail */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {reportStatusBadge(report.status)}
                          {report.approved_at && (
                            <span style={{ fontSize: '11px', color: '#888780' }}>
                              Approved by {report.approver?.full_name} · {formatDate(report.approved_at)}
                            </span>
                          )}
                          {report.sent_at && (
                            <span style={{ fontSize: '11px', color: '#888780' }}>
                              · Sent by {report.sender?.full_name} · {formatDate(report.sent_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                        {report.file_path && (
                          <button onClick={() => downloadReport(report)}
                            style={{ padding: '4px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '12px', cursor: 'pointer' }}>
                            Download
                          </button>
                        )}
                        {/* Admin actions */}
                        {isAdmin && report.status === 'pending' && (
                          <>
                            <button onClick={() => updateReportStatus(report.id, 'approved')}
                              style={{ padding: '4px 12px', border: 'none', borderRadius: '6px', background: '#eaf3de', color: '#27500a', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                              Approve
                            </button>
                            <button onClick={() => updateReportStatus(report.id, 'rejected')}
                              style={{ padding: '4px 12px', border: 'none', borderRadius: '6px', background: '#fcebeb', color: '#791F1F', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                              Reject
                            </button>
                          </>
                        )}
                        {isAdmin && report.status === 'approved' && (
                          <button onClick={() => updateReportStatus(report.id, 'sent')}
                            style={{ padding: '4px 12px', border: 'none', borderRadius: '6px', background: '#E6F1FB', color: '#0C447C', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                            Mark as sent
                          </button>
                        )}
                        {isAdmin && report.status === 'rejected' && (
                          <button onClick={() => updateReportStatus(report.id, 'pending')}
                            style={{ padding: '4px 12px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', color: '#5f5e5a', fontSize: '12px', cursor: 'pointer' }}>
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── DOCUMENTS TAB ── */}
          {activeTab === 'documents' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#2c2c2a', fontWeight: '500' }}>Documents</div>
                  <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{documents.length} document{documents.length !== 1 ? 's' : ''} across {DOCUMENT_FOLDERS.length} folders</div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>
              {docsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading documents...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {DOCUMENT_FOLDERS.map(folder => {
                    const folderDocuments = documentsByFolder[folder] || []
                    const expanded = expandedDocumentFolders.has(folder)
                    const isUploadingHere = uploading && uploadingFolder === folder

                    return (
                      <div key={folder} style={{ border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: '#faf9f7', borderBottom: expanded ? '0.5px solid #f1efe8' : 'none' }}>
                          <button type="button" onClick={() => toggleDocumentFolder(folder)} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2c2c2a', fontSize: '13px', fontWeight: '500' }}>
                            <span style={{ width: '16px', color: '#888780', fontSize: '12px' }}>{expanded ? '▾' : '▸'}</span>
                            <span>{folder}</span>
                            <span style={{ color: '#888780', fontWeight: '400' }}>({folderDocuments.length})</span>
                          </button>
                          <button type="button" onClick={() => chooseDocumentFolder(folder)} disabled={uploading} style={{ padding: '5px 10px', border: '0.5px solid #185FA5', borderRadius: '6px', background: uploading ? '#f1efe8' : '#fff', color: uploading ? '#888780' : '#185FA5', fontSize: '12px', cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                            {isUploadingHere ? 'Uploading...' : 'Upload'}
                          </button>
                        </div>
                        {expanded && (
                          <div style={{ padding: folderDocuments.length === 0 ? '12px' : '0 12px' }}>
                            {folderDocuments.length === 0 ? (
                              <div style={{ fontSize: '12px', color: '#b4b2a9', fontStyle: 'italic' }}>No documents in this folder.</div>
                            ) : folderDocuments.map(doc => (
                              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '0.5px solid #f1efe8' }}>
                                <div style={{ width: '32px', height: '32px', background: '#E6F1FB', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="3" y="1" width="10" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</div>
                                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                                    Uploaded {formatDate(doc.created_at)} · {doc.staff?.full_name || doc.staff?.initials || 'Unknown'} {doc.file_size_kb ? `· ${formatFileSize(doc.file_size_kb)}` : ''}
                                  </div>
                                </div>
                                <button onClick={() => downloadDocument(doc)} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>Download</button>
                                {isAdmin && <button onClick={() => deleteDocument(doc)} style={{ fontSize: '12px', color: '#a32d2d', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>Delete</button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'trust_account' && showTrustAccount && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '12px', marginBottom: '1rem' }}>
                <div style={{ background: '#faf9f7', border: '0.5px solid #d3d1c7', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>Current trust balance</div>
                  <div style={{ fontSize: '22px', fontWeight: '600', color: '#27500a' }}>${(Number(trustAccount?.current_balance) || 0).toFixed(2)}</div>
                </div>
                <div style={{ background: '#faf9f7', border: '0.5px solid #d3d1c7', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>Transactions</div>
                  <div style={{ fontSize: '22px', fontWeight: '600', color: '#2c2c2a' }}>{trustTransactions.length}</div>
                </div>
              </div>

              <form onSubmit={saveTrustTransaction} style={{ background: '#fff', border: '0.5px solid #d3d1c7', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#2c2c2a', marginBottom: '10px' }}>Record trust transaction</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <select value={trustForm.transaction_type} onChange={e => setTrustField('transaction_type', e.target.value)} style={{ padding: '8px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal / disbursement</option>
                    <option value="invoice_payment">Apply to invoice</option>
                  </select>
                  <input type="number" min="0.01" step="0.01" value={trustForm.amount} onChange={e => setTrustField('amount', e.target.value)} placeholder="Amount" style={{ padding: '8px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px' }} />
                  <input type="date" value={trustForm.transaction_date} onChange={e => setTrustField('transaction_date', e.target.value)} style={{ padding: '8px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px' }} />
                </div>
                {trustForm.transaction_type === 'invoice_payment' && (
                  <div style={{ marginBottom: '10px' }}>
                    <select value={trustForm.invoice_id} onChange={e => setTrustField('invoice_id', e.target.value)} style={{ width: '100%', padding: '8px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px' }}>
                      <option value="">Select invoice...</option>
                      {trustInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.invoice_number || inv.id} · ${Number(inv.total_due || 0).toFixed(2)} · {inv.status}</option>
                      ))}
                    </select>
                  </div>
                )}
                <textarea value={trustForm.notes} onChange={e => setTrustField('notes', e.target.value)} placeholder="Notes" rows={2} style={{ width: '100%', padding: '8px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical', marginBottom: '10px' }} />
                {trustError && <div style={{ background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 10px', color: '#a32d2d', fontSize: '12px', marginBottom: '10px' }}>{trustError}</div>}
                <button type="submit" disabled={savingTrust} style={{ padding: '8px 14px', background: savingTrust ? '#888' : '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: savingTrust ? 'not-allowed' : 'pointer' }}>
                  {savingTrust ? 'Saving...' : 'Record transaction'}
                </button>
              </form>

              {trustLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: '13px' }}>Loading trust ledger...</div>
              ) : trustTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#b4b2a9', fontSize: '13px', background: '#faf9f7', borderRadius: '8px' }}>No trust transactions yet.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '980px' }}>
                    <thead>
                      <tr>
                        {['Type', 'Amount', 'Date', 'Client', 'Case', 'Invoice', 'Notes', 'User', 'Timestamp', 'Running balance'].map(header => (
                          <th key={header} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '0.5px solid #d3d1c7', color: '#888780', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trustTransactions.map(tx => (
                        <tr key={tx.id}>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{tx.transaction_type}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap', fontWeight: '500' }}>${Number(tx.amount || 0).toFixed(2)}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{formatDate(tx.transaction_date)}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8' }}>{c.clients?.last_name}, {c.clients?.first_name}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{c.sb_number || '—'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{tx.invoices?.invoice_number || '—'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes || '—'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{tx.staff?.initials || tx.staff?.full_name || '—'}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)} {formatTime(tx.created_at)}</td>
                          <td style={{ padding: '9px 10px', borderBottom: '0.5px solid #f1efe8', whiteSpace: 'nowrap', fontWeight: '600', color: '#27500a' }}>${Number(tx.running_balance || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {commentsLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '13px' }}>Loading chat...</div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#b4b2a9', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    No messages yet. Start the conversation!
                  </div>
                ) : comments.map(comment => {
                  const mine = isMine(comment.author_id)
                  return (
                    <div key={comment.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: mine ? '#0C447C' : '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: mine ? '#fff' : '#0C447C', border: mine ? 'none' : '1px solid #B5D4F4', flexShrink: 0 }}>
                        {comment.staff?.initials}
                      </div>
                      <div style={{ maxWidth: '65%' }}>
                        {!mine && <div style={{ fontSize: '11px', color: '#888780', marginBottom: '3px', paddingLeft: '2px' }}>{comment.staff?.full_name}</div>}
                        <div style={{ padding: '9px 13px', borderRadius: mine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: mine ? '#0C447C' : '#fff', border: mine ? 'none' : '0.5px solid #d3d1c7', fontSize: '13px', color: mine ? '#fff' : '#2c2c2a', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {comment.body}
                        </div>
                        <div style={{ fontSize: '10px', color: '#b4b2a9', marginTop: '3px', textAlign: mine ? 'right' : 'left' }}>
                          {formatDate(comment.created_at)} · {formatTime(comment.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ borderTop: '0.5px solid #d3d1c7', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, border: '0.5px solid #b4b2a9', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
                      placeholder="Add a comment... (Enter to send, Shift+Enter for new line)" rows={2}
                      style={{ width: '100%', padding: '10px 14px', border: 'none', fontSize: '13px', fontFamily: 'sans-serif', color: '#2c2c2a', background: 'transparent', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={postComment} disabled={posting || !newComment.trim()}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', background: posting || !newComment.trim() ? '#b4b2a9' : '#0C447C', border: 'none', cursor: posting || !newComment.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#b4b2a9', marginTop: '5px' }}>Enter to send · Shift+Enter for new line</div>
              </div>
            </div>
          )}
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '360px', border: '0.5px solid #d3d1c7' }}>
              <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a', marginBottom: '8px' }}>Delete this case?</div>
              <p style={{ fontSize: '13px', color: '#5f5e5a', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                This will permanently delete <strong>{showDeleteConfirm.sb_number}</strong>. This cannot be undone.
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

        {showEditCase && (
          <NewCaseForm
            staff={staff}
            existingCase={selectedCase}
            onClose={() => setShowEditCase(false)}
            onSaved={(updatedCase) => {
              setCases(prev => prev.map(item => item.id === updatedCase.id ? updatedCase : item))
              setSelectedCase(updatedCase)
              setShowEditCase(false)
              setNotice({ type: 'success', message: `${updatedCase.sb_number || 'Case'} was saved.` })
            }}
          />
        )}

      </div>
    )
  }

  // ─── CASES LIST ───────────────────────────────────────────────
  return (
    <div style={{ padding: '1.25rem', fontFamily: 'sans-serif' }}>
      <PageNotice notice={notice} onDismiss={() => setNotice(null)} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '500', color: '#2c2c2a' }}>Cases</div>
        <button onClick={() => setShowNewCase(true)}
          style={{ padding: '6px 14px', background: '#0C447C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
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
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: statusFilter === s ? '#0C447C' : '#d3d1c7', background: statusFilter === s ? '#0C447C' : '#fff', color: statusFilter === s ? '#fff' : '#5f5e5a' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {['all', 'association', 'private'].map(s => (
            <button key={s} onClick={() => setCategoryFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid', borderColor: categoryFilter === s ? '#185FA5' : '#d3d1c7', background: categoryFilter === s ? '#185FA5' : '#fff', color: categoryFilter === s ? '#fff' : '#5f5e5a' }}>
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
                      : <span style={{ background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{normalizeCaseType(c.case_type) || 'Private'}</span>
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
                  <td style={{ padding: '10px', color: '#888780', whiteSpace: 'nowrap' }}>{formatDate(c.opened_at)}</td>
                  <td style={{ padding: '10px' }}>{statusBadge(c.status)}</td>
                  <td style={{ padding: '10px' }}>
                    {isAdmin && (
                      <button onClick={() => setShowDeleteConfirm(c)} style={{ padding: '3px 10px', border: '0.5px solid #f09595', borderRadius: '6px', background: '#fff', color: '#a32d2d', fontSize: '11px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
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
              This will permanently delete <strong>{showDeleteConfirm.sb_number}</strong>. This cannot be undone.
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

      {showNewCase && (
        <NewCaseForm
          staff={staff}
          onClose={() => setShowNewCase(false)}
          onCreated={(createdCase) => {
            setShowNewCase(false)
            fetchCases()
            setNotice({ type: 'success', message: `${createdCase.sb_number || 'Case'} was created.` })
          }}
        />
      )}
    </div>
  )
}
