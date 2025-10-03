import { supabase } from '../config/supabaseClient'

export const assignmentService = {
  // PL assigns module to lecturer
  async assignModuleToLecturer(assignmentData) {
    const { data, error } = await supabase
      .from('lecturer_assignments')
      .insert(assignmentData)
      .select(`
        *,
        lecturer:users!lecturer_assignments_lecturer_id_fkey(full_name, email),
        course:courses(*),
        class:classes(*)
      `)
      .single()
    
    if (error) throw error
    return data
  },

  // Get lecturer's assigned modules
  async getLecturerAssignments(lecturerId) {
    const { data, error } = await supabase
      .from('lecturer_assignments')
      .select(`
        *,
        course:courses(*),
        class:classes(*),
        assigned_by_user:users!lecturer_assignments_assigned_by_fkey(full_name, email)
      `)
      .eq('lecturer_id', lecturerId)
      .eq('status', 'active')
    
    if (error) throw error
    return data
  },

  // PL views all assignments they made
  async getPLAssignments(plId) {
    const { data, error } = await supabase
      .from('lecturer_assignments')
      .select(`
        *,
        lecturer:users!lecturer_assignments_lecturer_id_fkey(full_name, email),
        course:courses(*),
        class:classes(*)
      `)
      .eq('assigned_by', plId)
    
    if (error) throw error
    return data
  }
}