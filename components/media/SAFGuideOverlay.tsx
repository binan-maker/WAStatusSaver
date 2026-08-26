import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';

interface SAFGuideOverlayProps {
  visible: boolean;
}

export function SAFGuideOverlay({ visible }: SAFGuideOverlayProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      bounceAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.container}>
        <View style={styles.overlay} />
        <View style={styles.content}>
          <Text style={styles.title}>We&apos;re Opening Folders</Text>
          <Text style={styles.mainText}>
            The system opened the folder automatically.{'\n'}Look for the button below:
          </Text>
          <View style={styles.buttonBox}>
            <Text style={styles.buttonText}>USE THIS FOLDER</Text>
            <Text style={styles.orText}>or</Text>
            <Text style={styles.buttonText}>ALLOW</Text>
          </View>
          <Animated.View style={[styles.pointerContainer, { transform: [{ translateY }] }]}>
            <MaterialCommunityIcons name="hand-pointing-down" size={80} color={COLORS.PRIMARY} />
          </Animated.View>
          <Text style={styles.subText}>↓ TAP THE BUTTON BELOW ↓</Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 80 : 100,
    gap: 16,
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.PRIMARY,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  mainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  buttonBox: {
    backgroundColor: COLORS.PRIMARY + '22',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: COLORS.PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  orText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pointerContainer: {
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
  },
  subText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
});
