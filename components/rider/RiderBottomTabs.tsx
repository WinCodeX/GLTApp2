// components/rider/RiderBottomTabs.tsx
import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 4;
const CIRCLE_SIZE = 56;
const CURVE_HEIGHT = 75;
const ANIMATION_DURATION = 300;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface RiderBottomTabsProps {
  currentTab: 'home' | 'scan' | 'wallet' | 'account';
}

export const RiderBottomTabs: React.FC<RiderBottomTabsProps> = ({ currentTab }) => {
  const pathname = usePathname();
  
  // Tabs with home in second position for better balance
  const tabs = [
    {
      key: 'scan',
      label: 'Scan',
      icon: 'camera',
      route: '/(rider)/scan',
    },
    {
      key: 'home',
      label: 'Home',
      icon: 'home',
      route: '/(rider)',
    },
    {
      key: 'wallet',
      label: 'Wallet',
      icon: 'credit-card',
      route: '/(rider)/wallet',
    },
    {
      key: 'account',
      label: 'Account',
      icon: 'user',
      route: '/(rider)/account',
    },
  ];

  // Initialize based on current tab
  const initialIndex = tabs.findIndex(tab => tab.key === currentTab);
  const initialIcon = tabs.find(t => t.key === currentTab)?.icon || 'home';
  
  const circlePosition = useRef(new Animated.Value(initialIndex * TAB_WIDTH)).current;
  const indicatorPosition = useRef(new Animated.Value(initialIndex * TAB_WIDTH + TAB_WIDTH / 2 - 20)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const [displayedIcon, setDisplayedIcon] = useState<string>(initialIcon);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const currentIndex = tabs.findIndex(tab => tab.key === currentTab);
    const targetCirclePosition = currentIndex * TAB_WIDTH;
    const targetIndicatorPosition = targetCirclePosition + TAB_WIDTH / 2 - 20;
    const newIcon = tabs.find(t => t.key === currentTab)?.icon || 'home';

    // Only animate icon if it's actually changing
    if (displayedIcon !== newIcon && !isAnimating) {
      setIsAnimating(true);

      // Fade out current icon
      Animated.timing(iconOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }).start(() => {
        // Change icon at midpoint
        setDisplayedIcon(newIcon);
        // Fade in new icon
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION / 2,
          useNativeDriver: true,
        }).start(() => {
          setIsAnimating(false);
        });
      });

      // Move circle and indicator
      Animated.parallel([
        Animated.timing(circlePosition, {
          toValue: targetCirclePosition,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorPosition, {
          toValue: targetIndicatorPosition,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        })
      ]).start();
    } else if (displayedIcon === newIcon) {
      // Just move the position without icon animation
      Animated.parallel([
        Animated.timing(circlePosition, {
          toValue: targetCirclePosition,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorPosition, {
          toValue: targetIndicatorPosition,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [currentTab, displayedIcon]);

  const handleTabPress = (route: string) => {
    if (pathname !== route) {
      router.push(route);
    }
  };

  return (
    <View style={styles.container}>
      {/* Floating Circle */}
      <Animated.View 
        style={[
          styles.floatingCircle,
          {
            transform: [{ 
              translateX: Animated.add(
                circlePosition, 
                new Animated.Value(TAB_WIDTH / 2 - CIRCLE_SIZE / 2)
              )
            }]
          }
        ]}
      >
        <Animated.View style={{ opacity: iconOpacity }}>
          <Feather
            name={displayedIcon as any}
            size={24}
            color="#FFFFFF"
          />
        </Animated.View>
      </Animated.View>

      {/* Nav Background with Dynamic Cutout */}
      <View style={styles.navContainer}>
        <AnimatedSvg
          width={SCREEN_WIDTH}
          height={CURVE_HEIGHT}
          style={styles.svg}
        >
          <AnimatedPath
            d={circlePosition.interpolate({
              inputRange: tabs.map((_, i) => i * TAB_WIDTH),
              outputRange: tabs.map((_, i) => {
                const centerX = i * TAB_WIDTH + TAB_WIDTH / 2;
                const curveStart = centerX - 38;
                const curveEnd = centerX + 38;
                
                return `M0,25 Q0,0 25,0 L${curveStart - 10},0 Q${curveStart},0 ${curveStart + 10},8 Q${curveStart + 20},25 ${centerX},25 Q${curveEnd - 20},25 ${curveEnd - 10},8 Q${curveEnd},0 ${curveEnd + 10},0 L${SCREEN_WIDTH - 25},0 Q${SCREEN_WIDTH},0 ${SCREEN_WIDTH},25 L${SCREEN_WIDTH},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`;
              })
            })}
            fill="#1F2C34"
          />
        </AnimatedSvg>

        {/* Tab Icons and Labels */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.route)}
                activeOpacity={0.7}
              >
                <View style={styles.tabContent}>
                  {!isActive && (
                    <>
                      <Feather
                        name={tab.icon as any}
                        size={22}
                        color="#8E8E93"
                      />
                      <Text style={styles.tabLabel}>
                        {tab.label}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Line Indicator */}
        <Animated.View 
          style={[
            styles.bottomLine,
            {
              transform: [{ translateX: indicatorPosition }]
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  floatingCircle: {
    position: 'absolute',
    top: 0,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#7B3F98',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#7B3F98',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  navContainer: {
    position: 'absolute',
    bottom: 0,
    width: SCREEN_WIDTH,
    height: CURVE_HEIGHT,
  },
  svg: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 20,
    width: SCREEN_WIDTH,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 45,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  bottomLine: {
    position: 'absolute',
    bottom: 8,
    width: 40,
    height: 3,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
  },
});