import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
).trim()

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseKey)

const nonBlockingLock = async (_name, _timeout, acquire) => acquire()

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        lock: nonBlockingLock,
      },
    })
  : null

export function createNoSessionSupabaseClient() {
  if (!hasSupabaseEnv) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      lock: nonBlockingLock,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
