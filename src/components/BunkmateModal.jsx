import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors as tColors,
  typography,
  spacing as tSpacing,
  radius as tRadius,
} from '../theme/tokens';

const STORAGE_KEY = 'bunkmate_subjects';

// calc: how many can i bunk, or how many must i attend?
// test case: attended=64, total=70, target=75 → canBunk=15
// proof: floor((64 - 0.75*70) / 0.75) = floor(11.5 / 0.75) = floor(15.33) = 15 ✓
function calc(attended, total, targetPct) {
  const a = parseInt(attended);
  const t = parseInt(total);
  const tgt = parseInt(targetPct) / 100;
  if (isNaN(a) || isNaN(t) || t === 0) return null;
  const pct = a / t;

  if (pct >= tgt) {
    const canBunk = Math.floor((a - tgt * t) / tgt);
    return { pct, canBunk, need: 0, status: canBunk >= 5 ? 'safe' : 'warn' };
  } else {
    let need = 0;
    while ((a + need) / (t + need) < tgt) need++;
    return { pct, canBunk: 0, need, status: 'danger' };
  }
}

let _id = 0;
const newSubject = () => ({ id: ++_id, name: '', attended: '', total: '' });
const DEFAULT_SUBJECTS = () => [newSubject(), newSubject(), newSubject()];

export default function BunkmateModal({ visible, onClose }) {
  const [target, setTarget] = useState(75);
  const [trackWidth, setTrackWidth] = useState(0);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const loaded = useRef(false);

  // Load persisted subjects when modal opens
  useEffect(() => {
    if (!visible) return;
    loaded.current = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSubjects(parsed);
          }
        } catch (_) {}
      }
      loaded.current = true;
    });
  }, [visible]);

  // Auto-save on every subjects change (only after initial load)
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
  }, [subjects]);

  // ── slider ──────────────────────────────────────────────────
  const positionToValue = (x) => {
    const ratio = Math.max(0, Math.min(1, x / Math.max(trackWidth, 1)));
    return Math.round(50 + ratio * 50);
  };
  const trackResponder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (evt) => setTarget(positionToValue(evt.nativeEvent.locationX)),
    onResponderMove: (evt) => setTarget(positionToValue(evt.nativeEvent.locationX)),
  };
  const thumbPos = trackWidth > 0 ? ((target - 50) / 50) * (trackWidth - THUMB) : 0;

  // ── subject mutations ────────────────────────────────────────
  const updateSubject = (id, field, value) =>
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const step = (id, field, delta) =>
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = Math.max(0, (parseInt(s[field]) || 0) + delta);
        return { ...s, [field]: String(next) };
      }),
    );

  const attended = (id) =>
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          attended: String((parseInt(s.attended) || 0) + 1),
          total: String((parseInt(s.total) || 0) + 1),
        };
      }),
    );

  const bunked = (id) =>
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, total: String((parseInt(s.total) || 0) + 1) };
      }),
    );

  const addSubject = () => setSubjects((prev) => [...prev, newSubject()]);
  const removeSubject = (id) => setSubjects((prev) => prev.filter((s) => s.id !== id));

  // ── derived ──────────────────────────────────────────────────
  const results = subjects.map((s) => ({ ...s, result: calc(s.attended, s.total, target) }));
  const safe = results.filter((r) => r.result?.status === 'safe').length;
  const warn = results.filter((r) => r.result?.status === 'warn').length;
  const danger = results.filter((r) => r.result?.status === 'danger').length;

  const handleClose = () => {
    setTarget(75);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── header ── */}
          <View style={s.header}>
            <View style={s.secretBadge}>
              <Text style={s.secretBadgeText}>🔒 secret feature</Text>
            </View>
            <View style={s.headerRow}>
              <Text style={s.title}>bunkmate 🤫</Text>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.7}>
                <Text style={s.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.subtitle}>type bubbles anywhere to open · keep this between us</Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── target slider ── */}
            <View style={s.sliderCard}>
              <View style={s.sliderLabelRow}>
                <Text style={s.sliderLabel}>target attendance</Text>
                <Text style={s.sliderValue}>{target}%</Text>
              </View>
              <View
                style={s.sliderTrack}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                {...trackResponder}
              >
                <View pointerEvents="none" style={[s.sliderFill, { width: thumbPos + THUMB / 2 }]} />
                <View pointerEvents="none" style={[s.sliderThumb, { left: thumbPos }]} />
              </View>
              <View style={s.sliderEnds}>
                <Text style={s.sliderEnd}>50%</Text>
                <Text style={s.sliderEnd}>100%</Text>
              </View>
            </View>

            {/* ── subject cards ── */}
            {results.map((s_, idx) => {
              const r = s_.result;
              const fillPct = r ? Math.min(r.pct, 1) : 0;
              const barColor = !r
                ? tColors.border
                : r.status === 'safe'
                ? tColors.success
                : r.status === 'warn'
                ? tColors.warning
                : tColors.error;

              return (
                <View key={s_.id} style={s.subjectCard}>
                  {/* name row */}
                  <View style={s.subjectHeader}>
                    <TextInput
                      style={s.subjectNameInput}
                      placeholder={`subject ${idx + 1}`}
                      placeholderTextColor={tColors.textTertiary}
                      value={s_.name}
                      onChangeText={(v) => updateSubject(s_.id, 'name', v)}
                    />
                    {subjects.length > 1 && (
                      <TouchableOpacity onPress={() => removeSubject(s_.id)} style={s.removeBtn} activeOpacity={0.7}>
                        <Text style={s.removeBtnText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* number inputs with steppers */}
                  <View style={s.inputRow}>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>ATTENDED</Text>
                      <View style={s.stepperRow}>
                        <TouchableOpacity
                          style={s.stepBtn}
                          onPress={() => step(s_.id, 'attended', -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={s.numberInput}
                          placeholder="0"
                          placeholderTextColor={tColors.textTertiary}
                          value={s_.attended}
                          onChangeText={(v) => updateSubject(s_.id, 'attended', v)}
                          keyboardType="numeric"
                          textAlign="center"
                        />
                        <TouchableOpacity
                          style={s.stepBtn}
                          onPress={() => step(s_.id, 'attended', 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={s.slash}>/</Text>

                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>TOTAL HELD</Text>
                      <View style={s.stepperRow}>
                        <TouchableOpacity
                          style={s.stepBtn}
                          onPress={() => step(s_.id, 'total', -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={s.numberInput}
                          placeholder="0"
                          placeholderTextColor={tColors.textTertiary}
                          value={s_.total}
                          onChangeText={(v) => updateSubject(s_.id, 'total', v)}
                          keyboardType="numeric"
                          textAlign="center"
                        />
                        <TouchableOpacity
                          style={s.stepBtn}
                          onPress={() => step(s_.id, 'total', 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* quick-action pills */}
                  <View style={s.quickRow}>
                    <TouchableOpacity
                      style={[s.quickBtn, s.quickAttended]}
                      onPress={() => attended(s_.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.quickBtnText, { color: tColors.success }]}>✓ I attended</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.quickBtn, s.quickBunked]}
                      onPress={() => bunked(s_.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.quickBtnText, { color: tColors.warning }]}>I bunked 😅</Text>
                    </TouchableOpacity>
                  </View>

                  {/* progress bar */}
                  <View style={s.progressTrack}>
                    <View
                      pointerEvents="none"
                      style={[s.progressFill, { width: `${(fillPct * 100).toFixed(1)}%`, backgroundColor: barColor }]}
                    />
                    <View
                      pointerEvents="none"
                      style={[s.targetLine, { left: `${target}%` }]}
                    />
                  </View>

                  {/* result line */}
                  {r ? (
                    <View style={[s.resultRow, { backgroundColor: `${barColor}18` }]}>
                      <Text style={[s.resultPct, { color: barColor }]}>
                        {(r.pct * 100).toFixed(1)}%
                      </Text>
                      <Text style={[s.resultMsg, { color: barColor }]}>
                        {r.status === 'safe'
                          ? `can bunk ${r.canBunk} more classes 😎`
                          : r.status === 'warn'
                          ? `only ${r.canBunk} left to bunk ⚠️`
                          : `attend ${r.need} consecutive classes to recover 💀`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.resultPlaceholder}>fill in the numbers above</Text>
                  )}
                </View>
              );
            })}

            {/* ── add subject ── */}
            <TouchableOpacity style={s.addBtn} onPress={addSubject} activeOpacity={0.7}>
              <Text style={s.addBtnText}>+ add subject</Text>
            </TouchableOpacity>

            {/* ── summary ── */}
            <View style={s.summaryRow}>
              <View style={[s.chip, { backgroundColor: `${tColors.success}22`, borderColor: tColors.success }]}>
                <Text style={[s.chipText, { color: tColors.success }]}>safe 😎  {safe}</Text>
              </View>
              <View style={[s.chip, { backgroundColor: `${tColors.warning}22`, borderColor: tColors.warning }]}>
                <Text style={[s.chipText, { color: tColors.warning }]}>danger zone ⚠️  {warn}</Text>
              </View>
              <View style={[s.chip, { backgroundColor: `${tColors.error}22`, borderColor: tColors.error }]}>
                <Text style={[s.chipText, { color: tColors.error }]}>cooked 💀  {danger}</Text>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const THUMB = 22;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },

  header: {
    paddingHorizontal: tSpacing.base,
    paddingTop: tSpacing.md,
    paddingBottom: tSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
  },
  secretBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    borderRadius: tRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: tSpacing.sm,
  },
  secretBadgeText: {
    fontSize: 10,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: typography.extrabold,
    color: tColors.textPrimary,
    letterSpacing: -0.5,
  },
  closeBtn: { padding: tSpacing.sm },
  closeText: { fontSize: 20, color: tColors.textSecondary },
  subtitle: {
    fontSize: 11,
    color: tColors.textTertiary,
    marginTop: 3,
    fontStyle: 'italic',
  },

  scroll: {
    paddingHorizontal: tSpacing.base,
    paddingTop: tSpacing.md,
    paddingBottom: 60,
    gap: tSpacing.sm,
  },

  // ── slider ──
  sliderCard: {
    backgroundColor: '#111',
    borderRadius: tRadius.lg,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: tSpacing.base,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: tSpacing.md,
  },
  sliderLabel: {
    fontSize: 11,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sliderValue: {
    fontSize: 30,
    fontWeight: typography.extrabold,
    color: tColors.student.primary,
  },
  sliderTrack: {
    height: 30,
    backgroundColor: '#1C1C1C',
    borderRadius: tRadius.full,
    justifyContent: 'center',
    marginBottom: tSpacing.xs,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 9,
    height: 12,
    borderRadius: tRadius.full,
    backgroundColor: tColors.student.primary,
  },
  sliderThumb: {
    position: 'absolute',
    top: 4,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: tColors.student.primary,
  },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderEnd: { fontSize: 10, color: tColors.textTertiary },

  // ── subject card ──
  subjectCard: {
    backgroundColor: '#111',
    borderRadius: tRadius.lg,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    padding: tSpacing.base,
    gap: tSpacing.sm,
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: tSpacing.sm },
  subjectNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: typography.bold,
    color: tColors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    paddingBottom: 4,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 20, color: tColors.textSecondary, lineHeight: 24 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tSpacing.sm,
  },
  inputGroup: { flex: 1 },
  inputLabel: {
    fontSize: 9,
    color: tColors.textTertiary,
    fontWeight: typography.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 36,
    borderRadius: tRadius.sm,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    color: tColors.textSecondary,
    lineHeight: 22,
    fontWeight: typography.bold,
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: tRadius.sm,
    paddingVertical: tSpacing.sm,
    color: tColors.textPrimary,
    fontSize: 18,
    fontWeight: typography.bold,
  },
  slash: {
    fontSize: 22,
    color: tColors.textTertiary,
    marginBottom: tSpacing.xs,
  },

  // ── quick-action pills ──
  quickRow: {
    flexDirection: 'row',
    gap: tSpacing.sm,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: tRadius.full,
    alignItems: 'center',
    borderWidth: 1,
  },
  quickAttended: {
    backgroundColor: `${tColors.success}14`,
    borderColor: `${tColors.success}55`,
  },
  quickBunked: {
    backgroundColor: `${tColors.warning}14`,
    borderColor: `${tColors.warning}55`,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: typography.semibold,
  },

  // ── progress bar ──
  progressTrack: {
    height: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: tRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: tRadius.full,
  },
  targetLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // ── result ──
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tSpacing.sm,
    paddingVertical: tSpacing.sm,
    paddingHorizontal: tSpacing.md,
    borderRadius: tRadius.sm,
  },
  resultPct: {
    fontSize: 13,
    fontWeight: typography.bold,
    minWidth: 52,
  },
  resultMsg: {
    fontSize: 12,
    fontWeight: typography.medium,
    flex: 1,
  },
  resultPlaceholder: {
    fontSize: 11,
    color: tColors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 2,
  },

  // ── add / summary ──
  addBtn: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
    borderRadius: tRadius.md,
    paddingVertical: tSpacing.md,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 13,
    color: tColors.textSecondary,
    fontWeight: typography.semibold,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: tSpacing.sm,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tRadius.sm,
    paddingVertical: tSpacing.sm,
    paddingHorizontal: tSpacing.xs,
    alignItems: 'center',
  },
  chipText: { fontSize: 10, fontWeight: typography.bold },
});
