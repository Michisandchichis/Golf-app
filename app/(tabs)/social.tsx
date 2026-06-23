import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase, Post, Clubhouse, ClubhouseMember, Availability } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';
import AvailabilitySheet from '../../components/AvailabilitySheet';

type ClubhouseWithRole = Clubhouse & { myRole: 'admin' | 'member' };
type FriendRow = { friendshipId: string; userId: string; username: string };
type PendingRow = { friendshipId: string; requesterId: string; username: string };
type ClubMemberRow = ClubhouseMember & { profiles?: { username: string } };
type SubTab = 'activity' | 'schedule' | 'members';

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function buildCalendarGrid(month: Date): (Date | null)[][] {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function SocialScreen() {
  const router = useRouter();

  // Clubhouse picker
  const [myClubhouses, setMyClubhouses] = useState<ClubhouseWithRole[]>([]);
  const [selectedClubhouseId, setSelectedClubhouseId] = useState<string | null>(null);
  const selectedClubhouse = myClubhouses.find(c => c.id === selectedClubhouseId) ?? null;

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<SubTab>('activity');

  // Activity tab
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Schedule tab
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [myAvailability, setMyAvailability] = useState<Record<string, Availability>>({});
  const [membersAvailability, setMembersAvailability] = useState<Availability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availSheetVisible, setAvailSheetVisible] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);

  // Members tab (flat friends — "All" view)
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Members tab (clubhouse view)
  const [clubMembers, setClubMembers] = useState<ClubMemberRow[]>([]);
  const [clubPending, setClubPending] = useState<ClubMemberRow[]>([]);
  const [clubInvited, setClubInvited] = useState<ClubMemberRow[]>([]);
  const [clubMembersLoading, setClubMembersLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const todayStr = toDateStr(new Date());

  // ─── Initial load ─────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    await loadMyClubhouses(user.id);
    loadFeed(user.id);
    loadFriendsData(user.id);
  }

  // ─── Reload when picker or tab changes ────────────────────────────────────

  useEffect(() => {
    if (!currentUserId) return;
    loadFeed(currentUserId);
    if (selectedClubhouseId) {
      loadClubMembers(selectedClubhouseId);
    } else {
      loadFriendsData(currentUserId);
    }
  }, [selectedClubhouseId]);

  useEffect(() => {
    if (activeTab === 'schedule' && currentUserId) {
      loadAvailability();
    }
    if (activeTab === 'members') {
      if (selectedClubhouseId) loadClubMembers(selectedClubhouseId);
      else if (currentUserId) loadFriendsData(currentUserId);
    }
  }, [activeTab, calendarMonth]);

  // ─── Load clubhouses ──────────────────────────────────────────────────────

  async function loadMyClubhouses(userId: string) {
    const { data } = await supabase
      .from('clubhouse_members')
      .select('role, clubhouses(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    const clubs: ClubhouseWithRole[] = (data ?? []).map((row: any) => ({
      ...row.clubhouses,
      myRole: row.role,
    }));
    setMyClubhouses(clubs);
  }

  // ─── Activity feed ────────────────────────────────────────────────────────

  async function loadFeed(userId: string, pull = false) {
    if (pull) setRefreshing(true); else setFeedLoading(true);

    let friendIds: string[] = [];

    if (selectedClubhouseId) {
      const { data: cm } = await supabase
        .from('clubhouse_members')
        .select('user_id')
        .eq('clubhouse_id', selectedClubhouseId)
        .eq('status', 'active');
      friendIds = (cm ?? []).map((r: any) => r.user_id);
    } else {
      const { data: fs } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      friendIds = (fs ?? []).map((f: any) =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      );
    }
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

  // ─── Availability ─────────────────────────────────────────────────────────

  async function loadAvailability() {
    if (!currentUserId) return;
    setAvailLoading(true);

    const startDate = toDateStr(calendarMonth);
    const endMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const endDate = toDateStr(endMonth);

    let memberIds: string[] = [];
    if (selectedClubhouseId) {
      const { data: cm } = await supabase
        .from('clubhouse_members')
        .select('user_id')
        .eq('clubhouse_id', selectedClubhouseId)
        .eq('status', 'active');
      memberIds = (cm ?? []).map((r: any) => r.user_id);
    } else {
      const { data: fs } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
      memberIds = (fs ?? []).map((f: any) =>
        f.requester_id === currentUserId ? f.addressee_id : f.requester_id
      );
    }
    memberIds.push(currentUserId);

    const { data } = await supabase
      .from('availability')
      .select('*, profiles(username)')
      .in('user_id', memberIds)
      .gte('date', startDate)
      .lte('date', endDate);

    const mine: Record<string, Availability> = {};
    const others: Availability[] = [];
    (data ?? []).forEach((a: Availability) => {
      if (a.user_id === currentUserId) mine[a.date] = a;
      else others.push(a);
    });
    setMyAvailability(mine);
    setMembersAvailability(others);
    setAvailLoading(false);
  }

  async function saveAvailability(date: string, status: 'available' | 'maybe', startTime: string, endTime: string, notes: string) {
    if (!currentUserId || !date) return;
    await supabase.from('availability').upsert({
      user_id: currentUserId,
      date,
      status,
      start_time: startTime || null,
      end_time: endTime || null,
      notes: notes || null,
    }, { onConflict: 'user_id,date' });
    setAvailSheetVisible(false);
    loadAvailability();
  }

  async function clearAvailability() {
    if (!currentUserId || !selectedDate) return;
    await supabase.from('availability').delete()
      .eq('user_id', currentUserId).eq('date', selectedDate);
    setAvailSheetVisible(false);
    loadAvailability();
  }

  // ─── Friends (flat / "All" view) ─────────────────────────────────────────

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
        friendshipId: f.id, requesterId: f.requester_id, username: map.get(f.requester_id) ?? 'golfer',
      })));
      setFriends(accepted.map((f: any) => {
        const fId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return { friendshipId: f.id, userId: fId, username: map.get(fId) ?? 'golfer' };
      }));
    } else {
      setPending([]); setFriends([]);
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

  // ─── Clubhouse members ────────────────────────────────────────────────────

  async function loadClubMembers(clubhouseId: string) {
    setClubMembersLoading(true);
    const { data } = await supabase
      .from('clubhouse_members')
      .select('*, profiles(username)')
      .eq('clubhouse_id', clubhouseId);

    const active = (data ?? []).filter((m: any) => m.status === 'active');
    const pendingMembers = (data ?? []).filter((m: any) => m.status === 'pending');
    const invited = (data ?? []).filter((m: any) => m.status === 'invited' && m.user_id === currentUserId);

    setClubMembers(active as ClubMemberRow[]);
    setClubPending(pendingMembers as ClubMemberRow[]);
    setClubInvited(invited as ClubMemberRow[]);
    setClubMembersLoading(false);
  }

  async function inviteToClubhouse(userId: string) {
    if (!selectedClubhouseId || !currentUserId) return;
    await supabase.from('clubhouse_members').insert({
      clubhouse_id: selectedClubhouseId,
      user_id: userId,
      role: 'member',
      status: 'invited',
      invited_by: currentUserId,
    });
    setSentIds(prev => new Set(prev).add(userId));
  }

  async function acceptClubhouseInvite(clubhouseId: string) {
    if (!currentUserId) return;
    await supabase.from('clubhouse_members')
      .update({ status: 'active' })
      .eq('clubhouse_id', clubhouseId)
      .eq('user_id', currentUserId);
    await loadMyClubhouses(currentUserId);
    loadClubMembers(clubhouseId);
  }

  async function declineClubhouseInvite(clubhouseId: string) {
    if (!currentUserId) return;
    await supabase.from('clubhouse_members')
      .delete()
      .eq('clubhouse_id', clubhouseId)
      .eq('user_id', currentUserId);
    await loadMyClubhouses(currentUserId);
  }

  async function approveJoinRequest(memberId: string) {
    await supabase.from('clubhouse_members')
      .update({ status: 'active' })
      .eq('id', memberId);
    if (selectedClubhouseId) loadClubMembers(selectedClubhouseId);
  }

  async function removeFromClubhouse(memberId: string) {
    await supabase.from('clubhouse_members').delete().eq('id', memberId);
    if (selectedClubhouseId) loadClubMembers(selectedClubhouseId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function scoreToPar(score: number, par: number) {
    const d = score - par;
    return d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
  }

  function isFriend(userId: string) {
    return friends.some(f => f.userId === userId);
  }

  // ─── Render: Activity ─────────────────────────────────────────────────────

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
            {!!item.penalties && <Text style={[styles.postStat, { color: colors.danger }]}>{item.penalties} pen</Text>}
          </View>
        )}
        {item.notes ? <Text style={styles.postNotes}>{item.notes}</Text> : null}
        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.likeBtn} onPress={e => { e.stopPropagation(); toggleLike(item.id); }}>
            <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
            {count > 0 && <Text style={[styles.likeCount, liked && { color: colors.gold }]}>{count}</Text>}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  function renderActivityTab() {
    if (feedLoading) return <ActivityIndicator style={{ marginTop: 48 }} color={colors.gold} size="large" />;
    return (
      <FlatList
        data={feedPosts}
        keyExtractor={p => p.id}
        renderItem={renderPost}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => currentUserId && loadFeed(currentUserId, true)}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>⛳</Text>
            <Text style={styles.emptyTitle}>No rounds yet</Text>
            <Text style={styles.emptySub}>
              {selectedClubhouseId
                ? 'No rounds shared by your playing partners yet.'
                : 'Add playing partners to see their rounds here.'}
            </Text>
          </View>
        }
      />
    );
  }

  // ─── Render: Schedule ─────────────────────────────────────────────────────

  function renderScheduleTab() {
    const grid = buildCalendarGrid(calendarMonth);
    const freeOnDate = selectedDate
      ? membersAvailability.filter(a => a.date === selectedDate && a.status === 'available')
      : [];
    const maybeOnDate = selectedDate
      ? membersAvailability.filter(a => a.date === selectedDate && a.status === 'maybe')
      : [];

    return (
      <ScrollView contentContainerStyle={styles.list}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
            <Text style={styles.monthNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
            <Text style={styles.monthNavArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={styles.calRow}>
          {DAY_HEADERS.map(h => (
            <View key={h} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{h}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {availLoading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 32 }} />
        ) : (
          grid.map((row, ri) => (
            <View key={ri} style={styles.calRow}>
              {row.map((date, ci) => {
                if (!date) return <View key={ci} style={styles.dayCell} />;
                const key = toDateStr(date);
                const avail = myAvailability[key];
                const isToday = key === todayStr;
                const isSelected = key === selectedDate;
                const membersFree = membersAvailability.filter(a => a.date === key && a.status === 'available').length;
                const membersMaybe = membersAvailability.filter(a => a.date === key && a.status === 'maybe').length;
                const bgColor = avail?.status === 'available'
                  ? colors.emerald
                  : avail?.status === 'maybe'
                  ? '#5c4a00'
                  : 'transparent';
                return (
                  <TouchableOpacity
                    key={ci}
                    style={[
                      styles.dayCell,
                      { backgroundColor: bgColor },
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      setSelectedDate(key);
                      setAvailSheetVisible(true);
                    }}
                  >
                    <Text style={[styles.dayText, isToday && { color: colors.gold, fontFamily: fonts.bodySemiBold }]}>
                      {date.getDate()}
                    </Text>
                    {(membersFree > 0 || membersMaybe > 0) && (
                      <View style={styles.dotRow}>
                        {membersFree > 0 && <View style={[styles.dot, { backgroundColor: '#4caf50' }]} />}
                        {membersMaybe > 0 && <View style={[styles.dot, { backgroundColor: '#ffc107' }]} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.emerald }]} />
            <Text style={styles.legendText}>You're free</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: '#5c4a00' }]} />
            <Text style={styles.legendText}>You're maybe</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#4caf50' }]} />
            <Text style={styles.legendText}>Partners free</Text>
          </View>
        </View>

        {/* Who's free on selected date */}
        {selectedDate && (freeOnDate.length > 0 || maybeOnDate.length > 0) && (
          <View style={styles.whosFreeSection}>
            <Text style={styles.sectionLabel}>
              {(() => { const [sy,sm,sd] = selectedDate.split('-'); return new Date(+sy,+sm-1,+sd).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}); })()}
            </Text>
            {freeOnDate.map(a => (
              <View key={a.id} style={styles.availRow}>
                <Text style={styles.availEmoji}>🟢</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.availName}>@{(a.profiles as any)?.username ?? 'golfer'}</Text>
                  {(a.start_time || a.notes) && (
                    <Text style={styles.availMeta}>
                      {a.start_time ? `${a.start_time}${a.end_time ? `–${a.end_time}` : ''}` : ''}
                      {a.notes ? (a.start_time ? ` · ${a.notes}` : a.notes) : ''}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {maybeOnDate.map(a => (
              <View key={a.id} style={styles.availRow}>
                <Text style={styles.availEmoji}>🟡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.availName}>@{(a.profiles as any)?.username ?? 'golfer'}</Text>
                  {a.notes && <Text style={styles.availMeta}>{a.notes}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Render: Members ─────────────────────────────────────────────────────

  function renderMembersTab() {
    // Show clubhouse invite notifications at top (pending invites for current user)
    const myPendingInvites = myClubhouses.length === 0
      ? clubInvited
      : [];

    if (selectedClubhouseId) {
      const isAdmin = selectedClubhouse?.myRole === 'admin';
      const isSearching = searchQuery.length >= 2;

      return (
        <FlatList
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          data={isSearching ? searchResults : clubMembers}
          keyExtractor={(item: any) => item.id}
          ListHeaderComponent={
            <View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search to invite playing partners..."
                placeholderTextColor={colors.gray}
                value={searchQuery}
                onChangeText={search}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Pending join requests (admin only) */}
              {isAdmin && !isSearching && clubPending.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Join Requests</Text>
                  {clubPending.map((m: any) => (
                    <View key={m.id} style={styles.friendRow}>
                      <Text style={styles.friendEmoji}>🏌️</Text>
                      <Text style={styles.friendName}>@{m.profiles?.username ?? 'golfer'}</Text>
                      <View style={styles.requestBtns}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => approveJoinRequest(m.id)}>
                          <Text style={styles.acceptBtnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => removeFromClubhouse(m.id)}>
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!isSearching && (
                <Text style={styles.sectionLabel}>
                  {clubMembers.length > 0 ? `Partners · ${clubMembers.length}` : 'No partners yet'}
                </Text>
              )}
              {isSearching && searchResults.length === 0 && (
                <Text style={styles.noResults}>No users found</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            if (isSearching) {
              const u = item as { id: string; username: string };
              const isAlreadyMember = clubMembers.some((m: any) => m.user_id === u.id);
              const sent = sentIds.has(u.id);
              return (
                <View style={styles.friendRow}>
                  <Text style={styles.friendEmoji}>🏌️</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/profile/${u.id}` as any)}>
                    <Text style={styles.friendName}>@{u.username}</Text>
                  </TouchableOpacity>
                  {isAlreadyMember ? (
                    <Text style={styles.alreadyFriendTag}>Partner ✓</Text>
                  ) : sent ? (
                    <Text style={styles.sentTag}>Invited</Text>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => inviteToClubhouse(u.id)}>
                      <Text style={styles.addBtnText}>Invite</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            const m = item as any;
            const isMe = m.user_id === currentUserId;
            return (
              <View style={styles.friendRow}>
                <Text style={styles.friendEmoji}>🏌️</Text>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/profile/${m.user_id}` as any)}>
                  <Text style={styles.friendName}>
                    @{m.profiles?.username ?? 'golfer'}
                    {m.role === 'admin' ? ' 👑' : ''}
                    {isMe ? ' (you)' : ''}
                  </Text>
                </TouchableOpacity>
                {isAdmin && !isMe && (
                  <TouchableOpacity onPress={() => removeFromClubhouse(m.id)}>
                    <Text style={styles.removeBtn}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      );
    }

    // "All" view — existing flat friends
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
              placeholder="Search by username to find a playing partner..."
              placeholderTextColor={colors.gray}
              value={searchQuery}
              onChangeText={search}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!isSearching && pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Join Requests</Text>
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
            {!isSearching && (
              <Text style={styles.sectionLabel}>
                {friends.length > 0 ? `Playing Partners · ${friends.length}` : 'No playing partners yet'}
              </Text>
            )}
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
                  <Text style={styles.alreadyFriendTag}>Partner ✓</Text>
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
            Search for golfers above to add a playing partner
          </Text>
        ) : null}
      />
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'activity', label: 'Activity' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'members', label: `Partners${!selectedClubhouseId && pending.length > 0 ? ` (${pending.length})` : ''}` },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Clubhouse picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pickerRow}
        contentContainerStyle={styles.pickerContent}
      >
        <TouchableOpacity
          style={[styles.pill, selectedClubhouseId === null && styles.pillActive]}
          onPress={() => { setSelectedClubhouseId(null); setSearchQuery(''); }}
        >
          <Text style={[styles.pillText, selectedClubhouseId === null && styles.pillTextActive]}>All</Text>
        </TouchableOpacity>
        {myClubhouses.map(ch => (
          <TouchableOpacity
            key={ch.id}
            style={[styles.pill, selectedClubhouseId === ch.id && styles.pillActive]}
            onPress={() => { setSelectedClubhouseId(ch.id); setSearchQuery(''); }}
          >
            <Text style={[styles.pillText, selectedClubhouseId === ch.id && styles.pillTextActive]}>
              {ch.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.pillNew}
          onPress={() => router.push('/clubhouse/create' as any)}
        >
          <Text style={styles.pillNewText}>+ New</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sub-tab bar */}
      <View style={styles.tabBar}>
        {subTabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'activity' && renderActivityTab()}
      {activeTab === 'schedule' && renderScheduleTab()}
      {activeTab === 'members' && renderMembersTab()}

      <AvailabilitySheet
        visible={availSheetVisible}
        date={selectedDate}
        current={selectedDate ? (myAvailability[selectedDate] ?? null) : null}
        onSave={saveAvailability}
        onClear={clearAvailability}
        onClose={() => setAvailSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Picker
  pickerRow: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.bgSecondary,
  },
  pickerContent: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center', paddingVertical: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.inputBorder,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.gray },
  pillTextActive: { color: colors.bg },
  pillNew: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.emerald,
  },
  pillNewText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.emeraldLight },

  // Sub-tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
    padding: 6, gap: 6,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabBtnActive: { backgroundColor: colors.gold },
  tabBtnText: { fontSize: 13, color: colors.gray, fontFamily: fonts.bodyMedium },
  tabBtnTextActive: { color: colors.bg, fontFamily: fonts.bodySemiBold },

  list: { padding: spacing.md, gap: spacing.sm },

  // Post card
  postCard: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.hairline,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  postUsername: { fontFamily: fonts.bodySemiBold, color: colors.gold, fontSize: 14 },
  postDate: { color: colors.gray, fontSize: 13 },
  postCourse: { fontSize: 17, fontFamily: fonts.heading, color: colors.offWhite, marginBottom: 8 },
  postScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  postScore: { fontSize: 26, fontFamily: fonts.bodySemiBold, color: colors.gold },
  postPar: { fontSize: 16, color: colors.gray },
  postHoles: { fontSize: 13, color: colors.gray, marginLeft: 4 },
  postStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  postStat: {
    fontSize: 12, color: colors.offWhite, backgroundColor: colors.inputBg,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  postNotes: { marginTop: 8, fontSize: 13, color: colors.gray, fontStyle: 'italic' },
  postFooter: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 10 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  likeIcon: { fontSize: 18 },
  likeCount: { fontSize: 13, color: colors.gray },

  // Calendar
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthNavArrow: { fontSize: 28, color: colors.gold, paddingHorizontal: 8 },
  monthTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.offWhite },
  calRow: { flexDirection: 'row', marginBottom: 2 },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingBottom: 6 },
  dayHeaderText: { fontSize: 11, color: colors.gray, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase' },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, margin: 1, minHeight: 40,
  },
  dayCellToday: { borderWidth: 1.5, borderColor: colors.gold },
  dayCellSelected: { borderWidth: 2, borderColor: colors.offWhite },
  dayText: { fontSize: 13, color: colors.offWhite, fontFamily: fonts.body },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, color: colors.gray, fontFamily: fonts.body },
  whosFreeSection: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: spacing.md },
  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline,
  },
  availEmoji: { fontSize: 18 },
  availName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.offWhite },
  availMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },

  // Members shared
  searchInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, marginBottom: 16, color: colors.offWhite, fontFamily: fonts.body,
  },
  section: { marginBottom: 8 },
  sectionLabel: { ...typography.label, marginBottom: 10 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSecondary,
    borderRadius: radius.md, padding: 14, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: colors.hairline,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 1,
  },
  friendEmoji: { fontSize: 20 },
  friendName: { fontSize: 15, color: colors.offWhite, fontFamily: fonts.bodyMedium, flex: 1 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { backgroundColor: colors.emerald, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  declineBtn: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  declineBtnText: { color: colors.gray, fontSize: 13 },
  addBtn: { backgroundColor: colors.emerald, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  alreadyFriendTag: { fontSize: 12, color: colors.gold, fontFamily: fonts.bodySemiBold },
  sentTag: { fontSize: 12, color: colors.gray },
  removeBtn: { fontSize: 13, color: colors.danger, fontFamily: fonts.bodyMedium },
  noResults: { textAlign: 'center', color: colors.gray, marginTop: 16, fontSize: 14 },
  emptyFriendsSub: { textAlign: 'center', color: colors.gray, fontSize: 13, lineHeight: 20, paddingHorizontal: 24, marginTop: 8 },

  // Shared empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.heading, color: colors.offWhite, marginTop: 14 },
  emptySub: { fontSize: 13, color: colors.gray, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
