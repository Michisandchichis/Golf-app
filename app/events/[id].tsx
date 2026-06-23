import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, GolfEvent, EventRsvp, EventMessage } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';

const FORMAT_LABELS: Record<string, string> = {
  casual: 'Casual', stroke: 'Stroke Play', skins: 'Skins',
  scramble: 'Scramble', match: 'Match Play',
};

function formatEventDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatMsgTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<GolfEvent | null>(null);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [myRsvp, setMyRsvp] = useState<'invited' | 'going' | 'maybe' | 'declined' | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  // Invite modal
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; username: string }[]>([]);
  const [inviteSent, setInviteSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`event-chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` },
        (payload) => {
          supabase
            .from('event_messages')
            .select('*, profiles(username)')
            .eq('id', (payload.new as any).id)
            .single()
            .then(({ data }) => {
              if (data) setMessages(prev => [...prev, data as EventMessage]);
            });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [eventRes, rsvpRes, msgRes] = await Promise.all([
      supabase.from('events').select('*, clubhouses(name)').eq('id', id).single(),
      supabase.from('event_rsvps').select('*, profiles(username)').eq('event_id', id),
      supabase.from('event_messages').select('*, profiles(username)').eq('event_id', id).order('created_at', { ascending: true }),
    ]);

    setEvent(eventRes.data as GolfEvent);
    const loadedRsvps = (rsvpRes.data as EventRsvp[]) ?? [];
    setRsvps(loadedRsvps);
    setMessages((msgRes.data as EventMessage[]) ?? []);

    if (user) {
      const mine = loadedRsvps.find(r => r.user_id === user.id);
      setMyRsvp(mine?.status ?? null);
    }
    setLoading(false);
  }

  async function rsvp(status: 'going' | 'maybe' | 'declined') {
    if (!currentUserId || !id) return;
    await supabase.from('event_rsvps').upsert(
      { event_id: id, user_id: currentUserId, status },
      { onConflict: 'event_id,user_id' }
    );
    setMyRsvp(status);
    const { data } = await supabase
      .from('event_rsvps').select('*, profiles(username)').eq('event_id', id);
    setRsvps((data as EventRsvp[]) ?? []);
  }

  async function sendMessage() {
    if (!msgText.trim() || !currentUserId || !id) return;
    setSending(true);
    const text = msgText.trim();
    setMsgText('');
    await supabase.from('event_messages').insert({
      event_id: id, user_id: currentUserId, message: text,
    });
    setSending(false);
  }

  async function searchInvite(q: string) {
    setInviteSearch(q);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    const { data } = await supabase
      .from('profiles').select('id, username').ilike('username', `%${q.trim()}%`).limit(10);
    const alreadyIn = new Set(rsvps.map(r => r.user_id));
    setInviteResults(
      ((data ?? []) as { id: string; username: string }[])
        .filter(u => u.id !== currentUserId && !alreadyIn.has(u.id))
    );
  }

  async function sendInvite(userId: string) {
    if (!id) return;
    await supabase.from('event_rsvps').insert({
      event_id: id, user_id: userId, status: 'invited',
    });
    setInviteSent(prev => new Set(prev).add(userId));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Event not found</Text>
      </SafeAreaView>
    );
  }

  const going = rsvps.filter(r => r.status === 'going');
  const maybe = rsvps.filter(r => r.status === 'maybe');
  const isCreator = event.creator_id === currentUserId;
  const isInvited = myRsvp === 'invited';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        {isCreator && (
          <TouchableOpacity style={styles.inviteHeaderBtn} onPress={() => setInviteVisible(true)}>
            <Text style={styles.inviteHeaderBtnText}>+ Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={styles.chatList}
          ListHeaderComponent={
            <View>
              {/* Invite banner */}
              {isInvited && (
                <View style={styles.invitedBanner}>
                  <Text style={styles.invitedBannerTitle}>You've been invited</Text>
                  <View style={styles.invitedBtns}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => rsvp('going')}>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => rsvp('declined')}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Event info */}
              <View style={styles.eventInfo}>
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.is_public && (
                    <View style={styles.publicBadge}>
                      <Text style={styles.publicBadgeText}>Public</Text>
                    </View>
                  )}
                </View>
                {(event.clubhouses as any)?.name && (
                  <Text style={styles.eventClubhouse}>🏠 {(event.clubhouses as any).name}</Text>
                )}
                <Text style={styles.eventDate}>{formatEventDate(event.event_date)}</Text>
                {event.tee_time && <Text style={styles.eventMeta}>⏰ {event.tee_time}</Text>}
                {event.course_name && <Text style={styles.eventMeta}>📍 {event.course_name}</Text>}
                <Text style={styles.eventMeta}>🏌️ {FORMAT_LABELS[event.format] ?? event.format}</Text>
                {event.max_players && <Text style={styles.eventMeta}>👥 Max {event.max_players} players</Text>}
                {event.notes && <Text style={styles.eventNotes}>{event.notes}</Text>}
              </View>

              {/* RSVP buttons (not shown if still invited) */}
              {!isInvited && (
                <View style={styles.rsvpRow}>
                  {(['going', 'maybe', 'declined'] as const).map(s => {
                    const labels = {
                      going: `✅ Going (${going.length})`,
                      maybe: `🤔 Maybe (${maybe.length})`,
                      declined: '❌ Decline',
                    };
                    const active = myRsvp === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.rsvpBtn, active && styles.rsvpBtnActive]}
                        onPress={() => rsvp(s)}
                      >
                        <Text style={[styles.rsvpBtnText, active && styles.rsvpBtnTextActive]}>
                          {labels[s]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Player lists */}
              {going.length > 0 && (
                <View style={styles.playerSection}>
                  <Text style={styles.playerSectionLabel}>Going</Text>
                  <View style={styles.playerList}>
                    {going.map(r => (
                      <Text key={r.id} style={styles.playerName}>
                        @{(r.profiles as any)?.username ?? 'golfer'}
                        {r.user_id === currentUserId ? ' (you)' : ''}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
              {maybe.length > 0 && (
                <View style={styles.playerSection}>
                  <Text style={styles.playerSectionLabel}>Maybe</Text>
                  <View style={styles.playerList}>
                    {maybe.map(r => (
                      <Text key={r.id} style={styles.playerName}>
                        @{(r.profiles as any)?.username ?? 'golfer'}
                        {r.user_id === currentUserId ? ' (you)' : ''}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.chatHeader}>
                <Text style={styles.chatHeaderText}>Group Chat</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.user_id === currentUserId;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                {!isMe && (
                  <Text style={styles.bubbleSender}>@{(item.profiles as any)?.username ?? 'golfer'}</Text>
                )}
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.message}</Text>
                <Text style={[styles.bubbleTime, isMe && { textAlign: 'right' }]}>
                  {formatMsgTime(item.created_at)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.chatEmpty}>Be the first to say something ⛳</Text>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.msgInput}
            placeholder="Say something..."
            placeholderTextColor={colors.gray}
            value={msgText}
            onChangeText={setMsgText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!msgText.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!msgText.trim() || sending}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Invite modal (creator only) */}
      <Modal visible={inviteVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Players</Text>
              <TouchableOpacity onPress={() => { setInviteVisible(false); setInviteSearch(''); setInviteResults([]); }}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.inviteInput}
              placeholder="Search by username..."
              placeholderTextColor={colors.gray}
              value={inviteSearch}
              onChangeText={searchInvite}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <ScrollView style={styles.inviteResults}>
              {inviteResults.map(u => {
                const sent = inviteSent.has(u.id);
                return (
                  <View key={u.id} style={styles.inviteResultRow}>
                    <Text style={styles.inviteResultName}>@{u.username}</Text>
                    {sent ? (
                      <Text style={styles.invitedTag}>Invited ✓</Text>
                    ) : (
                      <TouchableOpacity style={styles.inviteBtn} onPress={() => sendInvite(u.id)}>
                        <Text style={styles.inviteBtnText}>Invite</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {inviteSearch.length >= 2 && inviteResults.length === 0 && (
                <Text style={styles.noResults}>No users found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  back: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodyMedium },
  notFound: { textAlign: 'center', color: colors.gray, marginTop: 60, fontSize: 16 },

  inviteHeaderBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7,
  },
  inviteHeaderBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.offWhite },

  invitedBanner: {
    backgroundColor: colors.emerald, padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  invitedBannerTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.offWhite, marginBottom: 10 },
  invitedBtns: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  acceptBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.bg },
  declineBtn: {
    borderWidth: 1.5, borderColor: 'rgba(245,244,240,0.3)', borderRadius: radius.md,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  declineBtnText: { fontSize: 14, color: colors.offWhite, fontFamily: fonts.body },

  eventInfo: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  eventTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  eventTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.offWhite, flex: 1 },
  publicBadge: {
    backgroundColor: 'rgba(198,162,103,0.15)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(198,162,103,0.4)',
    marginTop: 4,
  },
  publicBadgeText: { fontSize: 10, color: colors.gold, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase', letterSpacing: 0.4 },
  eventClubhouse: { fontSize: 13, color: colors.gold, fontFamily: fonts.bodySemiBold, marginBottom: 6 },
  eventDate: { fontSize: 15, color: colors.offWhite, fontFamily: fonts.bodyMedium, marginBottom: 8 },
  eventMeta: { fontSize: 14, color: colors.gray, fontFamily: fonts.body, marginBottom: 4 },
  eventNotes: {
    marginTop: 8, fontSize: 13, color: colors.gray, fontStyle: 'italic',
    backgroundColor: colors.inputBg, borderRadius: radius.sm, padding: 10,
  },

  rsvpRow: {
    flexDirection: 'row', gap: 8, padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  rsvpBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.inputBorder,
  },
  rsvpBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  rsvpBtnText: { fontSize: 12, color: colors.gray, fontFamily: fonts.bodyMedium },
  rsvpBtnTextActive: { color: colors.offWhite },

  playerSection: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  playerSectionLabel: { ...typography.label, marginBottom: 6 },
  playerList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  playerName: {
    fontSize: 13, color: colors.offWhite, fontFamily: fonts.bodyMedium,
    backgroundColor: colors.inputBg, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.sm,
  },

  chatHeader: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  chatHeaderText: { ...typography.label },
  chatList: { paddingBottom: spacing.sm },
  chatEmpty: { textAlign: 'center', color: colors.gray, fontSize: 13, paddingVertical: 24 },

  bubble: { marginHorizontal: spacing.md, marginBottom: 8, maxWidth: '80%' },
  bubbleMe: { alignSelf: 'flex-end' },
  bubbleThem: { alignSelf: 'flex-start' },
  bubbleSender: { fontSize: 11, color: colors.gold, fontFamily: fonts.bodySemiBold, marginBottom: 3 },
  bubbleText: {
    fontSize: 14, color: colors.offWhite, fontFamily: fonts.body,
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.hairline,
  },
  bubbleTextMe: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  bubbleTime: { fontSize: 10, color: colors.gray, marginTop: 3 },

  inputRow: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.hairline,
    backgroundColor: colors.bgSecondary,
  },
  msgInput: {
    flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
    color: colors.offWhite, fontFamily: fonts.body, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.gold, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 9, justifyContent: 'center',
  },
  sendBtnText: { color: colors.bg, fontFamily: fonts.bodySemiBold, fontSize: 14 },

  // Invite modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, maxHeight: '70%',
    borderTopWidth: 1, borderTopColor: colors.hairline,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.offWhite },
  modalClose: { color: colors.gold, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  inviteInput: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11,
    color: colors.offWhite, fontFamily: fonts.body, fontSize: 15, marginBottom: spacing.sm,
  },
  inviteResults: { flex: 1 },
  inviteResultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  inviteResultName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.offWhite },
  inviteBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7,
  },
  inviteBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.offWhite },
  invitedTag: { fontSize: 13, color: colors.gold, fontFamily: fonts.bodySemiBold },
  noResults: { textAlign: 'center', color: colors.gray, fontSize: 14, marginTop: 16 },
});
