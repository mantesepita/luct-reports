import { supabase } from '../config/supabaseClient'

export const notificationService = {
  // Get user notifications
  async getUserNotifications(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:users!notifications_sender_id_fkey(full_name)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Mark notification as read
  async markAsRead(notificationId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Mark all as read
  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)
    
    if (error) throw error
    return data
  },

  // Subscribe to real-time notifications
  subscribeToNotifications(userId, callback) {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
    
    return channel
  }
}