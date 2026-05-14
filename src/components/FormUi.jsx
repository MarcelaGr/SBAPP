export function FormModal({ title, subtitle, onClose, children, maxWidth = '520px' }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 100,
        padding: '2rem 1rem',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '100%',
          maxWidth,
          padding: '1.75rem',
          border: '0.5px solid #d3d1c7',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#2c2c2a' }}>{title}</div>
            {subtitle ? <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{subtitle}</div> : null}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#888780', cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close form"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormStatusMessage({ type = 'error', message }) {
  if (!message) return null

  const palette = type === 'success'
    ? { background: '#eaf3de', border: '#97C459', color: '#27500a' }
    : { background: '#fcebeb', border: '#f09595', color: '#a32d2d' }

  return (
    <div
      style={{
        background: palette.background,
        border: `0.5px solid ${palette.border}`,
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
        color: palette.color,
        marginBottom: '1rem',
      }}
    >
      {message}
    </div>
  )
}

export function FormActions({
  onCancel,
  saving,
  saveLabel = 'Save',
  savingLabel = 'Saving...',
  cancelLabel = 'Cancel',
  disabled = false,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '0.5px solid #f1efe8' }}>
      <button
        type="button"
        onClick={onCancel}
        style={{ padding: '8px 18px', border: '0.5px solid #d3d1c7', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#5f5e5a' }}
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', background: saving || disabled ? '#888' : '#0C447C', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: saving || disabled ? 'not-allowed' : 'pointer', minWidth: '108px' }}
      >
        {saving ? savingLabel : saveLabel}
      </button>
    </div>
  )
}

export function PageNotice({ notice, onDismiss }) {
  if (!notice?.message) return null

  return (
    <div
      style={{
        background: notice.type === 'success' ? '#eaf3de' : '#fcebeb',
        border: `0.5px solid ${notice.type === 'success' ? '#97C459' : '#f09595'}`,
        borderRadius: '10px',
        padding: '10px 14px',
        fontSize: '13px',
        color: notice.type === 'success' ? '#27500a' : '#a32d2d',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span>{notice.message}</span>
      {onDismiss ? (
        <button onClick={onDismiss} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
          ✕
        </button>
      ) : null}
    </div>
  )
}
