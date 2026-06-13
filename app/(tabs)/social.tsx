import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase, Post } from '../../lib/supabase';

const GREEN = '#2d6a2d';
const RED = '#c62828';

type FriendRow = { friendshipId: string; userId: string; username: string };
type PendingRow = { friendshipId: string; requesterId: string; username: string };

export default function SocialScreen() {
  const [tab, setTab] = useState<'feed' | 'friends'>('feed');

  // Feed state
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Friends state
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    loadFeed(user.id);
    loadFriendsData(user.id);
  }

  // ─── Feed ────────────────────────────────────────────────────────────────

  async function loadFeed(userId: string, pull = false) {
    if (pull) setRefreshing(true); else setFeedLoading(true);

    const { data: fs } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    const friendIds = (fs ?? []).map((f: any) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );
    friendIds.push(userId);

    const { data: posts } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(50);

    const loaded = (posts as Post[]) ?? [];
    setFeedPosts(loaded);

    if (loaded.length > 0) {
      const postIds = loaded.map(p => p.id);
      const { data: likes } = await supabase
        .from('likes').select('post_id, user_id').in('post_id', postIds);
      const counts: Record<string, number> = {};
      const liked = new Set<string>();
      (likes ?? []).forEach((l: any) => {
        counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
        if (l.user_id === userId) liked.add(l.post_id);
      });
      setLikeCounts(counts);
      setLikedPostIds(liked);
    }

    if (pull) setRefreshing(false); else setFeedLoading(false);
  }

  async function toggleLike(postId: string) {
    if (!currentUserId) return;
    if (likedPostIds.has(postId)) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
      setLikedPostIds(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setLikeCounts(prev => ({ ...prev, [postId]: Math.max((prev[postId] ?? 1) - 1, 0) }));
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
      setLikedPostIds(prev => new Set(prev).add(postId));
      setLikeCounts(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    }
  }

  // ─── Friends ─────────────────────────────────────────────────────────────

  async function loadFriendsData(userId: string) {
    setFriendsLoading(true);
    const { data: all } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    const incoming = (all ?? []).filter((f: any) => f.addressee_id === userId && f.status === 'pending');
    const accepted = (all ?? []).filter((f: any) => f.status === 'accepted');
    const sent = new Set<string>((all ?? [])
      .filter((f: any) => f.requester_id === userId && f.status === 'pending')
      .map((f: any) => f.addressee_id));
    setSentIds(sent);

    const otherIds = [
      ...incoming.map((f: any) => f.requester_id),
      ...accepted.map((f: any) => f.requester_id === userId ? f.addressee_id : f.requester_id),
    ];

    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, username').in('id', otherIds);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));

      setPending(incoming.map((f: any) => ({
        friendshipId: f.id,
        requesterId: f.requester_id,
        username: map.get(f.requester_id) ?? 'golfer',
      })));
      setFriends(accepted.map((f: any) => {
        const fId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return { friendshipId: f.id, userId: fId, username: map.get(fId) ?? 'golfer' };
      }));
    } else {
      setPending([]);
      setFriends([]);
    }
    setFriendsLoading(false);
  }

  async function sendRequest(addresseeId: string) {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships')
      .insert({ requester_id: currentUserId, addressee_id: addresseeId });
    if (!error) setSentIds(prev => new Set(prev).add(addresseeId));
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (currentUserId) { loadFriendsData(currentUserId); loadFeed(currentUserId); }
  }

  async function declineRequest(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    if (currentUserId) loadFriendsData(currentUserId);
  }

  async function removeFriend(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    if (currentUserId) { loadFriendsData(currentUserId); loadFeed(currentUserId); }
  }

  async function search(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles').select('id, username').ilike('username', `%${q.trim()}%`).limit(20);
    setSearchResults((data ?? []).filter((u: any) => u.id !== currentUserId));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function scoreToPar(score: number, par: number) {
    const d = score - par;
    return d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
  }

  function isFriend(userId: string) {
    return friends.some(f => f.userId === userId);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  function renderPost({ item }: { item: Post }) {
    const username = (item.profiles as any)?.username ?? 'golfer';
    const liked = likedPostIds.has(item.id);
    const count = likeCounts[item.id] ?? 0;
    const isMe = item.user_id === currentUserId;
    return (
      <TouchableOpacity style={styles.postCard} onPress={() => router.push(`/profile/${item.user_id}` as any)}>
        <View style={styles.postHeader}>
          <Text style={styles.postUsername}>{isMe ? 'You' : `@${username}`}</Text>
          <Text style={styles.postDate}>{item.date}</Text>
        </View>
        <Text style={styles.postCourse}>{item.course_name}</Text>
        <View style={styles.postScoreRow}>
          <Text style={styles.postScore}>{item.total_score}</Text>
          <Text style={styles.postPar}>{scoreToPar(item.total_score, item.total_par)}</Text>
          <Text style={styles.postHoles}>{item.total_holes} holes</Text>
        </View>
        {(item.gir_pct != null || item.fw_pct != null) && (
          <View style={styles.postStatRow}>
            {item.gir_pct != null && <Text style={styles.postStat}>GIR {item.gir_pct}%</Text>}
            {item.fw_pct != null && <Text style={styles.postStat}>FW {item.fw_pct}%</Text>}
            {item.avg_putts != null && <Text style={styles.postStat}>{item.avg_putts.toFixed(1)} putts/hole</Text>}
            {!!item.penalties && <Text style={[styles.postStat, { color: RED }]}>{item.penalties} pen</Text>}
          </View>
        )}
        {item.notes ? <Text style={styles.postNotes}>{item.notes}</Text> : null}
        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.likeBtn} onPress={e => { e.stopPropagation(); toggleLike(item.id); }}>
            <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
            {count > 0 && <Text style={[styles.likeCount, liked && { color: '#e0415a' }]}>{count}</Text>}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  function renderFriendsTab() {
    const isSearching = searchQuery.length >= 2;
    return (
      <FlatList
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        data={(isSearching ? searchResults : friends) as any[]}
        keyExtractor={(item: any) => item.id ?? item.userId}
        ListHeaderComponent={
          <View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username to add friends..."
              value={searchQuery}
              onChangeText={search}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Pending requests */}
            {!isSearching && pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Friend Requests</Text>
                {pending.map(p => (
                  <View key={p.friendshipId} style={styles.friendRow}>
                    <Text style={styles.friendEmoji}>🏌️</Text>
                    <Text style={styles.friendName}>@{p.username}</Text>
                    <View style={styles.requestBtns}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(p.friendshipId)}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(p.friendshipId)}>
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Current friends header */}
            {!isSearching && (
              <Text style={styles.sectionLabel}>
                {friends.length > 0 ? `Friends · ${friends.length}` : 'No friends yet'}
              </Text>
            )}

            {/* Search results header */}
            {isSearching && searchResults.length === 0 && (
              <Text style={styles.noResults}>No users found</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          if (isSearching) {
            const u = item as { id: string; username: string };
            const alreadyFriend = isFriend(u.id);
            const sent = sentIds.has(u.id);
            return (
              <View style={styles.friendRow}>
                <Text style={styles.friendEmoji}>🏌️</Text>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/profile/${u.id}` as any)}>
                  <Text style={styles.friendName}>@{u.username}</Text>
                </TouchableOpacity>
                {alreadyFriend ? (
                  <Text style={styles.alreadyFriendTag}>Friends ✓</Text>
                ) : sent ? (
                  <Text style={styles.sentTag}>Request sent</Text>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(u.id)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }
          const f = item as FriendRow;
          return (
            <View style={styles.friendRow}>
              <Text style={styles.friendEmoji}>🏌️</Text>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/profile/${f.userId}` as any)}>
                <Text style={styles.friendName}>@{f.username}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeFriend(f.friendshipId)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={!isSearching && !friendsLoading ? (
          <Text style={styles.emptyFriendsSub}>
            Search for golfers above to send a friend request
          </Text>
        ) : null}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {(['feed', 'friends'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === 'feed' ? 'Feed' : `Friends${pending.length > 0 ? ` (${pending.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' ? (
        feedLoading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={GREEN} size="large" />
        ) : (
          <FlatList
            data={feedPosts}
            keyExtractor={p => p.id}
            renderItem={renderPost}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => currentUserId && loadFeed(currentUserId, true)}
                tintColor={GREEN}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>⛳</Text>
                <Text style={styles.emptyTitle}>No rounds in your feed</Text>
                <Text style={styles.emptySub}>
                  Add friends in the Friends tab — their rounds will appear here automatically when logged
                </Text>
              </View>
            }
          />
        )
      ) : renderFriendsTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabBtnText: { fontSize: 15, color: '#999' },
  tabBtnTextActive: { color: GREEN, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  // Post card
  postCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  postUsername: { fontWeight: '600', color: GREEN, fontSize: 14 },
  postDate: { color: '#aaa', fontSize: 13 },
  postCourse: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  postScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  postScore: { fontSize: 26, fontWeight: 'bold', color: GREEN },
  postPar: { fontSize: 16, color: '#555' },
  postHoles: { fontSize: 13, color: '#999', marginLeft: 4 },
  postStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  postStat: { fontSize: 12, color: '#666', backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  postNotes: { marginTop: 8, fontSize: 13, color: '#666', fontStyle: 'italic' },
  postFooter: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  likeIcon: { fontSize: 18 },
  likeCount: { fontSize: 13, color: '#aaa' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 14 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  // Friends tab
  searchInput: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 16,
  },
  section: { marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 8, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  friendEmoji: { fontSize: 20 },
  friendName: { fontSize: 15, color: '#222', fontWeight: '500', flex: 1 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  declineBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  declineBtnText: { color: '#888', fontSize: 13 },
  addBtn: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  alreadyFriendTag: { fontSize: 12, color: GREEN, fontWeight: '600' },
  sentTag: { fontSize: 12, color: '#aaa' },
  removeBtn: { fontSize: 13, color: '#c62828', fontWeight: '500' },
  noResults: { textAlign: 'center', color: '#999', marginTop: 16, fontSize: 14 },
  emptyFriendsSub: { textAlign: 'center', color: '#aaa', fontSize: 13, lineHeight: 20, paddingHorizontal: 24, marginTop: 8 },
});
