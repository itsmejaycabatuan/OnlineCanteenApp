import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qwtpejlghffjwvgvzumj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pQZEZshtTbRxvW0LyX5KhA_2wluO-e-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});