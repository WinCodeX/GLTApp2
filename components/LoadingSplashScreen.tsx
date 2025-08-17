import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LoadingSplashScreenProps {
  backgroundColor?: string;
}

export default function LoadingSplashScreen({ 
  backgroundColor = '#000000' 
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

  // Blinking star dots
  const BlinkingStar = ({ 
    delay = 0, 
    size = 2, 
    top,
    left,
    right,
    bottom 
  }: {
    delay?: number;
    size?: number;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  }) => {
    const blinkAnim = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
      const blink = () => {
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.8,
            duration: 2000 + delay,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0.2,
            duration: 2000 + delay,
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
          styles.star,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
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

  // Glowing movement lines
  const GlowingLines = () => {
    const glow1 = useRef(new Animated.Value(0.3)).current;
    const glow2 = useRef(new Animated.Value(0.3)).current;
    const glow3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
      const animateGlow = (animValue: Animated.Value, delay: number) => {
        const animate = () => {
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0.3,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]).start(() => animate());
        };
        
        setTimeout(animate, delay);
      };

      animateGlow(glow1, 0);
      animateGlow(glow2, 500);
      animateGlow(glow3, 1000);
    }, []);

    return (
      <View style={styles.linesContainer}>
        <Animated.View style={[styles.glowLine, styles.line1, { opacity: glow1 }]} />
        <Animated.View style={[styles.glowLine, styles.line2, { opacity: glow2 }]} />
        <Animated.View style={[styles.glowLine, styles.line3, { opacity: glow3 }]} />
        
        {/* Accent dots */}
        <View style={styles.accentDots}>
          <Animated.View style={[styles.accentDot, styles.dot1, { opacity: glow1 }]} />
          <Animated.View style={[styles.accentDot, styles.dot2, { opacity: glow2 }]} />
          <Animated.View style={[styles.accentDot, styles.dot3, { opacity: glow3 }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Scattered blinking stars */}
      <BlinkingStar top={screenHeight * 0.1} left={screenWidth * 0.1} size={2} delay={0} />
      <BlinkingStar top={screenHeight * 0.15} right={screenWidth * 0.15} size={1.5} delay={800} />
      <BlinkingStar top={screenHeight * 0.25} left={screenWidth * 0.2} size={2.5} delay={1600} />
      <BlinkingStar top={screenHeight * 0.3} right={screenWidth * 0.1} size={2} delay={2400} />
      <BlinkingStar top={screenHeight * 0.45} left={screenWidth * 0.05} size={1.5} delay={3200} />
      <BlinkingStar top={screenHeight * 0.55} right={screenWidth * 0.08} size={2} delay={4000} />
      <BlinkingStar top={screenHeight * 0.65} left={screenWidth * 0.15} size={1.5} delay={800} />
      <BlinkingStar top={screenHeight * 0.75} right={screenWidth * 0.2} size={2.5} delay={1600} />
      <BlinkingStar top={screenHeight * 0.85} left={screenWidth * 0.1} size={2} delay={2400} />
      <BlinkingStar top={screenHeight * 0.9} right={screenWidth * 0.12} size={1.5} delay={3200} />
      
      {/* More scattered stars */}
      <BlinkingStar top={screenHeight * 0.2} left={screenWidth * 0.7} size={2} delay={1200} />
      <BlinkingStar top={screenHeight * 0.35} right={screenWidth * 0.25} size={1.5} delay={2000} />
      <BlinkingStar top={screenHeight * 0.5} left={screenWidth * 0.8} size={2} delay={2800} />
      <BlinkingStar top={screenHeight * 0.7} right={screenWidth * 0.3} size={1.5} delay={3600} />
      <BlinkingStar top={screenHeight * 0.8} left={screenWidth * 0.75} size={2} delay={400} />

      {/* Main GLT Logo */}
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* GLT text */}
        <View style={styles.gltContainer}>
          <Text style={styles.gltText}>GLT</Text>
          
          {/* Crystalline diamond shape */}
          <View style={styles.diamondContainer}>
            <View style={styles.diamond} />
            
            {/* Glowing movement lines */}
            <GlowingLines />
          </View>
        </View>
        
        {/* LOGISTICS text */}
        <Text style={styles.logisticsText}>LOGISTICS</Text>
      </Animated.View>
    </View>
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
  star: {
    position: 'absolute',
    backgroundColor: '#c77dff',
    shadowColor: '#c77dff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gltContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  gltText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#c77dff',
    marginRight: 15,
    textShadowColor: 'rgba(199, 125, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  diamondContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diamond: {
    width: 35,
    height: 45,
    backgroundColor: '#c77dff',
    transform: [{ rotate: '45deg' }],
    borderRadius: 4,
    shadowColor: '#c77dff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  linesContainer: {
    marginLeft: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  glowLine: {
    backgroundColor: '#c77dff',
    borderRadius: 2,
    marginVertical: 3,
    shadowColor: '#c77dff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  line1: {
    width: 25,
    height: 3,
  },
  line2: {
    width: 35,
    height: 3,
  },
  line3: {
    width: 20,
    height: 3,
  },
  accentDots: {
    marginLeft: 15,
    justifyContent: 'space-around',
    height: 35,
    paddingTop: 5,
  },
  accentDot: {
    backgroundColor: '#c77dff',
    borderRadius: 10,
    marginVertical: 2,
    shadowColor: '#c77dff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dot1: {
    width: 4,
    height: 4,
  },
  dot2: {
    width: 3,
    height: 3,
  },
  dot3: {
    width: 4,
    height: 4,
  },
  logisticsText: {
    fontSize: 28,
    fontWeight: '400',
    color: '#c77dff',
    letterSpacing: 8,
    textShadowColor: 'rgba(199, 125, 255, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});