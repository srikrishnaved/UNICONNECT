import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://qoseoqvdwiaqdkmivrxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvc2VvcXZkd2lhcWRrbWl2cnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE0NzcsImV4cCI6MjA5NjMyNzQ3N30.2ykDB6h_VYClR6yxHuqK0N3UTpztBYcTTK7wvO5tGoY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
