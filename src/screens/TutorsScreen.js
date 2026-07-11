import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, FlatList, Modal, Alert } from 'react-native';
import { tutors as seedTutors } from '../data';
import { colors, spacing, radius, font, avatarColor, initials, courseColor } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { BookMarked, Search, Pin, Sparkles, X, CheckCircle2, CreditCard, Clock, Star, Check } from 'lucide-react-native';

const TYPES = ['All', 'Free', 'Paid'];
const COURSES = ['All', 'BCom IAF', 'BCom F&A', 'BCom IBA'];

export default function TutorsScreen() {
  const [tutors, setTutors] = useState(seedTutors);
  const [type, setType] = useState('All');
  const [course, setCourse] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [bookingTutor, setBookingTutor] = useState(null);
  const [bookingState, setBookingState] = useState('idle'); // idle | processing | success

  // Form state for create posting
  const [form, setForm] = useState({
    course: '',
    type: 'free',
    price: '',
    topics: '',
    slots: '',
    bio: '',
  });

  const filtered = useMemo(() => tutors.filter(t => {
    const q = search.toLowerCase();
    const mq = !q || t.name.toLowerCase().includes(q) || t.topics.some(tp => tp.toLowerCase().includes(q));
    const mt = type === 'All' || (type === 'Free' ? t.type === 'free' : t.type === 'paid');
    const mc = course === 'All' || t.course === course;
    return mq && mt && mc;
  }), [tutors, search, type, course]);

  const myPostings = filtered.filter(t => t.isMine);
  const otherPostings = filtered.filter(t => !t.isMine);

  const handleCreate = () => {
    if (!form.course || !form.topics.trim() || !form.slots.trim()) {
      Alert.alert('Missing info', 'Please fill in course, topics, and availability.');
      return;
    }
    if (form.type === 'paid' && !form.price.trim()) {
      Alert.alert('Missing info', 'Please enter a price for paid tuition.');
      return;
    }
    const newPosting = {
      id: Date.now(),
      name: 'Srikrishna',
      course: form.course,
      year: '3rd Year',
      rating: 0,
      reviews: 0,
      type: form.type,
      price: form.type === 'paid' ? parseInt(form.price) : 0,
      topics: form.topics.split(',').map(t => t.trim()).filter(Boolean),
      slots: form.slots,
      verified: false,
      bio: form.bio || `${form.type === 'paid' ? 'Paid' : 'Free'} tuition for ${form.topics}.`,
      isMine: true,
    };
    setTutors([newPosting, ...tutors]);
    setShowCreate(false);
    setForm({ course: '', type: 'free', price: '', topics: '', slots: '', bio: '' });
    Alert.alert('Posted!', 'Your tuition posting is now live.');
  };

  const handleBook = (tutor) => {
    setBookingTutor(tutor);
    setBookingState('idle');
  };

  const handlePayUPI = () => {
    setBookingState('processing');
    setTimeout(() => setBookingState('success'), 1500);
  };

  const handleRequestFree = (tutor) => {
    Alert.alert(
      'Request sent',
      `Your session request has been sent to ${tutor.name}. They'll reach out to confirm a time.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tutors, topics..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.createBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Type pills */}
      <View style={styles.pillRow}>
        {TYPES.map(t => {
          const active = type === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setType(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Course pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coursePillRow}>
        {COURSES.map(c => {
          const active = course === c;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.pill, styles.coursePill, active && styles.pillActive]}
              onPress={() => setCourse(c)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lists */}
      <FlatList
        data={[]}
        keyExtractor={() => 'x'}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {myPostings.length > 0 && (
              <>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Pin size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>MY POSTINGS ({myPostings.length})</Text></View>
                {myPostings.map(t => (
                  <TutorCard
                    key={t.id}
                    tutor={t}
                    onAction={() => Alert.alert('Manage posting', 'Edit or delete coming soon.')}
                    isMine
                  />
                ))}
              </>
            )}

            <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Sparkles size={13} color={colors.textTertiary} /><Text style={styles.sectionLabel}>AVAILABLE TUTORS ({otherPostings.length})</Text></View>
            {otherPostings.length === 0 ? (
              <EmptyState icon={BookMarked} heading="No tutors listed yet" subtext="Be the first to offer tutoring in your subject" />
            ) : (
              otherPostings.map(t => (
                <TutorCard
                  key={t.id}
                  tutor={t}
                  onAction={() => t.type === 'paid' ? handleBook(t) : handleRequestFree(t)}
                />
              ))
            )}
          </>
        }
      />

      {/* Create posting modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.modalHeader}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Sparkles size={16} color={colors.textPrimary} /><Text style={styles.modalTitle}>Post Tuition</Text></View>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>COURSE</Text>
            <View style={styles.modalPillRow}>
              {COURSES.slice(1).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.modalPill, form.course === c && styles.modalPillActive]}
                  onPress={() => setForm({ ...form, course: c })}
                >
                  <Text style={[styles.modalPillText, form.course === c && styles.modalPillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>TUITION TYPE</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeOption, form.type === 'free' && styles.typeOptionActiveFree]}
                onPress={() => setForm({ ...form, type: 'free', price: '' })}
              >
                <Text style={[styles.typeOptionText, form.type === 'free' && { color: colors.green }]}>
                  FREE
                </Text>
                <Text style={styles.typeOptionSub}>Peer help · giveback</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, form.type === 'paid' && styles.typeOptionActivePaid]}
                onPress={() => setForm({ ...form, type: 'paid' })}
              >
                <Text style={[styles.typeOptionText, form.type === 'paid' && { color: colors.primary }]}>
                  PAID
                </Text>
                <Text style={styles.typeOptionSub}>Per session · UPI</Text>
              </TouchableOpacity>
            </View>

            {form.type === 'paid' && (
              <>
                <Text style={styles.modalLabel}>PRICE PER SESSION (₹)</Text>
                <TextInput
                  value={form.price}
                  onChangeText={t => setForm({ ...form, price: t.replace(/[^0-9]/g, '') })}
                  placeholder="e.g. 199"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  style={styles.modalInput}
                />
              </>
            )}

            <Text style={styles.modalLabel}>TOPICS (comma-separated)</Text>
            <TextInput
              value={form.topics}
              onChangeText={t => setForm({ ...form, topics: t })}
              placeholder="e.g. AA Paper, Ethics, MCQs"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>AVAILABILITY</Text>
            <TextInput
              value={form.slots}
              onChangeText={t => setForm({ ...form, slots: t })}
              placeholder="e.g. Weekday evenings, 6–8pm"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>SHORT BIO (optional)</Text>
            <TextInput
              value={form.bio}
              onChangeText={t => setForm({ ...form, bio: t })}
              placeholder="Why should they pick you?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              multiline
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Post Tuition</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Booking modal (paid only — fake UPI flow) */}
      <Modal visible={bookingTutor !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bookSheet}>
            {bookingState === 'success' ? (
              <View style={{ alignItems: 'center', padding: spacing.lg }}>
                <CheckCircle2 size={32} color={colors.success} />
                <Text style={styles.successTitle}>Session Booked!</Text>
                <Text style={styles.successDesc}>
                  {bookingTutor?.name} will be notified. You'll get a confirmation within 24 hours.
                </Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: spacing.lg, width: '100%' }]}
                  onPress={() => { setBookingTutor(null); setBookingState('idle'); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8}}><CreditCard size={18} color={colors.textPrimary} /><Text style={styles.modalTitle}>Book Session</Text></View>
                  <TouchableOpacity onPress={() => { setBookingTutor(null); setBookingState('idle'); }}>
                    <X size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {bookingTutor && (
                  <View style={styles.bookSummary}>
                    <Text style={styles.bookTutorName}>{bookingTutor.name}</Text>
                    <Text style={styles.bookCourse}>{bookingTutor.class || `${bookingTutor.course} · ${bookingTutor.year}`}</Text>
                    <View style={styles.bookPriceBox}>
                      <Text style={styles.bookPriceLabel}>Amount</Text>
                      <Text style={styles.bookPriceValue}>₹{bookingTutor.price}</Text>
                    </View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Clock size={14} color={colors.textSecondary} /><Text style={styles.bookSlot}>{bookingTutor.slots}</Text></View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.payBtn, bookingState === 'processing' && { opacity: 0.6 }]}
                  onPress={handlePayUPI}
                  disabled={bookingState === 'processing'}
                  activeOpacity={0.85}
                >
                  <Text style={styles.payBtnText}>
                    {bookingState === 'processing' ? 'Opening UPI...' : 'Pay with UPI'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.payNote}>
                  Payment confirms your session. Tutor will be notified.
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TutorCard({ tutor, onAction, isMine }) {
  const av = avatarColor(tutor.name);
  const cc = courseColor(tutor.course);
  const isFree = tutor.type === 'free';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: av.bg }]}>
          <Text style={[styles.avatarText, { color: av.text }]}>{initials(tutor.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{tutor.name}</Text>
            {tutor.verified && (
              <View style={styles.verifiedBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Check size={12} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.coursePillSmall, { backgroundColor: cc.bg }]}>
              <Text style={[styles.coursePillText, { color: cc.text }]}>{tutor.class || tutor.course}</Text>
            </View>
          </View>
          {tutor.reviews > 0 && (
            <View style={styles.ratingRow}>
              <View style={{flexDirection:'row',gap:2}}>
                {Array.from({length: Math.floor(tutor.rating)}, (_, i) => <Star key={i} size={12} color={colors.warning} fill={colors.warning} />)}
              </View>
              <Text style={styles.ratingText}>{tutor.rating.toFixed(1)} ({tutor.reviews} reviews)</Text>
            </View>
          )}
        </View>
        <View style={[styles.priceTag, isFree && styles.freeTag]}>
          <Text style={[styles.priceTagText, isFree && { color: colors.green }]}>
            {isFree ? 'FREE' : `₹${tutor.price}`}
          </Text>
          {!isFree && <Text style={styles.priceTagSub}>per session</Text>}
        </View>
      </View>

      <Text style={styles.bio}>{tutor.bio}</Text>

      <View style={styles.topicsRow}>
        {tutor.topics.map(tp => (
          <View key={tp} style={styles.topicPill}>
            <Text style={styles.topicText}>{tp}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Clock size={13} color={colors.textSecondary} />
          <Text style={styles.slots}>{tutor.slots}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, isMine && styles.manageBtn, isFree && !isMine && styles.requestBtn]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionBtnText, isMine && styles.manageBtnText, isFree && !isMine && styles.requestBtnText]}>
            {isMine ? 'Manage' : isFree ? 'Request Session' : 'Book Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },

  topBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, justifyContent: 'center',
  },
  createBtnText: { fontSize: 13, color: '#fff', ...font.bold },

  pillRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  coursePillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: spacing.md, paddingVertical: 2 },
  coursePill: { marginRight: 0 },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 14, height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  pillTextActive: { color: '#fff', ...font.semibold },

  sectionLabel: {
    fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8,
    ...font.bold, marginBottom: spacing.sm, marginTop: spacing.md,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, ...font.bold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  name: { fontSize: 14, ...font.bold, color: colors.textPrimary },
  verifiedBadge: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
  },
  verifiedText: { fontSize: 9, color: colors.green, ...font.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coursePillSmall: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full },
  coursePillText: { fontSize: 9, ...font.bold, letterSpacing: 0.4 },
  metaText: { fontSize: 11, color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingStars: { fontSize: 10, color: colors.amber },
  ratingText: { fontSize: 10, color: colors.textTertiary },

  priceTag: {
    alignItems: 'flex-end',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md,
  },
  freeTag: { backgroundColor: colors.greenLight },
  priceTagText: { fontSize: 13, color: colors.primary, ...font.bold },
  priceTagSub: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },

  bio: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: spacing.sm },

  topicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: spacing.sm },
  topicPill: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full,
  },
  topicText: { fontSize: 10, color: colors.textSecondary },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  slots: { fontSize: 10, color: colors.textTertiary, flexShrink: 1 },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.sm,
  },
  manageBtn: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  requestBtn: { backgroundColor: colors.green },
  actionBtnText: { fontSize: 12, color: '#fff', ...font.bold },
  manageBtnText: { color: colors.primary },
  requestBtnText: { color: colors.textPrimary },

  emptyBox: { alignItems: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, color: colors.textSecondary },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '90%',
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, ...font.bold, color: colors.textPrimary },
  modalClose: { fontSize: 22, color: colors.textSecondary, padding: 4 },
  modalLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: 6, marginTop: spacing.sm },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary, fontSize: 14,
  },
  modalPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalPill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.bg,
  },
  modalPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalPillText: { fontSize: 12, color: colors.textSecondary, ...font.medium },
  modalPillTextActive: { color: '#fff' },

  typeToggle: { flexDirection: 'row', gap: 8 },
  typeOption: {
    flex: 1,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  typeOptionActiveFree: {
    backgroundColor: colors.greenLight,
    borderColor: colors.green,
  },
  typeOptionActivePaid: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeOptionText: { fontSize: 14, ...font.bold, color: colors.textPrimary, letterSpacing: 0.5 },
  typeOptionSub: { fontSize: 10, color: colors.textSecondary, marginTop: 4 },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, ...font.bold },

  bookSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.border,
  },
  bookSummary: { marginBottom: spacing.lg },
  bookTutorName: { fontSize: 17, ...font.bold, color: colors.textPrimary },
  bookCourse: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  bookPriceBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md, padding: spacing.md,
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  bookPriceLabel: { fontSize: 13, color: colors.textSecondary },
  bookPriceValue: { fontSize: 22, ...font.bold, color: colors.primary },
  bookSlot: { fontSize: 11, color: colors.textTertiary, marginTop: spacing.sm },

  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnText: { color: '#fff', fontSize: 15, ...font.bold },
  payNote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },

  successIcon: {
    fontSize: 48, color: colors.green,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.greenLight,
    textAlign: 'center', lineHeight: 80,
    marginBottom: spacing.md,
  },
  successTitle: { fontSize: 20, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  successDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});