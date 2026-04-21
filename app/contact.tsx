import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseClientApp } from '@/lib/firebase-client';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/subscription/useSubscriptionStatus';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

const CONTACT_EMAIL = 'ahmedsameerbinan2@gmail.com';
const CONTACT_PHONE = '+919567873283';
const CONTACT_PHONE_DISPLAY = '+91 9567873283';

type FormType = 'feedback' | 'bug';

interface FormState {
  name: string;
  email: string;
  message: string;
}

const EMPTY_FORM: FormState = { name: '', message: '', email: '' };

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ContactItem({
  icon,
  label,
  value,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  color: string;
}) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <TouchableOpacity style={styles.contactItem} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.contactIconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={COLORS.TEXT_MUTED} />
    </TouchableOpacity>
  );
}

export default function ContactScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { user } = useFirebaseAuth();
  const { isSubscribed } = useSubscriptionStatus();
  const [activeType, setActiveType] = useState<FormType>('feedback');
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    email: user?.email || '',
    name: user?.displayName || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const headerPaddingTop = Platform.OS === 'web' ? 67 : insets.top;

  const handleSubmit = async () => {
    if (!form.message.trim()) {
      Alert.alert('Message Required', 'Please write your message before submitting.');
      return;
    }
    if (form.message.trim().length < 10) {
      Alert.alert('Too Short', 'Please provide a bit more detail (at least 10 characters).');
      return;
    }

    const app = getFirebaseClientApp();
    if (!app) {
      Alert.alert(
        'Offline',
        'Could not connect to the server. Please check your internet connection and try again.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'feedback'), {
        type: activeType,
        message: form.message.trim(),
        name: form.name.trim() || null,
        contactEmail: form.email.trim() || null,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        priority: isSubscribed,
        deviceModel: Device.modelName || Device.deviceName || 'Unknown',
        osVersion: Platform.OS === 'android' ? `Android ${Platform.Version}` : `iOS ${Platform.Version}`,
        status: 'open',
        createdAt: serverTimestamp(),
      });

      setForm({ ...EMPTY_FORM, email: user?.email || '', name: user?.displayName || '' });

      Alert.alert(
        activeType === 'bug' ? 'Bug Report Sent' : 'Feedback Sent',
        isSubscribed
          ? 'Thank you! As a Pro subscriber your report has been marked as priority and will be reviewed first.'
          : 'Thank you! Your feedback has been received. We ll review it soon.',
      );
    } catch {
      Alert.alert(
        'Submission Failed',
        'Something went wrong while sending your message. Please try again or email us directly.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={[styles.header, { paddingTop: headerPaddingTop + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Feedback & Support</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isSubscribed && (
          <View style={styles.priorityBanner}>
            <MaterialCommunityIcons name="crown" size={16} color={COLORS.ACCENT_GOLD} />
            <Text style={styles.priorityText}>
              Pro subscriber — your reports are reviewed first
            </Text>
          </View>
        )}

        <Text style={styles.sectionHeader}>CONTACT US DIRECTLY</Text>
        <View style={styles.card}>
          <ContactItem
            icon="mail-outline"
            label="Email"
            value={CONTACT_EMAIL}
            color={COLORS.PRIMARY}
            onPress={() =>
              Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=StatusVault%20Support`).catch(() =>
                Alert.alert('Could not open mail app', `Email us at: ${CONTACT_EMAIL}`),
              )
            }
          />
          <ContactItem
            icon="call-outline"
            label="Phone / WhatsApp"
            value={CONTACT_PHONE_DISPLAY}
            color={COLORS.ACCENT_BLUE}
            onPress={() =>
              Linking.openURL(`https://wa.me/${CONTACT_PHONE.replace('+', '')}`).catch(() =>
                Linking.openURL(`tel:${CONTACT_PHONE}`).catch(() => {}),
              )
            }
          />
        </View>

        <Text style={styles.sectionHeader}>SEND A MESSAGE</Text>

        <View style={styles.tabRow}>
          <TabButton
            label="💬  Feedback"
            active={activeType === 'feedback'}
            onPress={() => setActiveType('feedback')}
          />
          <TabButton
            label="🐛  Report a Bug"
            active={activeType === 'bug'}
            onPress={() => setActiveType('bug')}
          />
        </View>

        {activeType === 'bug' && (
          <View style={styles.bugHint}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.ACCENT_BLUE} />
            <Text style={styles.bugHintText}>
              Describe what happened, what you expected, and the steps to reproduce it. Device info
              is attached automatically.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Your Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Rahul"
              placeholderTextColor={COLORS.TEXT_MUTED}
              maxLength={60}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Your Email (optional — for reply)</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.TEXT_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {activeType === 'bug' ? 'Describe the bug *' : 'Your feedback *'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.message}
              onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
              placeholder={
                activeType === 'bug'
                  ? 'What happened? What were you doing when the bug occurred? What did you expect?'
                  : 'Share your thoughts, suggestions, or anything you love or dislike about the app…'
              }
              placeholderTextColor={COLORS.TEXT_MUTED}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{form.message.length}/2000</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <LinearGradient
            colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={activeType === 'bug' ? 'bug-outline' : 'send-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.submitText}>
                  {activeType === 'bug' ? 'Submit Bug Report' : 'Send Feedback'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Your device model and OS version are automatically included to help us debug issues.
          {isSubscribed ? '\nAs a Pro subscriber your submission is marked as priority.' : ''}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.LG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.LG,
    gap: SPACING.SM,
  },
  priorityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.ACCENT_GOLD + '18',
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GOLD + '44',
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 10,
    marginTop: SPACING.MD,
  },
  priorityText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.ACCENT_GOLD,
    fontFamily: 'Nunito_600SemiBold',
    flex: 1,
  },
  sectionHeader: {
    fontSize: FONT_SIZE.XS,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.LG,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  contactValue: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    marginTop: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.SM,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.PRIMARY + '18',
    borderColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  tabTextActive: {
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
  },
  bugHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.ACCENT_BLUE + '12',
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_BLUE + '30',
  },
  bugHintText: {
    flex: 1,
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 18,
  },
  inputGroup: {
    paddingHorizontal: SPACING.MD,
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  inputLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
    marginBottom: 6,
  },
  input: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_400Regular',
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.SM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 10,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'right',
    marginTop: 4,
  },
  submitBtn: {
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    marginTop: SPACING.SM,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  submitText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  footerNote: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.MD,
  },
});
