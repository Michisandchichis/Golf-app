import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius, shadow, typography } from '../lib/theme';
import { MilestoneDefinition, shareMilestoneToClubhouse } from '../lib/achievements';
import { Round } from '../lib/db';

type Props = {
  milestone: MilestoneDefinition;
  userId: string;
  round: Round;
  onDone: () => void;
};

export default function HonorUnlockedModal({ milestone, userId, round, onDone }: Props) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    await shareMilestoneToClubhouse(userId, milestone, round);
    setSharing(false);
    onDone();
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.icon}>{milestone.icon}</Text>
        <Text style={styles.title}>Honor Unlocked!</Text>
        <Text style={styles.label}>{milestone.label}</Text>
        <Text style={styles.description}>{milestone.description}</Text>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator color={colors.offWhite} />
          ) : (
            <Text style={styles.shareBtnText}>Share to Clubhouse</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.privateBtn} onPress={onDone} disabled={sharing}>
          <Text style={styles.privateBtnText}>Keep Private</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32,
    zIndex: 1001,
  },
  card: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.xl, padding: 32, width: '100%', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.gold,
    ...shadow.goldGlow,
  },
  icon: { fontSize: 64, marginBottom: 8 },
  title: { ...typography.h1, marginBottom: 6 },
  label: { fontSize: 22, fontFamily: fonts.bodySemiBold, color: colors.gold, marginBottom: 8 },
  description: { ...typography.bodyMuted, textAlign: 'center', marginBottom: spacing.xl },
  shareBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', width: '100%', marginBottom: 10,
  },
  shareBtnText: { color: colors.offWhite, fontSize: 16, fontFamily: fonts.bodySemiBold },
  privateBtn: {
    borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', width: '100%',
  },
  privateBtnText: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodySemiBold },
});
