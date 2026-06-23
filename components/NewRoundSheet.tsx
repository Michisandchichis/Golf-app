import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { createRound } from '../lib/db';
import { searchCourses, PresetCourse, Tee } from '../lib/courses';
import { colors, fonts, spacing, radius, typography } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

function combinedCourseName(front: PresetCourse, back: PresetCourse) {
  const sharedPrefixMatch = front.name.match(/^(.*? - )/);
  if (sharedPrefixMatch && back.name.startsWith(sharedPrefixMatch[1])) {
    const prefix = sharedPrefixMatch[1];
    return `${prefix}${front.name.slice(prefix.length)} + ${back.name.slice(prefix.length)}`;
  }
  return `${front.name} + ${back.name}`;
}

export default function NewRoundSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const [courseName, setCourseName] = useState('');
  const [holes, setHoles] = useState<'9' | '18'>('18');
  const [courseRating, setCourseRating] = useState('');
  const [slopeRating, setSlopeRating] = useState('');
  const [suggestions, setSuggestions] = useState<PresetCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<PresetCourse | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);
  const [backNineQuery, setBackNineQuery] = useState('');
  const [backNineSuggestions, setBackNineSuggestions] = useState<PresetCourse[]>([]);
  const [selectedBackNine, setSelectedBackNine] = useState<PresetCourse | null>(null);

  if (!visible) return null;

  function reset() {
    setCourseName(''); setCourseRating(''); setSlopeRating('');
    setSuggestions([]); setSelectedCourse(null); setSelectedTee(null);
    setHoles('18');
    setBackNineQuery(''); setBackNineSuggestions([]); setSelectedBackNine(null);
  }

  function handleCourseNameChange(name: string) {
    setCourseName(name);
    setSelectedCourse(null); setSelectedTee(null);
    setCourseRating(''); setSlopeRating('');
    setSuggestions(searchCourses(name));
    setSelectedBackNine(null); setBackNineQuery(''); setBackNineSuggestions([]);
  }

  function selectPresetCourse(course: PresetCourse) {
    setCourseName(course.name);
    setSelectedCourse(course);
    setSuggestions([]);
    setHoles(course.holes === 9 ? '9' : '18');
    const firstTee = course.tees[0];
    setSelectedTee(firstTee);
    setCourseRating(String(firstTee.rating));
    setSlopeRating(String(firstTee.slope));
    setSelectedBackNine(null); setBackNineQuery(''); setBackNineSuggestions([]);
  }

  function selectTee(tee: Tee) {
    setSelectedTee(tee);
    setCourseRating(String(tee.rating));
    setSlopeRating(String(tee.slope));
  }

  function handleBackNineQueryChange(name: string) {
    setBackNineQuery(name);
    setSelectedBackNine(null);
    setBackNineSuggestions(searchCourses(name));
  }

  function selectBackNine(course: PresetCourse) {
    setSelectedBackNine(course);
    setBackNineQuery(course.name);
    setBackNineSuggestions([]);
  }

  function startRound() {
    if (!courseName.trim()) return;
    const needsBackNine = selectedCourse?.holes === 9 && holes === '18';
    if (needsBackNine && !selectedBackNine) return;

    let finalCourseName = courseName.trim();
    let rating = parseFloat(courseRating) || 0;
    let slope = parseInt(slopeRating) || 113;
    let pars = selectedCourse?.pars ?? [];
    let yards = selectedTee?.yards ?? [];
    let handicaps = selectedCourse?.handicaps ?? [];

    if (needsBackNine && selectedCourse && selectedBackNine) {
      const backTee = selectedBackNine.tees.find((t) => t.name === selectedTee?.name) ?? selectedBackNine.tees[0];
      finalCourseName = combinedCourseName(selectedCourse, selectedBackNine);
      rating = (parseFloat(courseRating) || 0) + backTee.rating;
      slope = Math.round(((parseInt(slopeRating) || 113) + backTee.slope) / 2);
      pars = [...(selectedCourse.pars ?? []), ...selectedBackNine.pars];
      yards = [...(selectedTee?.yards ?? []), ...backTee.yards];
      handicaps = [...(selectedCourse.handicaps ?? []), ...selectedBackNine.handicaps];
    }

    const roundId = createRound(finalCourseName, parseInt(holes), rating, slope);
    reset();
    onClose();
    router.replace({
      pathname: '/(tabs)/scorecard',
      params: { roundId, totalHoles: holes, courseName: finalCourseName, pars: pars.join(','), yards: yards.join(','), handicaps: handicaps.join(',') },
    });
  }

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={() => { reset(); onClose(); }} />
      <View style={styles.sheet}>
        <Text style={styles.title}>New Round</Text>

        <Text style={styles.label}>Course name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Valley Oaks"
          placeholderTextColor={colors.gray}
          value={courseName}
          onChangeText={handleCourseNameChange}
          autoFocus
        />

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((c) => (
              <TouchableOpacity key={c.name} style={styles.suggestion} onPress={() => selectPresetCourse(c)}>
                <Text style={styles.suggestionText}>{c.name}</Text>
                <Text style={styles.suggestionSub}>{c.holes} holes</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedCourse && (
          <>
            <Text style={styles.label}>Tee color</Text>
            <View style={styles.teeRow}>
              {selectedCourse.tees.map((tee) => (
                <TouchableOpacity
                  key={tee.name}
                  style={[styles.teeBtn, selectedTee?.name === tee.name && styles.teeBtnActive]}
                  onPress={() => selectTee(tee)}
                >
                  <Text style={[styles.teeBtnText, selectedTee?.name === tee.name && styles.teeBtnTextActive]}>
                    {tee.name}
                  </Text>
                  <Text style={[styles.teeBtnSub, selectedTee?.name === tee.name && styles.teeBtnTextActive]}>
                    {tee.rating} / {tee.slope}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {!selectedCourse && (
          <>
            <Text style={styles.label}>
              Course Rating & Slope{' '}
              <Text style={styles.labelHint}>(needed for handicap)</Text>
            </Text>
            <View style={styles.ratingRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Rating e.g. 72.4"
                placeholderTextColor={colors.gray}
                value={courseRating}
                onChangeText={setCourseRating}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Slope e.g. 113"
                placeholderTextColor={colors.gray}
                value={slopeRating}
                onChangeText={setSlopeRating}
                keyboardType="number-pad"
              />
            </View>
          </>
        )}

        <Text style={styles.label}>Number of holes</Text>
        <View style={styles.holeToggle}>
          {(['9', '18'] as const).map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.holeBtn, holes === n && styles.holeBtnActive]}
              onPress={() => setHoles(n)}
            >
              <Text style={[styles.holeBtnText, holes === n && styles.holeBtnTextActive]}>
                {n} holes
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedCourse?.holes === 9 && holes === '18' && (
          <>
            <Text style={styles.label}>Back 9 course</Text>
            <TextInput
              style={styles.input}
              placeholder="Search for a course to play as the back 9"
              placeholderTextColor={colors.gray}
              value={backNineQuery}
              onChangeText={handleBackNineQueryChange}
            />
            {backNineSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {backNineSuggestions.map((c) => (
                  <TouchableOpacity key={c.name} style={styles.suggestion} onPress={() => selectBackNine(c)}>
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    <Text style={styles.suggestionSub}>{c.holes} holes</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {selectedBackNine && (
              <Text style={styles.labelHint}>Back 9: {selectedBackNine.name}</Text>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, (!courseName.trim() || (selectedCourse?.holes === 9 && holes === '18' && !selectedBackNine)) && { opacity: 0.4 }]}
          onPress={startRound}
          disabled={!courseName.trim() || (selectedCourse?.holes === 9 && holes === '18' && !selectedBackNine)}
        >
          <Text style={styles.confirmBtnText}>Tee Off →</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end', zIndex: 1000,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.hairline,
    padding: spacing.xl,
  },
  title: { ...typography.h1, fontSize: 22, marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.md },
  labelHint: { fontSize: 11, color: colors.gray, textTransform: 'none' },
  ratingRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 16, fontFamily: fonts.body, color: colors.offWhite,
  },
  suggestions: {
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, marginTop: 4, overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.hairline,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  suggestionText: { fontSize: 14, color: colors.offWhite, fontFamily: fonts.bodyMedium },
  suggestionSub: { fontSize: 12, color: colors.gray },
  teeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  teeBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
  },
  teeBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  teeBtnText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.offWhite },
  teeBtnSub: { fontSize: 11, color: colors.gray, marginTop: 2 },
  teeBtnTextActive: { color: colors.offWhite },
  holeToggle: { flexDirection: 'row', gap: 10, marginTop: 4 },
  holeBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
  },
  holeBtnActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  holeBtnText: { fontSize: 15, color: colors.offWhite, fontFamily: fonts.body },
  holeBtnTextActive: { fontFamily: fonts.bodySemiBold },
  confirmBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg,
  },
  confirmBtnText: { color: colors.offWhite, fontSize: 16, fontFamily: fonts.bodySemiBold },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelBtnText: { color: colors.gray, fontSize: 14, fontFamily: fonts.body },
});
