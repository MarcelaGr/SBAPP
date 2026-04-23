import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { createNotification } from '../lib/notifications'

export function useChatNotifications(staff, currentPage) {
  const [notifications, setNotifications] = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!staff?.id || !isSupabaseConfigured) return undefined

    async function enrichMessageNotification(messageRow) {
      if (!messageRow?.channel_id || messageRow.sender_id === staff.id) return

      const [{ data: channel }, { data: sender }] = await Promise.all([
        supabase.from('message_channels').select('*').eq('id', messageRow.channel_id).maybeSingle(),
        supabase.from('staff').select('full_name, initials').eq('id', messageRow.sender_id).maybeSingle(),
      ])

      let title = channel?.name || 'New message'
      let entityType = 'message_channel'

      if (channel?.channel_type === 'direct') {
        title = sender?.full_name || 'New direct message'
      }

      if (channel?.case_id) {
        const { data: linkedCase } = await supabase
          .from('cases')
          .select('id, sb_number')
          .eq('id', channel.case_id)
          .maybeSingle()

        if (linkedCase?.sb_number) {
          title = `Case chat ${linkedCase.sb_number}`
          entityType = 'case'
        }
      }

      setNotifications((prev) => {
        const alreadyExists = prev.some((item) => item.entityId === messageRow.id)
        if (alreadyExists) return prev

        return [
          createNotification({
            type: 'message',
            title,
            body: `${sender?.full_name || 'Someone'}: ${messageRow.body || ''}`,
            entityType,
            entityId: messageRow.id,
          }),
          ...prev,
        ].slice(0, 25)
      })
    }

    channelRef.current = supabase
      .channel(`chat-notifications:${staff.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          enrichMessageNotification(payload.new)
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [currentPage, staff?.id])

  return {
    notifications,
    unreadCount: currentPage === 'messages' ? 0 : notifications.filter((item) => !item.read).length,
    markAllRead() {
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    },
    dismissNotification(id) {
      setNotifications((prev) => prev.filter((item) => item.id !== id))
    },
  }
}
