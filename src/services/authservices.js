import { supabase } from '../config/supabaseClient'

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    
    // Get user profile with role
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    return { user: data.user, profile }
  },

  async register(email, password, fullName, role) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    
    if (error) throw error
    
    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role
      })
    
    if (profileError) throw profileError
    
    return data
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
}