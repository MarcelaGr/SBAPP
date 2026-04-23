import { useState } from 'react'
import { supabase } from './supabaseClient'
import { isAdminRole } from './lib/roles'
import logoImage from './assets/logo.png'

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

export default function Layout({
  user,
  staff,
  children,
  currentPage,
  setCurrentPage,
  notifications = [],
  unreadNotifications = 0,
  onOpenNotifications,
  onDismissNotification,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  function toggleNotifications() {
    const nextValue = !showNotifications
    setShowNotifications(nextValue)
    if (nextValue) onOpenNotifications?.()
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: collapsed ? '56px 1fr' : '216px 1fr',
      minHeight: '100vh',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      transition: 'grid-template-columns 0.25s ease'
    }}>

      {/* ── Sidebar ── */}
      <div style={{
        background: 'linear-gradient(180deg, #0a3a6e 0%, #0C447C 40%, #0d4d8f 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.25s ease',
        boxShadow: '2px 0 12px rgba(0,0,0,0.18)',
        position: 'relative',
      }}>

        {/* Subtle texture overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo area */}
          <div style={{
            padding: collapsed ? '1.25rem 0.75rem' : '1.5rem 1.25rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '0.5rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            {!collapsed ? (
              <div>
                <img
                  src={logoImage}
                  alt="Stone Busailah LLP"
                  style={{
                    display: 'block',
                    width: '148px',
                    maxWidth: '100%',
                    height: 'auto',
                    filter: 'brightness(0) invert(1)',
                    opacity: 0.95,
                  }}
                />
                <div style={{
                  color: 'rgba(181,212,244,0.7)',
                  fontSize: '10.5px',
                  marginTop: '6px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Pasadena, CA
                </div>
              </div>
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '700',
                fontSize: '13px',
                letterSpacing: '-0.5px',
              }}>
                SB
              </div>
            )}
          </div>

          {/* Nav section label */}
          {!collapsed && (
            <div style={{
              padding: '0 1.25rem 6px',
              fontSize: '10px',
              fontWeight: '600',
              color: 'rgba(181,212,244,0.5)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Navigation
            </div>
          )}

          {/* Nav items */}
          {navItems.map(item => {
            if (item.adminOnly && !isAdminRole(staff?.role)) return null
            const isActive = currentPage === item.key
            return (
              <div
                key={item.key}
                onClick={() => setCurrentPage(item.key)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: collapsed ? '9px 0' : '9px 1.25rem',
                  margin: '1px 8px',
                  fontSize: '13.5px',
                  color: isActive ? '#fff' : 'rgba(181,212,244,0.8)',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  background: isActive
                    ? 'rgba(255,255,255,0.14)'
                    : 'transparent',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'background 0.15s, color 0.15s',
                  fontWeight: isActive ? '500' : '400',
                  borderLeft: isActive ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.8 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </div>
            )
          })}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* User info + sign out */}
          {!collapsed && (
            <div style={{
              margin: '0 8px',
              padding: '0.75rem 1rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '8px 8px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '600',
                  flexShrink: 0,
                }}>
                  {(staff?.full_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {staff?.full_name || user?.email}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    color: 'rgba(181,212,244,0.7)',
                    textTransform: 'capitalize',
                  }}>
                    {staff?.role || 'staff'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={toggleNotifications}
                  style={{
                    position: 'relative',
                    fontSize: '11px',
                    color: 'rgba(181,212,244,0.8)',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                  title="Notifications"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2a5 5 0 0 1 5 5v3l1.5 2.5H1.5L3 10V7a5 5 0 0 1 5-5zM6 13.5a2 2 0 0 0 4 0"/>
                  </svg>
                  Alerts
                  {unreadNotifications > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-8px',
                      minWidth: '16px',
                      height: '16px',
                      borderRadius: '999px',
                      background: '#FAC775',
                      color: '#633806',
                      fontSize: '9px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}>
                      {unreadNotifications}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => supabase.auth.signOut()}
                  style={{
                    fontSize: '11px',
                    color: 'rgba(181,212,244,0.7)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}

          {/* Collapse toggle */}
          <div style={{
            padding: collapsed ? '0.75rem 0' : '0.6rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            borderTop: collapsed ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                width: collapsed ? '32px' : '100%',
                height: '30px',
                cursor: 'pointer',
                color: 'rgba(181,212,244,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                gap: collapsed ? 0 : '6px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }}>
                <path d="M9 4l-4 4 4 4"/>
              </svg>
              {!collapsed && <span style={{ fontSize: '11px' }}>Collapse</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ background: '#f1efe8', overflow: 'auto', position: 'relative' }}>
        {showNotifications && !collapsed && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '320px',
            maxHeight: '420px',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e8e6e0',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
            zIndex: 20,
          }}>
            <div style={{
              padding: '1rem 1.1rem',
              borderBottom: '1px solid #f1efe8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a18' }}>Notifications</div>
              <button
                onClick={() => setShowNotifications(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888780', fontSize: '16px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '1.25rem 1rem', fontSize: '13px', color: '#888780', textAlign: 'center' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div key={item.id} style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid #f1efe8',
                  background: item.read ? '#fff' : '#fff8e8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a18' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: '#5f5e5a', marginTop: '3px', lineHeight: '1.5' }}>{item.body || 'New activity'}</div>
                    </div>
                    <button
                      onClick={() => onDismissNotification?.(item.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b4b2a9', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
