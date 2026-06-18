import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

type TagColorKey = 'PRIMARY' | 'ACCENT_GOLD' | 'ACCENT_BLUE' | 'ACCENT_PINK' | 'ERROR';

interface AccordionItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
  tag?: string;
  tagColor?: TagColorKey;
}

const FAQ_ITEMS: AccordionItem[] = [
  {
    title: 'Saved statuses survive app uninstall',
    icon: 'shield-checkmark-outline',
    tag: 'Important',
    tagColor: 'PRIMARY',
    content: [
      'Every status you save through Status Saver is written to your phone\'s public gallery, inside an album called "Status Saver" (located at /Pictures/Status Saver/).',
      '',
      'Because the file lives in your gallery — not inside the app\'s private storage — your saved photos and videos are NOT deleted when you:',
      '   • Uninstall and re-install Status Saver',
      '   • Clear the app\'s data or cache',
      '   • Factory-reset is the only thing that wipes the album.',
      '',
      'After re-installing, open the Saved tab once. Status Saver automatically scans the "Status Saver" album in your gallery and re-attaches any items it finds there, so they show up again under Saved without you doing anything.',
      '',
      'If you ever want a saved item gone, delete it from the Saved tab inside the app (or from your gallery directly).',
      '',
      '⚠ IMPORTANT — Folder access after reinstall:',
      'Your SAVED FILES stay in the gallery (as above), but the WhatsApp folder PERMISSION is tied to the app\'s installation. Android revokes it on uninstall.',
      '→ After reinstalling, go to Home → "Grant Access" and re-grant access to the WhatsApp Media folder. This is an Android OS requirement — Status Saver cannot bypass it.',
      '→ You will NOT need to re-save any files — they are already in your gallery.',
    ],
  },
  {
    title: 'Initial Setup — Android 5 to 9',
    icon: 'phone-portrait-outline',
    tag: 'Legacy',
    tagColor: 'ACCENT_GOLD',
    content: [
      '1. Open Status Saver and tap "Grant Access".',
      '2. Allow media/storage permission when prompted.',
      '3. Status Saver can now directly read WhatsApp statuses.',
      '4. Open WhatsApp → Status tab and view statuses to load them.',
      '5. Return to Status Saver and pull down to refresh.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 10',
    icon: 'phone-portrait-outline',
    tag: 'Android 10',
    tagColor: 'ACCENT_BLUE',
    content: [
      '1. Open Status Saver → Grant Access → Allow media permission.',
      '2. Status Saver uses scoped storage but can still read the status folder.',
      '3. Open WhatsApp, view statuses, then refresh Status Saver.',
      '',
      'If statuses don\'t load:',
      '→ Go to Settings → Grant Access → Select Statuses Folder.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 11, 12, 13, 14, 15+',
    icon: 'shield-outline',
    tag: 'Android 11+',
    tagColor: 'PRIMARY',
    content: [
      'Android 11+ uses strict scoped storage (Storage Access Framework). You must grant access to the WhatsApp Media folder ONCE.',
      '',
      '1. Open Status Saver. The Home screen shows a top source selector with two chips: "WhatsApp" (default) and "WhatsApp Business".',
      '2. Tap "Grant Access" on the empty state, or open the source chip you want.',
      '3. The Android folder picker opens AT the correct Media folder automatically. You should NOT have to navigate.',
      '4. Tap "USE THIS FOLDER" and accept the permission prompt.',
      '5. Statuses appear within 1–2 seconds. If you see an empty grid, tap the refresh icon — Android sometimes needs a moment to mount the folder.',
      '',
      'Note: Permission persists across reboots, app updates, and app restarts — Android remembers your choice. You only re-grant if you UNINSTALL the app (Android ties the permission to the installation). After a reinstall, just repeat Step 3–4 above once.',
      '',
      'If your phone has WhatsApp under a Work Profile or Dual-App / Clone-App slot, the picker may open at the wrong Media folder. Use Settings → "Browse manually" to pick the folder yourself.',
      '',
      'Folders the picker opens at:',
      '   Android → media → com.whatsapp → WhatsApp → Media',
      '   Android → media → com.whatsapp.w4b → WhatsApp Business → Media',
    ],
  },
  {
    title: 'How to Save a Status',
    icon: 'download-outline',
    content: [
      '1. On the Home tab, browse images and videos.',
      '2. Tap any image or video to open the fullscreen viewer.',
      '3. Tap the "Save" button at the bottom of the viewer.',
      '4. Or tap the download icon (⬇) directly on the grid card.',
      '5. Saved statuses appear in the Saved tab.',
      '6. They are also saved to your Gallery under the "Status Saver" album.',
    ],
  },
  {
    title: 'How to Share a Status',
    icon: 'share-social-outline',
    content: [
      '1. Tap any status to open it in the fullscreen viewer.',
      '2. Tap the "Share" button to share to any installed app.',
      '3. Tap the "WhatsApp" button to share directly back to WhatsApp.',
      '4. You can also tap the share icon (↑) on any card in the grid.',
      '5. To share saved statuses, go to the Saved tab and tap share.',
    ],
  },
  {
    title: 'WhatsApp Business Statuses',
    icon: 'briefcase-outline',
    content: [
      'Status Saver supports both WhatsApp and WhatsApp Business.',
      '',
      'If you have WhatsApp Business installed:',
      '→ Business statuses are automatically detected.',
      '→ They are marked with a briefcase icon.',
      '',
      'Business Status path (Android < 11):',
      '/storage/emulated/0/WhatsApp Business/Media/.Statuses',
      '',
      'For Android 11+, select this folder using SAF:',
      '   Android → media → com.whatsapp.w4b → WhatsApp Business → Media',
    ],
  },
  {
    title: 'Theme — Follows Your System',
    icon: 'contrast-outline',
    tag: 'Dark / Light',
    tagColor: 'ACCENT_BLUE',
    content: [
      'Status Saver automatically matches your phone\'s system theme. There is no in-app theme picker.',
      '',
      '→ Phone is in Dark mode → Status Saver is dark (deep navy + emerald).',
      '→ Phone is in Light mode → Status Saver is light.',
      '→ Switching your system theme updates Status Saver instantly — including the Android status bar and navigation bar.',
      '',
      'To change the theme:',
      '→ Android Settings → Display → Dark theme (toggle on/off), or',
      '→ Use the system Dark Mode quick tile from your notification shade.',
    ],
  },
  {
    title: 'Statuses Not Showing?',
    icon: 'help-circle-outline',
    content: [
      'Common solutions, in order of likelihood:',
      '',
      '→ Open WhatsApp and view/tap on statuses first.',
      '   WhatsApp only writes a status file to disk AFTER you view it inside WhatsApp.',
      '',
      '→ Pull down to refresh the Status Saver home screen, or tap the refresh icon in the header.',
      '',
      '→ For Android 11+: confirm you granted SAF access at the WhatsApp Media folder, not at a parent folder. Settings → Grant Access → re-pick the folder if unsure.',
      '',
      '→ Just reinstalled the app? Android wipes folder permissions on uninstall. Go to Home → "Grant Access" and re-grant access to the WhatsApp Media folder.',
      '',
      '→ Use the source chip at the top to switch between WhatsApp and WhatsApp Business — each source has its own permission and grid.',
      '',
      '→ If you use a Work Profile, Dual-App, or Clone-App slot, your statuses live in a non-standard path. Use Settings → "Browse manually" to pick that folder yourself.',
      '',
      '→ Some custom ROMs (MIUI, ColorOS, HyperOS, OxygenOS) sandbox folder access. If statuses still don\'t appear after a refresh, try: Android Settings → Apps → Status Saver → Permissions → enable any storage-related toggles, then re-grant access in Status Saver.',
    ],
  },
  {
    title: 'Privacy & Data Safety',
    icon: 'lock-closed-outline',
    content: [
      'Your media always stays on your device:',
      '',
      '✓ Status files are never uploaded to our servers.',
      '✓ We do not read WhatsApp messages or chats.',
      '✓ We do not access your contacts.',
      '✓ Core features (viewing, saving, sharing) work fully offline.',
      '✓ No internet connection is required.',
      '',
      '✓ Compliant with Google Play Store, GDPR, and Indian IT Act policies.',
      '',
      'Status Saver is NOT affiliated with WhatsApp LLC or Meta.',
      '',
      'Status Saver is currently in Beta. Features and policies may change.',
    ],
  },
];

function AccordionCard({ item }: { item: AccordionItem }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.cardHeader}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, expanded && { backgroundColor: COLORS.PRIMARY + '22' }]}>
            <Ionicons name={item.icon} size={18} color={expanded ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.tag && (() => {
              const tagHex = item.tagColor ? COLORS[item.tagColor] : COLORS.PRIMARY;
              return (
                <View style={[styles.cardTag, { backgroundColor: tagHex + '22' }]}>
                  <Text style={[styles.cardTagText, { color: tagHex }]}>{item.tag}</Text>
                </View>
              );
            })()}
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.TEXT_MUTED}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.cardBody}>
          {item.content.map((line, i) => {
            if (line === '') return <View key={i} style={{ height: 6 }} />;
            const isPath = line.startsWith('/storage');
            const isStep = /^\d+\./.test(line);
            const isNote = line.startsWith('Note:') || line.startsWith('→') || line.startsWith('✓');
            const isSeparator = line.startsWith('—') && line.endsWith('—');
            return (
              <Text
                key={i}
                style={[
                  styles.bodyLine,
                  isPath && styles.pathLine,
                  isStep && styles.stepLine,
                  isNote && styles.noteLine,
                  isSeparator && styles.separatorLine,
                ]}
              >
                {line}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="book-outline" size={36} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>Complete Guide</Text>
          <Text style={styles.heroSub}>
            Everything you need to know to set up and use Status Saver on any Android device.
          </Text>
        </View>

        <View style={styles.quickInfo}>
          {[
            { icon: 'phone-portrait-outline' as const, text: 'Android 5+' },
            { icon: 'wifi-outline' as const, text: 'Optional Online' },
            { icon: 'lock-closed-outline' as const, text: 'Media Stays Local' },
            { icon: 'flask-outline' as const, text: 'Beta' },
          ].map((item, i) => (
            <View key={i} style={styles.quickChip}>
              <Ionicons name={item.icon} size={14} color={COLORS.PRIMARY} />
              <Text style={styles.quickChipText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.accordionList}>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionCard key={i} item={item} />
          ))}
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.footerText}>
            Status Saver Beta — Your privacy-first status saver.{'\n'}
            Not affiliated with WhatsApp or Meta.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  hero: {
    alignItems: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.LG,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  heroSub: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Nunito_400Regular',
  },
  quickInfo: {
    flexDirection: 'row',
    gap: SPACING.SM,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.SURFACE_2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  quickChipText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  accordionList: {
    gap: SPACING.SM,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    flex: 1,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.SM,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    flexShrink: 1,
  },
  cardTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.FULL,
  },
  cardTagText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  cardBody: {
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.LG,
    paddingTop: SPACING.SM,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  bodyLine: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
  pathLine: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontSize: FONT_SIZE.XS,
    color: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY + '11',
    padding: 6,
    borderRadius: RADIUS.XS,
    marginVertical: 2,
  },
  stepLine: {
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
  },
  noteLine: {
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  separatorLine: {
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
    fontSize: FONT_SIZE.XS,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.XL,
    gap: SPACING.SM,
  },
  footerText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
});
