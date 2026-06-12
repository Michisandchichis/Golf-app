import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, Post, Profile } from '../../lib/supabase';

const GREEN = '#2d6a2d';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (id) loadProfile();
  }, [id]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [profileRes, postsRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('posts').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      user
        ? supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setProfile(profileRes.data);
    setPosts((postsRes.data as Post[]) ?? []);
    setIsFollowing(!!followRes.data);
    setLoading(false);
  }

  async function toggleFollow() {
    if (!currentUserId) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  }

  function signOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  function scoreToPar(score: number, par: number) {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 48 }} color={GREEN} size="large" />
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUserId === id;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.profileSection}>
            <Text style={styles.avatar}>🏌️</Text>
            <Text style={styles.username}>@{profile?.username ?? 'golfer'}</Text>
            <Text style={styles.roundCount}>
              {posts.length} round{posts.length !== 1 ? 's' : ''} shared
            </Text>

            {isOwnProfile ? (
              <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={toggleFollow}
                disabled={followLoading}
              >
                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {followLoading ? '...' : isFollowing ? 'Following ✓' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}

            {posts.length > 0 && <Text style={styles.sectionLabel}>Shared Rounds</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <Text style={styles.postCourse}>{item.course_name}</Text>
            <View style={styles.postStats}>
              <Text style={styles.postScore}>{item.total_score}</Text>
              <Text style={styles.postPar}>{scoreToPar(item.total_score, item.total_par)}</Text>
              <Text style={styles.postHoles}>{item.total_holes} holes</Text>
            </View>
            <Text style={styles.postDate}>{item.date}</Text>
            {item.notes ? <Text style={styles.postNotes}>{item.notes}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.noRounds}>No rounds shared yet</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  back: { color: GREEN, fontSize: 16, fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  profileSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: { fontSize: 60 },
  username: { fontSize: 24, fontWeight: 'bold', color: '#222', marginTop: 10 },
  roundCount: { fontSize: 14, color: '#888', marginTop: 4, marginBottom: 18 },
  followBtn: {
    backgroundColor: GREEN,
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginBottom: 28,
  },
  followBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: GREEN },
  followingBtnText: { color: GREEN },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: '#d33',
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginBottom: 28,
  },
  signOutText: { color: '#d33', fontWeight: '600', fontSize: 15 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#666', alignSelf: 'flex-start' },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  postCourse: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  postStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  postScore: { fontSize: 24, fontWeight: 'bold', color: GREEN },
  postPar: { fontSize: 16, color: '#555' },
  postHoles: { fontSize: 13, color: '#999' },
  postDate: { fontSize: 12, color: '#aaa' },
  postNotes: { marginTop: 6, fontSize: 13, color: '#666', fontStyle: 'italic' },
  noRounds: { textAlign: 'center', color: '#999', marginTop: 24, fontSize: 14 },
});
