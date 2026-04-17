import { useState } from 'react'
import { supabase } from './supabaseClient'

const navItems = [
  { key: 'dashboard', label: 'Dashboard', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="5" rx="1"/>
      <rect x="9" y="2" width="5" height="5" rx="1"/>
      <rect x="2" y="9" width="5" height="5" rx="1"/>
      <rect x="9" y="9" width="5" height="5" rx="1"/>
    </svg>
  )},
  { key: 'cases', label: 'Cases', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 3V2M11 3V2M2 7h12"/>
    </svg>
  )},
  { key: 'caselist', label: 'Case list', adminOnly: true, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4"/>
    </svg>
  )},
  { key: 'clients', label: 'Clients', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
    </svg>
  )},
  { key: 'calendar', label: 'Calendar', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 3V2M11 3V2M2 7h12"/>
    </svg>
  )},
  { key: 'timesheets', label: 'Timesheets', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h5"/>
    </svg>
  )},
  { key: 'invoices', label: 'Invoices', adminOnly: true, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M5 5h6M5 11h4"/>
    </svg>
  )},
  { key: 'messages', label: 'Messages', adminOnly: false, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 11.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7z"/>
      <path d="M2 6h12"/>
    </svg>
  )},
  { key: 'settings', label: 'Settings', adminOnly: true, icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
    </svg>
  )},
]

export default function Layout({ user, staff, children, currentPage, setCurrentPage }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: collapsed ? '48px 1fr' : '200px 1fr',
      minHeight: '100vh',
      fontFamily: 'sans-serif',
      transition: 'grid-template-columns 0.25s ease'
    }}>

      {/* ── Sidebar ── */}
      <div style={{
        background: '#0C447C',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '1.25rem 0',
        overflow: 'hidden',
        transition: 'width 0.25s ease'
      }}>

        {/* Logo */}
        <div style={{
          padding: '0 1.25rem 1.25rem',
          borderBottom: '0.5px solid rgba(255,255,255,0.12)',
          marginBottom: '0.5rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}>
          {!collapsed ? (
            <>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '15px' }}>Stone Busailah</div>
              <div style={{ color: '#85B7EB', fontSize: '11px', marginTop: '2px' }}>LLP · Pasadena, CA</div>
            </>
          ) : (
            <div style={{ color: '#fff', fontWeight: '500', fontSize: '13px', textAlign: 'center' }}>SB</div>
          )}
        </div>

        {/* Nav items */}
        {navItems.map(item => {
          if (item.adminOnly && staff?.role !== 'admin') return null
          const isActive = currentPage === item.key
          return (
            <div
              key={item.key}
              onClick={() => setCurrentPage(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '8px 14px' : '8px 1.25rem',
                fontSize: '13px',
                color: isActive ? '#fff' : '#B5D4F4',
                cursor: 'pointer',
                borderLeft: isActive ? '2px solid #fff' : '2px solid transparent',
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ flexShrink: 0, opacity: 0.9 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          )
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User info + sign out */}
        {!collapsed && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderTop: '0.5px solid rgba(255,255,255,0.12)',
            marginTop: '0.5rem'
          }}>
            <div style={{
              color: '#B5D4F4',
              fontSize: '12px',
              marginBottom: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {staff?.full_name || user?.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: '11px',
                color: '#85B7EB',
                textTransform: 'capitalize',
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 8px',
                borderRadius: '20px'
              }}>
                {staff?.role || 'staff'}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  fontSize: '11px',
                  color: '#85B7EB',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div style={{ padding: collapsed ? '0.5rem 0' : '0.5rem 1rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
              color: '#B5D4F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ background: '#f1efe8', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}