import { supabase } from '../config/supabaseClient'

export const monitoringService = {
  // Create monitoring log
  async createMonitoringLog(logData) {
    const { data, error } = await supabase
      .from('monitoring_logs')
      .insert(logData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get monitoring logs (for the user being monitored)
  async getMonitoringLogs(userId) {
    const { data, error } = await supabase
      .from('monitoring_logs')
      .select(`
        *,
        monitored_by_user:users!monitoring_logs_monitored_by_fkey(full_name, role),
        class:classes(class_name, course:courses(course_name))
      `)
      .eq('monitored_user', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Get logs created by a staff member
  async getCreatedLogs(staffId) {
    const { data, error } = await supabase
      .from('monitoring_logs')
      .select(`
        *,
        monitored_user_profile:users!monitoring_logs_monitored_user_fkey(full_name, role),
        class:classes(class_name)
      `)
      .eq('monitored_by', staffId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // Update monitoring log status
  async updateLogStatus(logId, status, actionTaken) {
    const { data, error } = await supabase
      .from('monitoring_logs')
      .update({ status, action_taken: actionTaken })
      .eq('id', logId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}