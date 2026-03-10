import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { FONT_SIZE } from '@/constants/theme';

const { height } = Dimensions.get('window');

interface SAFGuideOverlayProps {
  visible: boolean;
}

export function SAFGuideOverlay({ visible }: SAFGuideOverlayProps) {
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
          <Text style={styles.text}>
            Allow access to "Use this Folder" to save status
          </Text>
          <Animated.View style={[styles.pointerContainer, { transform: [{ translateY }] }]}>
            <MaterialCommunityIcons name="hand-pointing-down" size={80} color={COLORS.PRIMARY} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 60 : 80, // Adjust based on system button height
    gap: 20,
  },
  text: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 40,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  pointerContainer: {
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
});
