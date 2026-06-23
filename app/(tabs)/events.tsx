import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase, GolfEvent } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';

type SubTab = 'upcoming' | 'discover';
type EventWithRsvp = GolfEvent & { myRsvpStatus?: 'invited' | 'going' | 'maybe' | 'declined' };

const FORMAT_LABELS: Record<string, string> = {
  casual: 'Casual', stroke: 'Stroke Play', skins: 'Skins',
  scramble: 'Scramble', match: 'Match Play',
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function EventsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>('upcoming');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<EventWithRsvp[]>([]);
  const [discover, setDiscover] = useState<GolfEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll(pull = false) {
    if (pull) setRefreshing(true); else setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const today = new Date().toISOString().split('T')[0];

    const [rsvpRes, mineRes] = await Promise.all([
      supabase
        .from('event_rsvps')
        .select('event_id, status, events(*, clubhouses(name))')
        .eq('user_id', user.id)
        .neq('status', 'declined'),
      supabase
        .from('events')
        .select('*, clubhouses(name)')
        .eq('creator_id', user.id)
        .eq('status', 'upcoming')
        .gte('event_date', today)
        .order('event_date'),
    ]);

    const merged = new Map<string, EventWithRsvp>();
    (rsvpRes.data ?? []).forEach((r: any) => {
      const ev = r.events as GolfEvent;
      if (!ev || ev.event_date < today || ev.status !== 'upcoming') return;
      merged.set(ev.id, { ...ev, myRsvpStatus: r.status });
    });
    (mineRes.data ?? []).forEach((ev: any) => {
      if (!merged.has(ev.id)) merged.set(ev.id, ev as EventWithRsvp);
    });

    const sorted = Array.from(merged.values()).sort((a, b) =>
      a.event_date.localeCompare(b.event_date)
    );
    setUpcoming(sorted);

    const myIds = new Set(merged.keys());
    const { data: publicEvents } = await supabase
      .from('events')
      .select('*, clubhouses(name)')
      .eq('is_public', true)
      .eq('status', 'upcoming')
      .gte('event_date', today)
      .order('event_date')
      .limit(50);

    setDiscover(((publicEvents ?? []) as GolfEvent[]).filter(e => !myIds.has(e.id)));
    if (pull) setRefreshing(false); else setLoading(false);
  }

  async function acceptInvite(eventId: string) {
    if (!currentUserId) return;
    await supabase.from('event_rsvps').upsert(
      { event_id: eventId, user_id: currentUserId, status: 'going' },
      { onConflict: 'event_id,user_id' }
    );
    setUpcoming(prev => prev.map(e => e.id === eventId ? { ...e, myRsvpStatus: 'going' } : e));
  }

  async function declineInvite(eventId: string) {
    if (!currentUserId) return;
    await supabase.from('event_rsvps').upsert(
      { event_id: eventId, user_id: currentUserId, status: 'declined' },
      { onConflict: 'event_id,user_id' }
    );
    setUpcoming(prev => prev.filter(e => e.id !== eventId));
  }

  async function joinEvent(event: GolfEvent) {
    if (!currentUserId) return;
    await supabase.from('event_rsvps').upsert(
      { event_id: event.id, user_id: currentUserId, status: 'going' },
      { onConflict: 'event_id,user_id' }
    );
    setDiscover(prev => prev.filter(e => e.id !== event.id));
    setUpcoming(prev =>
      [...prev, { ...event, myRsvpStatus: 'going' as const }]
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
    );
  }

  function EventCard({ event, showJoin }: { event: EventWithRsvp | GolfEvent; showJoin?: boolean }) {
    const e = event as EventWithRsvp;
    const clubName = (e.clubhouses as any)?.name as string | undefined;
    const status = e.myRsvpStatus;
    const isInvited = status === 'invited';

    return (
      <View style={styles.cardWrapper}>
        {isInvited && (
          <View style={styles.inviteBanner}>
            <Text style={styles.inviteBannerText}>You've been invited</Text>
            <View style={styles.inviteBtns}>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptInvite(e.id)}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineBtn} onPress={() => declineInvite(e.id)}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[styles.eventCard, isInvited && styles.eventCardInvited]}
          onPress={() => router.push(`/events/${e.id}` as any)}
          activeOpacity={0.8}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={2}>{e.title}</Text>
            <View style={styles.badgeRow}>
              {e.is_public && (
                <View style={styles.publicBadge}>
                  <Text style={styles.publicBadgeText}>Public</Text>
                </View>
              )}
              {status && !isInvited && (
                <View style={[styles.rsvpBadge, status === 'going' ? styles.badgeGoing : styles.badgeMaybe]}>
                  <Text style={styles.rsvpBadgeText}>{status === 'going' ? 'Going' : 'Maybe'}</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.cardFormat}>{FORMAT_LABELS[e.format] ?? e.format}</Text>

          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaItem}>📅 {formatDate(e.event_date)}</Text>
            {e.tee_time ? <Text style={styles.cardMetaItem}>⏰ {e.tee_time}</Text> : null}
            {e.course_name ? <Text style={styles.cardMetaItem}>📍 {e.course_name}</Text> : null}
          </View>

          {clubName ? <Text style={styles.cardClubhouse}>🏠 {clubName}</Text> : null}

          {showJoin && (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => joinEvent(event as GolfEvent)}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  const invites = upcoming.filter(e => e.myRsvpStatus === 'invited');
  const confirmed = upcoming.filter(e => e.myRsvpStatus !== 'invited');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.screenTitle}>Events</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/events/create' as any)}
        >
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(['upcoming', 'discover'] as SubTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
              {t === 'upcoming'
                ? `Upcoming${invites.length > 0 ? ` (${invites.length})` : ''}`
                : 'Discover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.gold} size="large" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={colors.gold} />
          }
        >
          {activeTab === 'upcoming' && (
            upcoming.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🗓</Text>
                <Text style={styles.emptyTitle}>No upcoming events</Text>
                <Text style={styles.emptySub}>Create an event or get invited to one to get started.</Text>
              </View>
            ) : (
              <>
                {invites.length > 0 && <Text style={styles.sectionLabel}>Invites</Text>}
                {invites.map(e => <EventCard key={e.id} event={e} />)}
                {confirmed.length > 0 && invites.length > 0 && (
                  <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Coming Up</Text>
                )}
                {confirmed.map(e => <EventCard key={e.id} event={e} />)}
              </>
            )
          )}

          {activeTab === 'discover' && (
            discover.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Nothing to discover yet</Text>
                <Text style={styles.emptySub}>Public events from golfers you play with will appear here.</Text>
              </View>
            ) : (
              discover.map(e => <EventCard key={e.id} event={e} showJoin />)
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
    backgroundColor: colors.bgSecondary,
  },
  screenTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.offWhite },
  createBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.pill,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  createBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.offWhite },

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

  sectionLabel: { ...typography.label, marginBottom: 6 },

  cardWrapper: { marginBottom: 12 },

  inviteBanner: {
    backgroundColor: colors.emerald,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  inviteBannerText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.offWhite },
  inviteBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: colors.gold, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  acceptBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.bg },
  declineBtn: {
    borderWidth: 1.5, borderColor: 'rgba(245,244,240,0.3)', borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  declineBtnText: { fontSize: 13, color: colors.offWhite, fontFamily: fonts.body },

  eventCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.hairline,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  eventCardInvited: {
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    borderTopWidth: 0,
  },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.offWhite, flex: 1, marginRight: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 2 },

  publicBadge: {
    backgroundColor: 'rgba(198,162,103,0.15)', borderRadius: radius.sm,
    paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(198,162,103,0.4)',
  },
  publicBadgeText: { fontSize: 10, color: colors.gold, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase', letterSpacing: 0.4 },

  rsvpBadge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGoing: { backgroundColor: 'rgba(18,53,44,0.8)', borderWidth: 1, borderColor: colors.emerald },
  badgeMaybe: { backgroundColor: 'rgba(92,74,0,0.6)', borderWidth: 1, borderColor: '#5c4a00' },
  rsvpBadgeText: { fontSize: 10, color: colors.offWhite, fontFamily: fonts.bodySemiBold },

  cardFormat: {
    fontSize: 11, color: colors.gold, fontFamily: fonts.bodySemiBold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  cardMetaItem: { fontSize: 13, color: colors.gray, fontFamily: fonts.body },

  cardClubhouse: { fontSize: 12, color: colors.gray, fontFamily: fonts.bodyMedium, marginTop: 2 },

  joinBtn: {
    marginTop: spacing.sm, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  joinBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.offWhite },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.heading, color: colors.offWhite, marginTop: 14 },
  emptySub: { fontSize: 13, color: colors.gray, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
