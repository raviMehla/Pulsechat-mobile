import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(20)).current;
  const bgPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Background pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgPulse, {
          toValue: 1.15,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(bgPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Logo entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          damping: 12,
          stiffness: 100,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Navigate after 2.5s
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      {/* Animated background glow */}
      <Animated.View
        style={[
          styles.glowCircle,
          styles.glowTop,
          { transform: [{ scale: bgPulse }] },
        ]}
      />
      <Animated.View
        style={[
          styles.glowCircle,
          styles.glowBottom,
          { transform: [{ scale: bgPulse }] },
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* Logo icon */}
        <View style={styles.logoIcon}>
          <View style={styles.logoBubble1} />
          <View style={styles.logoBubble2} />
          <View style={styles.logoDot} />
        </View>
      </Animated.View>

      {/* Brand name */}
      <Animated.View style={{ opacity: logoOpacity }}>
        <Text style={styles.brandName}>PulseChat</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View
        style={{
          opacity: taglineOpacity,
          transform: [{ translateY: taglineY }],
        }}
      >
        <Text style={styles.tagline}>Private. Real-time. Encrypted.</Text>
      </Animated.View>

      {/* Bottom indicator */}
      <View style={styles.loadingRow}>
        {[0, 1, 2].map((i) => (
          <LoadingDot key={i} delay={i * 200} />
        ))}
      </View>
    </View>
  );
}

function LoadingDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[styles.dot, { opacity }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowTop: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(124, 110, 247, 0.08)',
    top: height * 0.1,
    left: -50,
  },
  glowBottom: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(0, 210, 180, 0.06)',
    bottom: height * 0.1,
    right: -30,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoIcon: {
    width: 80,
    height: 80,
    backgroundColor: Colors.brand.indigo,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
  },
  logoBubble1: {
    width: 36,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    position: 'absolute',
    top: 16,
    left: 12,
  },
  logoBubble2: {
    width: 24,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    position: 'absolute',
    bottom: 14,
    right: 10,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.teal,
    position: 'absolute',
    bottom: 10,
    left: 12,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 60,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand.indigo,
  },
});
