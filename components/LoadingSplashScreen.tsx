import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LoadingSplashScreenProps {
  backgroundColor?: string;
}

export default function LoadingSplashScreen({ 
  backgroundColor = '#1a1b2e' 
}: LoadingSplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Main logo entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  // Animated blinking dots component
  const BlinkingDot = ({ 
    delay = 0, 
    size = 4, 
    color = '#9d4edd',
    top,
    left,
    right,
    bottom 
  }: {
    delay?: number;
    size?: number;
    color?: string;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  }) => {
    const blinkAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
      const blink = () => {
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.9,
            duration: 1500 + delay,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0.4,
            duration: 1500 + delay,
            useNativeDriver: true,
          }),
        ]).start(() => blink());
      };

      const timeout = setTimeout(blink, delay);
      return () => clearTimeout(timeout);
    }, [blinkAnim, delay]);

    return (
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: blinkAnim,
            top,
            left,
            right,
            bottom,
          },
        ]}
      />
    );
  };

  // Movement lines component
  const MovementLines = () => {
    const line1Anim = useRef(new Animated.Value(0.6)).current;
    const line2Anim = useRef(new Animated.Value(0.4)).current;
    const line3Anim = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
      const animateLine1 = () => {
        Animated.sequence([
          Animated.timing(line1Anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(line1Anim, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        ]).start(() => animateLine1());
      };

      const animateLine2 = () => {
        Animated.sequence([
          Animated.timing(line2Anim, { toValue: 0.8, duration: 2300, useNativeDriver: true }),
          Animated.timing(line2Anim, { toValue: 0.4, duration: 2300, useNativeDriver: true }),
        ]).start(() => animateLine2());
      };

      const animateLine3 = () => {
        Animated.sequence([
          Animated.timing(line3Anim, { toValue: 0.6, duration: 2700, useNativeDriver: true }),
          Animated.timing(line3Anim, { toValue: 0.2, duration: 2700, useNativeDriver: true }),
        ]).start(() => animateLine3());
      };

      animateLine1();
      setTimeout(animateLine2, 300);
      setTimeout(animateLine3, 700);
    }, []);

    return (
      <View style={styles.movementLinesContainer}>
        <Animated.View style={[styles.movementLine, styles.line1, { opacity: line1Anim }]} />
        <Animated.View style={[styles.movementLine, styles.line2, { opacity: line2Anim }]} />
        <Animated.View style={[styles.movementLine, styles.line3, { opacity: line3Anim }]} />
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#1e2749', '#151826', '#0f1015']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Scattered blinking dots - matching SVG positions */}
      <BlinkingDot top={screenHeight * 0.2} left={screenWidth * 0.15} size={6} color="#7b2cbf" delay={0} />
      <BlinkingDot top={screenHeight * 0.15} right={screenWidth * 0.15} size={4} color="#9d4edd" delay={500} />
      <BlinkingDot bottom={screenHeight * 0.2} left={screenWidth * 0.2} size={5} color="#c77dff" delay={1000} />
      <BlinkingDot bottom={screenHeight * 0.25} right={screenWidth * 0.1} size={7} color="#7b2cbf" delay={1500} />
      <BlinkingDot top={screenHeight * 0.5} left={screenWidth * 0.1} size={3} color="#9d4edd" delay={2000} />
      <BlinkingDot top={screenHeight * 0.4} right={screenWidth * 0.05} size={5} color="#c77dff" delay={2500} />
      <BlinkingDot bottom={screenHeight * 0.3} left={screenWidth * 0.08} size={4} color="#7b2cbf" delay={3000} />
      <BlinkingDot top={screenHeight * 0.15} right={screenWidth * 0.2} size={6} color="#9d4edd" delay={800} />
      <BlinkingDot top={screenHeight * 0.1} left={screenWidth * 0.3} size={3} color="#c77dff" delay={1200} />
      <BlinkingDot bottom={screenHeight * 0.05} right={screenWidth * 0.25} size={4} color="#7b2cbf" delay={1800} />

      {/* Main GLT Logo - centered and animated */}
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* GLT text with gradient background */}
        <LinearGradient
          colors={['#c77dff', '#9d4edd', '#7b2cbf']}
          style={styles.gltGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.gltText}>GLT</Text>
        </LinearGradient>
        
        {/* Crystalline box container */}
        <View style={styles.crystallineContainer}>
          {/* Main crystal structure */}
          <View style={styles.crystalBox}>
            <LinearGradient
              colors={['#9d4edd', '#c77dff', '#7b2cbf']}
              style={styles.crystalMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.crystalTop} />
            <View style={styles.crystalSide} />
          </View>
          
          {/* Movement lines */}
          <MovementLines />
          
          {/* Accent dots with blinking */}
          <View style={styles.accentDotsContainer}>
            <BlinkingDot size={3} color="#c77dff" delay={100} />
            <BlinkingDot size={2} color="#9d4edd" delay={600} />
            <BlinkingDot size={2.5} color="#7b2cbf" delay={1100} />
          </View>
        </View>
        
        {/* LOGISTICS text */}
        <Text style={styles.logisticsText}>LOGISTICS</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  dot: {
    position: 'absolute',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gltGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  gltText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  crystallineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    transform: [{ translateX: 50 }, { translateY: -60 }, { scale: 2.2 }],
  },
  crystalBox: {
    width: 20,
    height: 30,
    position: 'relative',
  },
  crystalMain: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 20,
    height: 30,
    borderRadius: 4,
    opacity: 0.9,
  },
  crystalTop: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 10,
    height: 10,
    backgroundColor: '#c77dff',
    opacity: 0.7,
    transform: [{ rotate: '45deg' }],
  },
  crystalSide: {
    position: 'absolute',
    top: 10,
    right: 0,
    width: 10,
    height: 20,
    backgroundColor: '#7b2cbf',
    opacity: 0.8,
    borderRadius: 2,
  },
  movementLinesContainer: {
    marginLeft: 25,
    justifyContent: 'space-around',
    height: 30,
  },
  movementLine: {
    backgroundColor: '#9d4edd',
    borderRadius: 1,
    marginVertical: 2,
  },
  line1: {
    width: 15,
    height: 3,
  },
  line2: {
    width: 20,
    height: 3,
    backgroundColor: '#c77dff',
  },
  line3: {
    width: 10,
    height: 3,
  },
  accentDotsContainer: {
    marginLeft: 15,
    justifyContent: 'space-around',
    height: 30,
    alignItems: 'center',
  },
  logisticsText: {
    fontSize: 36,
    fontWeight: 'normal',
    color: '#9d4edd',
    letterSpacing: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});