import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';

export default function CreateClubhouseScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [membersCanInvite, setMembersCanInvite] = useState(true);
  const [membersCanCreateEvents, setMembersCanCreateEvents] = useState(true);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a Clubhouse name.'); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: club, error } = await supabase
      .from('clubhouses')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        creator_id: user.id,
        is_public: isPublic,
        settings: {
          can_members_invite: membersCanInvite,
          can_members_create_events: membersCanCreateEvents,
        },
      })
      .select()
      .single();

    if (error || !club) {
      Alert.alert('Error', error?.message ?? 'Could not create Clubhouse.');
      setLoading(false);
      return;
    }

    // Add creator as admin member
    await supabase.from('clubhouse_members').insert({
      clubhouse_id: club.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    });

    setLoading(false);
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Clubhouse</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Clubhouse Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="The Saturday Crew..."
          placeholderTextColor={colors.gray}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Saturday morning crew at River Course..."
          placeholderTextColor={colors.gray}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
        />

        <View style={styles.divider} />
        <Text style={styles.label}>Visibility</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Open to the public</Text>
            <Text style={styles.toggleSub}>Anyone can find and request to join</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: colors.inputBorder, true: colors.emerald }}
            thumbColor={colors.offWhite}
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.label}>Permissions</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Partners can invite others</Text>
            <Text style={styles.toggleSub}>Any playing partner can send invites, not just you</Text>
          </View>
          <Switch
            value={membersCanInvite}
            onValueChange={setMembersCanInvite}
            trackColor={{ false: colors.inputBorder, true: colors.emerald }}
            thumbColor={colors.offWhite}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Partners can create events</Text>
            <Text style={styles.toggleSub}>Any playing partner can create tee time events</Text>
          </View>
          <Switch
            value={membersCanCreateEvents}
            onValueChange={setMembersCanCreateEvents}
            trackColor={{ false: colors.inputBorder, true: colors.emerald }}
            thumbColor={colors.offWhite}
          />
        </View>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          onPress={create}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.offWhite} />
            : <Text style={styles.createBtnText}>Create Clubhouse</Text>
          }
        </TouchableOpacity>
      </ScrollView>
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
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.hairline,
  },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.offWhite, marginBottom: 3 },
  toggleSub: { fontSize: 12, color: colors.gray, fontFamily: fonts.body },
  createBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.lg,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg,
  },
  createBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 16 },
});
