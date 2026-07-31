import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Animated,
  Pressable,
  View,
  Text,
  StyleSheet,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// ============================================================
// Types
// ============================================================

interface SOSButtonProps {
  onTrigger: () => void;
  loading: boolean;
}

// ============================================================
// Constants
// ============================================================

const HOLD_DURATION_MS = 3000;
const BUTTON_SIZE = 200;
const RING_WIDTH = 8;
const COOLDOWN_MS = 30_000;

// ============================================================
// Component
// ============================================================

export function SOSButton({ onTrigger, loading }: SOSButtonProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const [holding, setHolding] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [cooldownSecsLeft, setCooldownSecsLeft] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      progressAnimation.current?.stop();
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(true);
    setCooldownSecsLeft(Math.ceil(COOLDOWN_MS / 1000));

    cooldownInterval.current = setInterval(() => {
      setCooldownSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownInterval.current!);
          setCooldown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handlePressIn = useCallback(() => {
    if (loading || cooldown) return;

    setHolding(true);
    progressAnim.setValue(0);

    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    });

    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        // Trigger on completion
        setHolding(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onTrigger();
        progressAnim.setValue(0);
        startCooldown();
      }
    });
  }, [loading, cooldown, progressAnim, onTrigger, startCooldown]);

  const handlePressOut = useCallback(() => {
    if (!holding) return;
    setHolding(false);
    progressAnimation.current?.stop();
    // Animate progress back to 0
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [holding, progressAnim]);

  // Derive the arc stroke-dashoffset from progress
  const circumference = 2 * Math.PI * ((BUTTON_SIZE / 2) - RING_WIDTH / 2);
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const buttonLabel = loading
    ? 'Sending...'
    : cooldown
    ? `Wait ${cooldownSecsLeft}s`
    : holding
    ? 'Keep holding...'
    : 'Hold for 3s';

  const isDisabled = loading || cooldown;

  return (
    <View style={styles.wrapper}>
      {/* Progress ring using Animated border-width trick */}
      <Animated.View
        style={[
          styles.ringOuter,
          {
            borderWidth: strokeDashoffset.interpolate({
              inputRange: [0, circumference],
              outputRange: [RING_WIDTH, 0],
            }),
          },
        ]}
      />

      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityHint="Hold for 3 seconds to trigger emergency SOS alert"
        style={({ pressed }) => [
          styles.button,
          pressed && !isDisabled && styles.buttonPressed,
          isDisabled && styles.buttonDisabled,
        ]}
      >
        <View style={styles.innerCircle}>
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.hintText}>{buttonLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const RING_COLOR = '#EF4444';
const BUTTON_COLOR = '#DC2626';
const BUTTON_COLOR_PRESSED = '#B91C1C';
const BUTTON_COLOR_DISABLED = '#9CA3AF';

const styles = StyleSheet.create({
  wrapper: {
    width: BUTTON_SIZE + RING_WIDTH * 2,
    height: BUTTON_SIZE + RING_WIDTH * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: BUTTON_SIZE + RING_WIDTH * 2,
    height: BUTTON_SIZE + RING_WIDTH * 2,
    borderRadius: (BUTTON_SIZE + RING_WIDTH * 2) / 2,
    borderColor: RING_COLOR,
    borderWidth: 0,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonPressed: {
    backgroundColor: BUTTON_COLOR_PRESSED,
    shadowOpacity: 0.3,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    backgroundColor: BUTTON_COLOR_DISABLED,
    shadowOpacity: 0,
    elevation: 0,
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 4,
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
