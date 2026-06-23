import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function ProfileTabRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(`/profile/${user.id}` as any);
    });
  }, []);

  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
