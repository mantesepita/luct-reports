import { supabase } from '../config/supabaseClient'

export const ratingService = {
  // Student rates lecturer
  async ratelecturer(ratingData) {
    const { data, error } = await supabase
      .from('student_ratings')
      .upsert(ratingData, {
        onConflict: 'student_id,lecturer_id,class_id'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Get ratings for a lecturer
  async getLecturerRatings(lecturerId) {
    const { data, error } = await supabase
      .from('student_ratings')
      .select(`
        *,
        student:users!student_ratings_student_id_fkey(full_name),
        class:classes(class_name, course:courses(course_name))
      `)
      .eq('lecturer_id', lecturerId)
    
    if (error) throw error
    return data
  },

  // Lecturer self-rating
  async submitLecturerRating(ratingData) {
    const { data, error } = await supabase
      .from('lecturer_ratings')
      .insert(ratingData)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // PRL rates lecturer
  async submitPRLRating(ratingData) {
    const { data, error } = await supabase
      .from('prl_ratings')
      .insert(ratingData)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}