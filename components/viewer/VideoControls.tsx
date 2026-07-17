/**
 * VideoControls — full-screen video controller overlay.
 *
 * Layout (z-order, bottom to top):
 *   1. Top gradient (non-interactive, subtle darkening for top bar visibility)
 *   2. Center play/pause button (box-none wrapper so only the circle is tappable)
 *   3. Bottom gradient + progress bar + time + mute
 *
 * Seeking is handled by the native responder system (onStartShouldSetResponder /
 * onResponderMove) on the progressArea View. This captures the touch before it
 * reaches the FlatList's horizontal scroll, so scrubbing never accidentally
 * swipes to the next status.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const THUMB_R = 7;

export interface VideoControlsProps {
  visible: boolean;
  paused: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onSeek: (time: number) => void;
  onControlTouch: () => void;
  /** Safe-area bottom inset (device nav bar height). Pass insets.bottom from the screen. */
  bottomInset?: number;
}

export function VideoControls({
  visible,
  paused,
  muted,
  currentTime,
  duration,
  onPlayPause,
  onMuteToggle,
  onSeek,
  onControlTouch,
  bottomInset = 0,
}: VideoControlsProps) {
  const [barWidth, setBarWidth] = useState(0);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const fillWidth = barWidth * progress;
  const thumbLeft = Math.max(THUMB_R, Math.min(fillWidth, barWidth - THUMB_R));

  const handleBarLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const seekFromEvent = useCallback(
    (e: GestureResponderEvent) => {
      if (barWidth <= 0 || duration <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
      onSeek(ratio * duration);
      onControlTouch();
    },
    [barWidth, duration, onSeek, onControlTouch],
  );

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── Top gradient (purely decorative) ───────────────────────────── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* ── Center play / pause ─────────────────────────────────────────
           box-none so taps on the empty area around the circle fall
           through to the video layer (which toggles controls visibility). */}
      <View style={[StyleSheet.absoluteFill, styles.centerArea, { paddingBottom: 80 + bottomInset }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.centerBtn}
          onPress={() => { onPlayPause(); onControlTouch(); }}
          activeOpacity={0.75}
        >
          <View style={styles.centerBtnInner}>
            <Ionicons
              name={paused ? 'play' : 'pause'}
              size={32}
              color="#fff"
              style={paused ? styles.playIconOffset : undefined}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Bottom gradient + controls ──────────────────────────────────── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.92)']}
        style={[styles.bottomGradient, { paddingBottom: 18 + bottomInset }]}
        pointerEvents="box-none"
      >
        {/* Progress / seek bar
            onStartShouldSetResponder:  true  → capture touch immediately
            onMoveShouldSetResponder:   true  → keep it even if a Move starts
            So horizontal FlatList scroll cannot steal this touch once it
            starts on the seek bar. */}
        <View
          style={styles.progressArea}
          onLayout={handleBarLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={seekFromEvent}
          onResponderMove={seekFromEvent}
        >
          {/* Track */}
          <View style={styles.progressTrack} />
          {/* Playback fill */}
          <View style={[styles.progressFill, { width: fillWidth }]} />
          {/* Thumb dot — only render once barWidth is known */}
          {barWidth > 0 && (
            <View style={[styles.progressThumb, { left: thumbLeft - THUMB_R }]} />
          )}
        </View>

        {/* Time + mute row */}
        <View style={styles.bottomRow}>
          <Text style={styles.timeText}>
            {formatTime(currentTime)}
            {'  '}
            <Text style={styles.timeSep}>/</Text>
            {'  '}
            {formatTime(duration)}
          </Text>
          <TouchableOpacity
            onPress={() => { onMuteToggle(); onControlTouch(); }}
            hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
          >
            <Ionicons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
    // Base offset — bottomInset is added inline so the play button always sits
    // above the bottom controls regardless of nav bar height.
  },
  centerBtn: {
    padding: 8,
  },
  centerBtnInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  playIconOffset: {
    marginLeft: 4,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    // paddingBottom is set inline (18 + bottomInset) so it clears the device nav bar.
    paddingTop: 50,
  },
  progressArea: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 6,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: '#00C48C',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: THUMB_R * 2,
    height: THUMB_R * 2,
    borderRadius: THUMB_R,
    backgroundColor: '#fff',
    top: '50%',
    marginTop: -THUMB_R,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 0.3,
  },
  timeSep: {
    color: 'rgba(255,255,255,0.5)',
  },
});
