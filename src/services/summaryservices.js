import { supabase } from '../config/supabaseClient'

export const summaryService = {
  // PRL creates summary report
  async createSummaryReport(summaryData) {
    const { data, error } = await supabase
      .from('summary_reports')
      .insert(summaryData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // PRL gets their summary reports
  async getPRLSummaryReports(prlId) {
    const { data, error } = await supabase
      .from('summary_reports')
      .select(`
        *,
        program_leader:users!summary_reports_program_leader_id_fkey(full_name, email),
        course:courses(*),
        feedback:pl_feedback(*)
      `)
      .eq('prl_id', prlId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // PL views summary reports sent to them
  async getPLSummaryReports(plId) {
    const { data, error } = await supabase
      .from('summary_reports')
      .select(`
        *,
        prl:users!summary_reports_prl_id_fkey(full_name, email),
        course:courses(*),
        feedback:pl_feedback(*)
      `)
      .eq('program_leader_id', plId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // PL adds feedback on summary report
  async addPLFeedback(feedbackData) {
    const { data, error } = await supabase
      .from('pl_feedback')
      .insert(feedbackData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}