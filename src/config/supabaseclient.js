import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables!")
  console.error("Make sure your .env file has:")
  console.error("REACT_APP_SUPABASE_URL=your_url")
  console.error("REACT_APP_SUPABASE_ANON_KEY=your_key")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)