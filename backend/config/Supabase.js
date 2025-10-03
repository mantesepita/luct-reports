const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for backend!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

module.exports = supabase