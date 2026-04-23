import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { isAdminRole } from '../lib/roles'

export default function Messages({ staff }) {
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const chatEndRef = useRef()
  const realtimeRef = useRef()

  function mergeMessage(incomingMessage) {
    if (!incomingMessage?.id) return

    setMessages((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === incomingMessage.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], ...incomingMessage }
        return next
      }

      return [...prev, incomingMessage].sort(
        (left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0)
      )
    })
  }

  useEffect(() => {
    fetchAllStaff()
    fetchChannels()
  }, [])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (!activeChannel) return
    fetchMessages(activeChannel.id)
    fetchMembers(activeChannel.id)

    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current)
      realtimeRef.current = null
    }

    realtimeRef.current = supabase
      .channel(`messages:${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${activeChannel.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((item) => item.id !== payload.old.id))
            return
          }

          const { data } = await supabase
            .from('messages')
            .select('*, sender:sender_id(full_name, initials, role)')
            .eq('id', payload.new.id)
            .maybeSingle()

          if (data) mergeMessage(data)
        }
      )
      .subscribe()

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current)
        realtimeRef.current = null
      }
    }
  }, [activeChannel])

  async function fetchAllStaff() {
    const { data } = await supabase.from('staff').select('*').eq('active', true).order('full_name')
    setAllStaff(data || [])
  }

  async function fetchChannels() {
    setLoading(true)
    setError('')
    // Get all channels this user is a member of
    const { data: memberOf, error: memberError } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('staff_id', staff?.id)

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    const channelIds = (memberOf || []).map(m => m.channel_id)

    // Also get group channels (everyone has access)
    const { data: groupChannels } = await supabase
      .from('message_channels')
      .select('*')
      .eq('channel_type', 'group')
      .order('name')

    // Get DM channels for this user
    let dmChannels = []
    if (channelIds.length > 0) {
      const { data } = await supabase
        .from('message_channels')
        .select('*')
        .eq('channel_type', 'direct')
        .in('id', channelIds)
      dmChannels = data || []
    }

    // For each DM, get the other person's name
    const dmsWithNames = await Promise.all(dmChannels.map(async dm => {
      const { data: mems } = await supabase
        .from('channel_members')
        .select('staff:staff_id(full_name, initials, role)')
        .eq('channel_id', dm.id)
        .neq('staff_id', staff?.id)
      const other = mems?.[0]?.staff
      return { ...dm, displayName: other?.full_name || 'Unknown', otherInitials: other?.initials || '??' }
    }))

    // Ensure user is member of group channels
    for (const gc of groupChannels || []) {
      const isMember = channelIds.includes(gc.id)
      if (!isMember) {
        await supabase.from('channel_members').upsert({ channel_id: gc.id, staff_id: staff?.id }, { onConflict: 'channel_id,staff_id' })
      }
    }

    const allChannels = [
      ...dmsWithNames,
      ...(groupChannels || []).map(gc => ({ ...gc, displayName: gc.name }))
    ]

    setChannels(allChannels)
    if (allChannels.length > 0 && !activeChannel) setActiveChannel(allChannels[0])
    setLoading(false)
  }

  async function fetchMessages(channelId) {
    setMessagesLoading(true)
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, initials, role)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      setError(fetchError.message)
    }

    setMessages(data || [])
    setMessagesLoading(false)
  }

  async function fetchMembers(channelId) {
    const { data } = await supabase
      .from('channel_members')
      .select('staff:staff_id(full_name, initials, role)')
      .eq('channel_id', channelId)
    setMembers((data || []).map(m => m.staff))
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChannel || sending) return

    setSending(true)
    setError('')

    const body = newMessage.trim()
    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage = {
      id: optimisticId,
      channel_id: activeChannel.id,
      sender_id: staff?.id,
      body,
      created_at: new Date().toISOString(),
      sender: {
        full_name: staff?.full_name,
        initials: staff?.initials,
        role: staff?.role,
      },
    }

    mergeMessage(optimisticMessage)
    setNewMessage('')

    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        channel_id: activeChannel.id,
        sender_id: staff?.id,
        body,
      })
      .select('*, sender:sender_id(full_name, initials, role)')
      .single()

    if (sendError) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
      setNewMessage(body)
      setError(sendError.message)
      setSending(false)
      return
    }

    setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
    mergeMessage(data)
    await supabase.from('message_channels').update({ last_message_at: data.created_at }).eq('id', activeChannel.id)
    setChannels((prev) => {
      const next = prev.map((channel) => channel.id === activeChannel.id ? { ...channel, last_message_at: data.created_at } : channel)
      return next.sort((left, right) => new Date(right.last_message_at || 0) - new Date(left.last_message_at || 0))
    })
    setSending(false)
  }

  async function startDM(otherStaffId) {
    // Check if DM already exists between these two users
    const { data: myChannels } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('staff_id', staff?.id)

    const myChannelIds = (myChannels || []).map(m => m.channel_id)

    if (myChannelIds.length > 0) {
      const { data: theirChannels } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('staff_id', otherStaffId)
        .in('channel_id', myChannelIds)

      // Find direct channel in common
      for (const c of theirChannels || []) {
        const { data: ch } = await supabase
          .from('message_channels')
          .select('*')
          .eq('id', c.channel_id)
          .eq('channel_type', 'direct')
          .single()
        if (ch) {
          const other = allStaff.find(s => s.id === otherStaffId)
          const existing = { ...ch, displayName: other?.full_name, otherInitials: other?.initials }
          setActiveChannel(existing)
          setShowNewDM(false)
          return
        }
      }
    }

    // Create new DM channel
    const { data: newChannel } = await supabase
      .from('message_channels')
      .insert({ channel_type: 'direct' })
      .select()
      .single()

    if (newChannel) {
      await supabase.from('channel_members').upsert([
        { channel_id: newChannel.id, staff_id: staff?.id },
        { channel_id: newChannel.id, staff_id: otherStaffId },
      ], { onConflict: 'channel_id,staff_id' })
      const other = allStaff.find(s => s.id === otherStaffId)
      const ch = { ...newChannel, displayName: other?.full_name, otherInitials: other?.initials }
      setChannels(prev => [ch, ...prev])
      setActiveChannel(ch)
    }
    setShowNewDM(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const isGroup = activeChannel?.channel_type === 'group'
  const isMine = (msg) => msg.sender_id === staff?.id

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const avatarColor = (initials) => {
    const colors = [
      { bg: '#E6F1FB', color: '#0C447C', border: '#B5D4F4' },
      { bg: '#E1F5EE', color: '#085041', border: '#9FE1CB' },
      { bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
      { bg: '#EEEDFE', color: '#3C3489', border: '#CECBF6' },
      { bg: '#FAECE7', color: '#712B13', border: '#F5C4B3' },
    ]
    const idx = (initials?.charCodeAt(0) || 0) % colors.length
    return colors[idx]
  }

  const dmStaff = allStaff.filter(s => s.id !== staff?.id)
  const filteredStaff = dmStaff.filter(s =>
    [s.full_name, s.initials, s.role]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ height: 'calc(100vh - 0px)', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' }}>

        {/* ── Thread list ── */}
        <div style={{ borderRight: '0.5px solid #d3d1c7', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '1rem', borderBottom: '0.5px solid #d3d1c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>Messages</div>
            <button onClick={() => setShowNewDM(true)}
              style={{ width: '28px', height: '28px', border: '0.5px solid #d3d1c7', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f5e5a' }}
              title="New message">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            </button>
          </div>

          {/* Channel list */}
          <div style={{ overflow: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '1rem', fontSize: '13px', color: '#888780' }}>Loading...</div>
            ) : error ? (
              <div style={{ padding: '1rem', fontSize: '13px', color: '#a32d2d' }}>{error}</div>
            ) : (
              <>
                {/* Direct messages */}
                {channels.filter(c => c.channel_type === 'direct').length > 0 && (
                  <>
                    <div style={{ padding: '6px 1rem', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780', background: '#f1efe8' }}>
                      Direct messages
                    </div>
                    {channels.filter(c => c.channel_type === 'direct').map(ch => {
                      const ac = avatarColor(ch.otherInitials)
                      const isActive = activeChannel?.id === ch.id
                      return (
                        <div key={ch.id} onClick={() => setActiveChannel(ch)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 1rem', cursor: 'pointer', background: isActive ? '#E6F1FB' : '#fff', borderBottom: '0.5px solid #f1efe8' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5f4f0' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#E6F1FB' : '#fff' }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: ac.color, border: `1.5px solid ${ac.border}`, flexShrink: 0 }}>
                            {ch.otherInitials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.displayName}</div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Group channels */}
                {channels.filter(c => c.channel_type === 'group').length > 0 && (
                  <>
                    <div style={{ padding: '6px 1rem', fontSize: '10px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780', background: '#f1efe8' }}>
                      Group channels
                    </div>
                    {channels.filter(c => c.channel_type === 'group').map(ch => {
                      const isActive = activeChannel?.id === ch.id
                      return (
                        <div key={ch.id} onClick={() => setActiveChannel(ch)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 1rem', cursor: 'pointer', background: isActive ? '#E6F1FB' : '#fff', borderBottom: '0.5px solid #f1efe8' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5f4f0' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#E6F1FB' : '#fff' }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1efe8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#888780', border: '1.5px solid #d3d1c7', flexShrink: 0 }}>
                            #
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{ch.displayName}</div>
                            <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>{members.length} members</div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#f1efe8', overflow: 'hidden' }}>

          {activeChannel ? (
            <>
              {/* Chat header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid #d3d1c7', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isGroup ? (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1efe8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#888780', border: '1.5px solid #d3d1c7' }}>#</div>
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: '#0C447C', border: '1.5px solid #B5D4F4' }}>
                      {activeChannel.otherInitials}
                    </div>
                  )}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>{activeChannel.displayName}</div>
                      <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>
                        {isGroup ? `${members.length} members` : isAdminRole(staff?.role) ? 'Direct message' : 'Secure staff message'}
                      </div>
                    </div>
                  </div>
                {isGroup && (
                  <div style={{ display: 'flex', gap: '-4px' }}>
                    {members.slice(0, 4).map((m, i) => {
                      const ac = avatarColor(m?.initials)
                      return (
                        <div key={i} title={m?.full_name}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '500', color: ac.color, border: `1.5px solid #fff`, marginLeft: i > 0 ? '-6px' : 0 }}>
                          {m?.initials}
                        </div>
                      )
                    })}
                    {members.length > 4 && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1efe8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#888780', border: '1.5px solid #fff', marginLeft: '-6px' }}>+{members.length - 4}</div>}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                {messagesLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: '13px' }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#b4b2a9', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(([date, dayMsgs]) => (
                    <div key={date}>
                      {/* Date divider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '1rem 0 0.75rem' }}>
                        <div style={{ flex: 1, height: '0.5px', background: '#d3d1c7' }} />
                        <div style={{ fontSize: '11px', color: '#888780', whiteSpace: 'nowrap', background: '#f1efe8', padding: '0 8px' }}>
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div style={{ flex: 1, height: '0.5px', background: '#d3d1c7' }} />
                      </div>

                      {/* Messages for this day */}
                      {dayMsgs.map((msg, idx) => {
                        const mine = isMine(msg)
                        const ac = avatarColor(msg.sender?.initials)
                        const prevMsg = dayMsgs[idx - 1]
                        const sameAuthor = prevMsg && prevMsg.sender_id === msg.sender_id
                        return (
                          <div key={msg.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row', marginBottom: '6px', marginTop: sameAuthor ? '2px' : '12px' }}>
                            {/* Avatar */}
                            {!sameAuthor ? (
                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: mine ? '#0C447C' : ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', color: mine ? '#fff' : ac.color, border: mine ? 'none' : `1.5px solid ${ac.border}`, flexShrink: 0 }}>
                                {msg.sender?.initials}
                              </div>
                            ) : (
                              <div style={{ width: '30px', flexShrink: 0 }} />
                            )}

                            <div style={{ maxWidth: '65%' }}>
                              {!sameAuthor && !mine && (
                                <div style={{ fontSize: '11px', color: '#888780', marginBottom: '3px', paddingLeft: '2px' }}>
                                  {msg.sender?.full_name}
                                </div>
                              )}
                              <div style={{
                                padding: '9px 13px',
                                borderRadius: mine ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                                background: mine ? '#0C447C' : '#fff',
                                border: mine ? 'none' : '0.5px solid #d3d1c7',
                                fontSize: '13px',
                                color: mine ? '#fff' : '#2c2c2a',
                                lineHeight: '1.5',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}>
                                {msg.body}
                              </div>
                              <div style={{ fontSize: '10px', color: '#b4b2a9', marginTop: '3px', textAlign: mine ? 'right' : 'left', paddingLeft: mine ? 0 : '2px' }}>
                                {formatTime(msg.created_at)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '1rem', background: '#fff', borderTop: '0.5px solid #d3d1c7', flexShrink: 0 }}>
                {error && (
                  <div style={{ marginBottom: '0.75rem', background: '#fcebeb', border: '0.5px solid #f09595', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#a32d2d' }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, border: '0.5px solid #b4b2a9', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                    <textarea
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${activeChannel.displayName}...`}
                      rows={1}
                      style={{ width: '100%', padding: '10px 14px', border: 'none', fontSize: '13px', fontFamily: 'sans-serif', color: '#2c2c2a', background: 'transparent', resize: 'none', outline: 'none', boxSizing: 'border-box', maxHeight: '120px' }}
                    />
                  </div>
                  <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', background: sending || !newMessage.trim() ? '#b4b2a9' : '#0C447C', border: 'none', cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#b4b2a9', marginTop: '5px' }}>Enter to send · Shift+Enter for new line</div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: '#b4b2a9' }}>
              <div style={{ fontSize: '32px' }}>💬</div>
              <div style={{ fontSize: '13px' }}>Select a conversation to start messaging</div>
            </div>
          )}
        </div>
      </div>

      {/* New DM modal */}
      {showNewDM && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '340px', padding: '1.25rem', border: '0.5px solid #d3d1c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#2c2c2a' }}>New message</div>
              <button onClick={() => setShowNewDM(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#888780', cursor: 'pointer' }}>✕</button>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search team members..."
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #b4b2a9', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'sans-serif', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {filteredStaff.map(s => {
                const ac = avatarColor(s.initials)
                return (
                  <div key={s.id} onClick={() => { startDM(s.id); setSearch('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1efe8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: ac.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: ac.color, border: `1.5px solid ${ac.border}`, flexShrink: 0 }}>
                      {s.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c2c2a' }}>{s.full_name}</div>
                      <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize' }}>{s.role}</div>
                    </div>
                  </div>
                )
              })}
              {filteredStaff.length === 0 && (
                <div style={{ fontSize: '13px', color: '#b4b2a9', textAlign: 'center', padding: '1rem' }}>No staff found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
