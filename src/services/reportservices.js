import { supabase } from '../config/supabaseClient'

export const reportService = {
  // Lecturer submits report
  async createLectureReport(reportData) {
    const { data, error } = await supabase
      .from('lecture_reports')
      .insert(reportData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get reports for a lecturer
  async getLecturerReports(lecturerId) {
    const { data, error } = await supabase
      .from('lecture_reports')
      .select(`
        *,
        class:classes(*),
        course:courses(*),
        feedback:prl_feedback(*)
      `)
      .eq('lecturer_id', lecturerId)
      .order('date_of_lecture', { ascending: false })
    
    if (error) throw error
    return data
  },

  // PRL views all reports in their courses
  async getPRLReports(prlId) {
    const { data, error } = await supabase
      .from('lecture_reports')
      .select(`
        *,
        lecturer:users!lecture_reports_lecturer_id_fkey(full_name, email),
        class:classes(*),
        course:courses!inner(*),
        feedback:prl_feedback(*)
      `)
      .eq('course.principal_lecturer_id', prlId)
      .order('date_of_lecture', { ascending: false })
    
    if (error) throw error
    return data
  },

  // PRL adds feedback
  async addPRLFeedback(feedbackData) {
    const { data, error } = await supabase
      .from('prl_feedback')
      .insert(feedbackData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}