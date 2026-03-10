import React, { useState } from 'react';
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
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface AccordionItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
  tag?: string;
  tagColor?: string;
}

const FAQ_ITEMS: AccordionItem[] = [
  {
    title: 'Initial Setup — Android 5 to 9',
    icon: 'phone-portrait-outline',
    tag: 'Legacy',
    tagColor: COLORS.ACCENT_GOLD,
    content: [
      '1. Open StatusVault and tap "Grant Access".',
      '2. Allow media/storage permission when prompted.',
      '3. StatusVault can now directly read WhatsApp statuses.',
      '4. Open WhatsApp → Status tab and view statuses to load them.',
      '5. Return to StatusVault and pull down to refresh.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 10',
    icon: 'phone-portrait-outline',
    tag: 'Android 10',
    tagColor: COLORS.ACCENT_BLUE,
    content: [
      '1. Open StatusVault → Grant Access → Allow media permission.',
      '2. StatusVault uses scoped storage but can still read the status folder.',
      '3. Open WhatsApp, view statuses, then refresh StatusVault.',
      '',
      'If statuses don\'t load:',
      '→ Go to Settings → Grant Access → Select Statuses Folder.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 11, 12, 13, 14+',
    icon: 'shield-outline',
    tag: 'Android 11+',
    tagColor: COLORS.PRIMARY,
    content: [
      'Android 11+ uses strict scoped storage (SAF). You must manually select the WhatsApp Media folder:',
      '',
      '1. Open StatusVault → Settings → Grant Access.',
      '2. Tap "Select Media Folder".',
      '3. In the system file picker, navigate to:',
      '   Android → media → com.whatsapp → WhatsApp → Media',
      '4. Tap "USE THIS FOLDER" and confirm.',
      '5. Return to StatusVault — statuses will appear.',
      '',
      'Note: You only need to do this ONCE.',
      '',
      'WhatsApp Business folder:',
      '   Android → media → com.whatsapp.w4b → WhatsApp Business → Media',
    ],
  },
  {
    title: 'How to Save a Status',
    icon: 'download-outline',
    content: [
      '1. On the Home tab, you\'ll see images and videos tabs.',
      '2. Tap an image or video to open the fullscreen viewer.',
      '3. Tap the "Save" button at the bottom.',
      '4. Or tap the download icon (⬇) on the card directly.',
      '5. Saved statuses appear in the Saved tab.',
      '6. They are also saved to your Gallery under the "StatusVault" album.',
    ],
  },
  {
    title: 'How to Share a Status',
    icon: 'share-social-outline',
    content: [
      '1. Tap any status to open it in the viewer.',
      '2. Tap the "Share" button to share to any app.',
      '3. Tap the "WhatsApp" button to share directly to WhatsApp.',
      '4. You can also tap the share icon (↑) on any card in the grid.',
      '5. To share saved statuses, go to the Saved tab and tap share.',
    ],
  },
  {
    title: 'WhatsApp Business Statuses',
    icon: 'briefcase-outline',
    content: [
      'StatusVault supports both WhatsApp and WhatsApp Business.',
      '',
      'If you have WhatsApp Business installed:',
      '→ Business statuses are automatically detected.',
      '→ They\'re marked with a briefcase icon.',
      '',
      'Business Status path (Android < 11):',
      '/storage/emulated/0/WhatsApp Business/Media/.Statuses',
      '',
      'For Android 11+, select this folder using SAF.',
    ],
  },
  {
    title: 'Statuses Not Showing?',
    icon: 'help-circle-outline',
    content: [
      'Common solutions:',
      '',
      '→ Open WhatsApp and view/tap on statuses first.',
      '   WhatsApp only saves a status file after you view it.',
      '',
      '→ Pull down to refresh the StatusVault home screen.',
      '',
      '→ For Android 11+: Make sure you\'ve selected the correct SAF folder (see setup above).',
      '',
      '→ Check that WhatsApp is installed at the standard location.',
      '',
      '→ Some custom ROMs (MIUI, ColorOS) may restrict folder access.',
      '   Go to Settings → Privacy → Special app access → Files and media.',
    ],
  },
  {
    title: 'Privacy & Data Safety',
    icon: 'lock-closed-outline',
    content: [
      'StatusVault is 100% offline and private:',
      '',
      '✓ No internet connection required.',
      '✓ No data leaves your device.',
      '✓ We do not read WhatsApp messages.',
      '✓ We do not access contacts.',
      '✓ We do not collect analytics.',
      '✓ Saved files stay on your device only.',
      '✓ Compliant with Play Store and Indus App Store policies.',
      '',
      'StatusVault is not affiliated with WhatsApp LLC or Meta.',
    ],
  },
];

function AccordionCard({ item }: { item: AccordionItem }) {
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
            {item.tag && (
              <View style={[styles.cardTag, { backgroundColor: (item.tagColor || COLORS.PRIMARY) + '22' }]}>
                <Text style={[styles.cardTagText, { color: item.tagColor || COLORS.PRIMARY }]}>{item.tag}</Text>
              </View>
            )}
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
            return (
              <Text
                key={i}
                style={[
                  styles.bodyLine,
                  isPath && styles.pathLine,
                  isStep && styles.stepLine,
                  isNote && styles.noteLine,
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
            Everything you need to know to use StatusVault on any Android device.
          </Text>
        </View>

        <View style={styles.quickInfo}>
          {[
            { icon: 'phone-portrait-outline' as const, text: 'Android 5+' },
            { icon: 'wifi-outline' as const, text: '100% Offline' },
            { icon: 'lock-closed-outline' as const, text: 'Private' },
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
            StatusVault — Your privacy-first status saver.{'\n'}
            Not affiliated with WhatsApp or Meta.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 0,
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
