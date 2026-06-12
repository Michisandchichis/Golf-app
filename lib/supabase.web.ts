import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gvxyjofsqyqdrjorlydy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eHlqb2ZzcXlxZHJqb3JseWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMjkzMzMsImV4cCI6MjA5NjgwNTMzM30.TUgwjNWfMZhXksP0SpwmzkeJZtPygsR_oCLTGWCQQuI';

const webStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: webStorage as any,
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
