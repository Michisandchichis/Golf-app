import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const SUPABASE_URL = 'https://gvxyjofsqyqdrjorlydy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eHlqb2ZzcXlxZHJqb3JseWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMjkzMzMsImV4cCI6MjA5NjgwNTMzM30.TUgwjNWfMZhXksP0SpwmzkeJZtPygsR_oCLTGWCQQuI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  course_name: string;
  total_score: number;
  total_par: number;
  total_holes: number;
  date: string;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
};
