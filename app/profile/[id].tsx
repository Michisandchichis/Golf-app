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
import { colors, fonts, spacing, radius, shadow, typography } from '../../lib/theme';
import { ALL_MILESTONES, RARITY_META, MilestoneDefinition } from '../../lib/achievements';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [recentUnlocked, setRecentUnlocked] = useState<MilestoneDefinition[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
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

    const [profileRes, postsRes, followRes, achievementsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('posts').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      user
        ? supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('achievements').select('milestone_key, achieved_at').eq('user_id', id).order('achieved_at', { ascending: false }),
    ]);

    setProfile(profileRes.data);
    setPosts((postsRes.data as Post[]) ?? []);
    setIsFollowing(!!followRes.data);
    const unlockedRows = achievementsRes.data ?? [];
    setUnlockedCount(unlockedRows.length);
    setRecentUnlocked(
      unlockedRows
        .slice(0, 5)
        .map((a: any) => ALL_MILESTONES.find((m) => m.key === a.milestone_key))
        .filter((m): m is MilestoneDefinition => !!m)
    );
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
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.gold} size="large" />
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
            <View style={styles.avatarRing}>
              <Text style={styles.avatar}>🏌️</Text>
            </View>
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

            <Text style={styles.sectionLabel}>Recently Unlocked</Text>
            {recentUnlocked.length > 0 ? (
              <View style={styles.honorsRow}>
                {recentUnlocked.map((m) => (
                  <View key={m.key} style={[styles.honorBadge, styles.honorBadgeUnlocked, { borderColor: RARITY_META[m.rarity].color }]}>
                    <Text style={styles.honorIcon}>{m.icon}</Text>
                    <Text style={styles.honorLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noHonorsYet}>No honors unlocked yet</Text>
            )}

            <TouchableOpacity
              style={styles.trophyCaseBtn}
              onPress={() => router.push({ pathname: '/profile/trophies', params: { id } })}
            >
              <Text style={styles.trophyCaseBtnText}>View Trophy Case ({unlockedCount}) →</Text>
            </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  back: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodyMedium },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  profileSection: { alignItems: 'center', paddingVertical: 28 },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  avatar: { fontSize: 44 },
  username: { fontSize: 24, fontFamily: fonts.heading, color: colors.offWhite, marginTop: 14 },
  roundCount: { fontSize: 14, color: colors.gray, marginTop: 4, marginBottom: 18 },
  followBtn: {
    backgroundColor: colors.emerald,
    borderRadius: radius.pill,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginBottom: 28,
  },
  followBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.gold },
  followingBtnText: { color: colors.gold },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 32,
    paddingVertical: 9,
    marginBottom: 28,
  },
  signOutText: { color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  sectionLabel: { ...typography.label, alignSelf: 'flex-start' },
  honorsRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: spacing.sm, marginBottom: 24,
  },
  honorBadge: {
    width: 76, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5,
    paddingVertical: 12, paddingHorizontal: 4, backgroundColor: colors.bgSecondary,
  },
  honorBadgeUnlocked: { borderColor: colors.gold, ...shadow.goldGlow },
  honorBadgeLocked: { borderColor: colors.hairline, opacity: 0.35 },
  honorIcon: { fontSize: 28, marginBottom: 4 },
  honorIconLocked: { opacity: 0.6 },
  honorLabel: { fontSize: 10, fontFamily: fonts.bodyMedium, color: colors.offWhite, textAlign: 'center' },
  noHonorsYet: { color: colors.gray, fontSize: 13, marginBottom: 16 },
  trophyCaseBtn: {
    borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.pill,
    paddingHorizontal: 24, paddingVertical: 10, marginBottom: 24,
  },
  trophyCaseBtnText: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  postCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  postCourse: { fontSize: 17, fontFamily: fonts.heading, color: colors.offWhite, marginBottom: 6 },
  postStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  postScore: { fontSize: 24, fontFamily: fonts.bodySemiBold, color: colors.gold },
  postPar: { fontSize: 16, color: colors.gray },
  postHoles: { fontSize: 13, color: colors.gray },
  postDate: { fontSize: 12, color: colors.gray },
  postNotes: { marginTop: 6, fontSize: 13, color: colors.gray, fontStyle: 'italic' },
  noRounds: { textAlign: 'center', color: colors.gray, marginTop: 24, fontSize: 14 },
});
