import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, Clubhouse } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';
import TimePicker, { format12h } from '../../components/TimePicker';
import DatePicker, { formatDateDisplay } from '../../components/DatePicker';

const FORMATS = [
  { key: 'casual', label: 'Casual' },
  { key: 'stroke', label: 'Stroke Play' },
  { key: 'skins', label: 'Skins' },
  { key: 'scramble', label: 'Scramble' },
  { key: 'match', label: 'Match Play' },
] as const;

type Format = typeof FORMATS[number]['key'];
type Invitee = { id: string; username: string };

export default function CreateEventScreen() {
  const router = useRouter();
  const { clubhouseId } = useLocalSearchParams<{ clubhouseId?: string }>();

  const [myClubhouses, setMyClubhouses] = useState<Clubhouse[]>([]);
  const [selectedClubhouseId, setSelectedClubhouseId] = useState<string | null>(clubhouseId ?? null);
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [eventDate, setEventDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teeTime, setTeeTime] = useState<string | null>(null);
  const [teePickerOpen, setTeePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [format, setFormat] = useState<Format>('casual');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [notes, setNotes] = useState('');
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Invitee[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const { data } = await supabase
      .from('clubhouse_members')
      .select('clubhouses(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');
    const clubs: Clubhouse[] = (data ?? []).map((r: any) => r.clubhouses).filter(Boolean);
    setMyClubhouses(clubs);
  }

  async function searchUsers(q: string) {
    setInviteSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q.trim()}%`)
      .limit(10);
    const filtered = (data ?? []).filter((u: any) =>
      u.id !== currentUserId && !invitees.some(i => i.id === u.id)
    ) as Invitee[];
    setSearchResults(filtered);
  }

  function addInvitee(user: Invitee) {
    setInvitees(prev => [...prev, user]);
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
    setInviteSearch('');
  }

  function removeInvitee(userId: string) {
    setInvitees(prev => prev.filter(u => u.id !== userId));
  }

  async function create() {
    setErrorMsg(null);
    if (!title.trim()) { setErrorMsg('Please enter an event title.'); return; }
    if (!eventDate) { setErrorMsg('Please select a date.'); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMsg('Not logged in.'); setLoading(false); return; }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        clubhouse_id: selectedClubhouseId || null,
        creator_id: user.id,
        title: title.trim(),
        course_name: courseName.trim() || null,
        event_date: eventDate,
        tee_time: teeTime || null,
        format,
        max_players: maxPlayers ? parseInt(maxPlayers, 10) : null,
        is_public: isPublic,
        notes: notes.trim() || null,
        status: 'upcoming',
      })
      .select()
      .single();

    if (error || !event) {
      console.error('Create event error:', error);
      setErrorMsg(error?.message ?? 'Could not create event.');
      setLoading(false);
      return;
    }

    // Creator auto-RSVP as going
    await supabase.from('event_rsvps').insert({
      event_id: event.id, user_id: user.id, status: 'going',
    });

    // Invite others
    if (invitees.length > 0) {
      await supabase.from('event_rsvps').insert(
        invitees.map(i => ({ event_id: event.id, user_id: i.id, status: 'invited' }))
      );
    }

    setLoading(false);
    router.push(`/events/${event.id}` as any);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Event</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Saturday Skins Game..."
          placeholderTextColor={colors.gray}
          value={title}
          onChangeText={setTitle}
          maxLength={60}
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setDatePickerOpen(true)}>
              <Text style={[styles.timeBtnText, !eventDate && styles.timePlaceholder]}>
                {eventDate ? formatDateDisplay(eventDate) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tee Time</Text>
            <TouchableOpacity style={styles.timeBtn} onPress={() => setTeePickerOpen(true)}>
              <Text style={[styles.timeBtnText, !teeTime && styles.timePlaceholder]}>
                {teeTime ? format12h(teeTime) : 'Select time'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.label}>Course</Text>
        <TextInput
          style={styles.input}
          placeholder="River Golf Club..."
          placeholderTextColor={colors.gray}
          value={courseName}
          onChangeText={setCourseName}
        />

        <Text style={styles.label}>Format</Text>
        <View style={styles.formatGrid}>
          {FORMATS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.formatBtn, format === f.key && styles.formatBtnActive]}
              onPress={() => setFormat(f.key)}
            >
              <Text style={[styles.formatBtnText, format === f.key && styles.formatBtnTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Max Players</Text>
        <TextInput
          style={styles.input}
          placeholder="4"
          placeholderTextColor={colors.gray}
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
          maxLength={2}
        />

        <View style={styles.divider} />
        <Text style={styles.label}>Visibility</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Public event</Text>
            <Text style={styles.toggleSub}>Anyone can discover and join this event</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: colors.inputBorder, true: colors.emerald }}
            thumbColor={colors.offWhite}
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.label}>Post to Clubhouse (optional)</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.pill, selectedClubhouseId === null && styles.pillActive]}
              onPress={() => setSelectedClubhouseId(null)}
            >
              <Text style={[styles.pillText, selectedClubhouseId === null && styles.pillTextActive]}>None</Text>
            </TouchableOpacity>
            {myClubhouses.map(ch => (
              <TouchableOpacity
                key={ch.id}
                style={[styles.pill, selectedClubhouseId === ch.id && styles.pillActive]}
                onPress={() => setSelectedClubhouseId(ch.id)}
              >
                <Text style={[styles.pillText, selectedClubhouseId === ch.id && styles.pillTextActive]}>
                  {ch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.divider} />
        <Text style={styles.label}>Invite Players</Text>

        <TextInput
          style={styles.input}
          placeholder="Search by username..."
          placeholderTextColor={colors.gray}
          value={inviteSearch}
          onChangeText={searchUsers}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.map(u => (
              <TouchableOpacity key={u.id} style={styles.searchResult} onPress={() => addInvitee(u)}>
                <Text style={styles.searchResultText}>@{u.username}</Text>
                <Text style={styles.searchResultAdd}>+ Invite</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {invitees.length > 0 && (
          <View style={styles.inviteeList}>
            {invitees.map(u => (
              <View key={u.id} style={styles.inviteeChip}>
                <Text style={styles.inviteeChipText}>@{u.username}</Text>
                <TouchableOpacity onPress={() => removeInvitee(u.id)}>
                  <Text style={styles.inviteeRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="$5 skins, closest to pin on 7..."
          placeholderTextColor={colors.gray}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={300}
        />

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          onPress={create}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.offWhite} />
            : <Text style={styles.createBtnText}>Create Event</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      <TimePicker
        visible={teePickerOpen}
        value={teeTime}
        title="Tee Time"
        onConfirm={t => { setTeeTime(t); setTeePickerOpen(false); }}
        onClose={() => setTeePickerOpen(false)}
      />
      <DatePicker
        visible={datePickerOpen}
        value={eventDate}
        title="Event Date"
        minDate={new Date().toISOString().split('T')[0]}
        onConfirm={d => { setEventDate(d); setDatePickerOpen(false); }}
        onClose={() => setDatePickerOpen(false)}
      />
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
  back: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodyMedium, width: 60 },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.offWhite },
  form: { padding: spacing.lg, gap: spacing.sm },
  label: { ...typography.label, marginBottom: 6, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.offWhite, fontFamily: fonts.body, fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: spacing.md },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.hairline,
  },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.offWhite, marginBottom: 3 },
  toggleSub: { fontSize: 12, color: colors.gray, fontFamily: fonts.body },

  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.inputBorder,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.gray },
  pillTextActive: { color: colors.bg },

  timeBtn: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center',
  },
  timeBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.offWhite },
  timePlaceholder: { color: colors.gray, fontFamily: fonts.body },
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  formatBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.inputBorder,
  },
  formatBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  formatBtnText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.gray },
  formatBtnTextActive: { color: colors.offWhite },

  searchDropdown: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.inputBorder, overflow: 'hidden', marginTop: 4,
  },
  searchResult: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  searchResultText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.offWhite },
  searchResultAdd: { fontSize: 13, color: colors.gold, fontFamily: fonts.bodySemiBold },

  inviteeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  inviteeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  inviteeChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.offWhite },
  inviteeRemove: { fontSize: 12, color: 'rgba(245,244,240,0.6)' },

  createBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.lg,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg,
  },
  createBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 16 },
  errorBox: {
    backgroundColor: 'rgba(198,40,40,0.12)', borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, padding: 12, marginTop: spacing.sm,
  },
  errorText: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
