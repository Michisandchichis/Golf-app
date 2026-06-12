import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase, Post } from '../../lib/supabase';

const GREEN = '#2d6a2d';

export default function SocialScreen() {
  const [tab, setTab] = useState<'feed' | 'discover'>('feed');
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [])
  );

  async function loadFeed(pull = false) {
    if (pull) setRefreshing(true);
    else setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const ids = (follows ?? []).map((f: any) => f.following_id);
    ids.push(user.id);

    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(50);

    setFeedPosts((posts as Post[]) ?? []);
    if (pull) setRefreshing(false);
    else setLoading(false);
  }

  async function search(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q.trim()}%`)
      .limit(20);
    setSearchResults(data ?? []);
  }

  function scoreToPar(score: number, par: number) {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  function renderPost({ item }: { item: Post }) {
    const username = (item.profiles as any)?.username ?? 'golfer';
    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => router.push(`/profile/${item.user_id}` as any)}
      >
        <View style={styles.postHeader}>
          <Text style={styles.postUsername}>@{username}</Text>
          <Text style={styles.postDate}>{item.date}</Text>
        </View>
        <Text style={styles.postCourse}>{item.course_name}</Text>
        <View style={styles.postStats}>
          <Text style={styles.postScore}>{item.total_score}</Text>
          <Text style={styles.postPar}>{scoreToPar(item.total_score, item.total_par)}</Text>
          <Text style={styles.postHoles}>{item.total_holes} holes</Text>
        </View>
        {item.notes ? <Text style={styles.postNotes}>{item.notes}</Text> : null}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {(['feed', 'discover'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'feed' ? 'Feed' : 'Discover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' ? (
        loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={GREEN} size="large" />
        ) : (
          <FlatList
            data={feedPosts}
            keyExtractor={(p) => p.id}
            renderItem={renderPost}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={GREEN} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>⛳</Text>
                <Text style={styles.emptyTitle}>Your feed is empty</Text>
                <Text style={styles.emptySub}>
                  Follow other golfers in the Discover tab to see their rounds here
                </Text>
              </View>
            }
          />
        )
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            value={searchQuery}
            onChangeText={search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FlatList
            data={searchResults}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => router.push(`/profile/${item.id}` as any)}
              >
                <Text style={styles.userAvatar}>🏌️</Text>
                <Text style={styles.userUsername}>@{item.username}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchQuery.length >= 2 ? (
                <Text style={styles.noResults}>No users found</Text>
              ) : null
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabBtnText: { fontSize: 15, color: '#999' },
  tabBtnTextActive: { color: GREEN, fontWeight: '600' },
  list: { padding: 16 },
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
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  postUsername: { fontWeight: '600', color: GREEN, fontSize: 14 },
  postDate: { color: '#aaa', fontSize: 13 },
  postCourse: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  postStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  postScore: { fontSize: 24, fontWeight: 'bold', color: GREEN },
  postPar: { fontSize: 16, color: '#555' },
  postHoles: { fontSize: 13, color: '#999', marginLeft: 4 },
  postNotes: { marginTop: 8, fontSize: 13, color: '#666', fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  userAvatar: { fontSize: 22 },
  userUsername: { fontSize: 15, color: '#222', fontWeight: '500' },
  noResults: { textAlign: 'center', color: '#999', marginTop: 24, fontSize: 14 },
});
