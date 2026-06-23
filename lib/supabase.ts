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
  local_round_id?: number | null;
  gir_pct?: number | null;
  fw_pct?: number | null;
  avg_putts?: number | null;
  scrambling_pct?: number | null;
  penalties?: number | null;
  profiles?: Profile;
};

export type Like = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Achievement = {
  id: string;
  user_id: string;
  milestone_key: string;
  achieved_at: string;
  round_score: number;
  local_round_id?: number | null;
  shared: boolean;
  shared_post_id?: string | null;
  created_at: string;
};

export type Clubhouse = {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  is_public: boolean;
  settings: { can_members_invite: boolean; can_members_create_events: boolean };
  created_at: string;
};

export type ClubhouseMember = {
  id: string;
  clubhouse_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'invited' | 'active' | 'pending';
  invited_by: string | null;
  created_at: string;
  profiles?: Profile;
  clubhouses?: Clubhouse;
};

export type Availability = {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: 'available' | 'maybe';
  notes: string | null;
  created_at: string;
  profiles?: Profile;
};

export type GolfEvent = {
  id: string;
  clubhouse_id: string | null;
  creator_id: string;
  title: string;
  course_name: string | null;
  event_date: string;
  tee_time: string | null;
  format: 'stroke' | 'skins' | 'scramble' | 'match' | 'casual';
  max_players: number | null;
  is_public: boolean;
  notes: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  created_at: string;
  clubhouses?: Clubhouse;
};

export type EventRsvp = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'invited' | 'going' | 'maybe' | 'declined';
  created_at: string;
  profiles?: Profile;
};

export type EventMessage = {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles?: Profile;
};
