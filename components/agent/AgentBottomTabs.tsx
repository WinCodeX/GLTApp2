// components/agent/AgentBottomTabs.tsx
import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Animated,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 5;
const CIRCLE_SIZE = 56;
const CURVE_HEIGHT = 70;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AgentBottomTabsProps {
  currentTab: 'home' | 'chat' | 'updates' | 'calls' | 'account';
}

export const AgentBottomTabs: React.FC<AgentBottomTabsProps> = ({ currentTab }) => {
  const pathname = usePathname();
  const circlePosition = useRef(new Animated.Value(TAB_WIDTH * 2)).current; // Start at home (middle)
  const indicatorPosition = useRef(new Animated.Value(TAB_WIDTH * 2 + TAB_WIDTH / 2 - 15)).current;

  // Tabs with home in middle
  const tabs = [
    {
      key: 'updates',
      label: 'Updates',
      icon: 'bell',
      route: '/(agent)/updates',
    },
    {
      key: 'chat', 
      label: 'Chat',
      icon: 'heart',
      route: '/(agent)/chat',
    },
    {
      key: 'home',
      label: 'Home',
      icon: 'home',
      route: '/(agent)',
    },
    {
      key: 'calls',
      label: 'Search',
      icon: 'search',
      route: '/(agent)/calls',
    },
    {
      key: 'account',
      label: 'Account',
      icon: 'user',
      route: '/(agent)/account',
    },
  ];

  useEffect(() => {
    const currentIndex = tabs.findIndex(tab => tab.key === currentTab);
    const targetCirclePosition = currentIndex * TAB_WIDTH;
    const targetIndicatorPosition = targetCirclePosition + TAB_WIDTH / 2 - 15;

    Animated.parallel([
      Animated.spring(circlePosition, {
        toValue: targetCirclePosition,
        tension: 50,
        friction: 8,
        useNativeDriver: false, // Can't use native driver with SVG paths
      }),
      Animated.spring(indicatorPosition, {
        toValue: targetIndicatorPosition,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, [currentTab]);

  const handleTabPress = (route: string) => {
    if (pathname !== route) {
      router.push(route);
    }
  };

  // Dynamic path for curved cutout
  const getPath = () => {
    return circlePosition.interpolate({
      inputRange: [0, SCREEN_WIDTH],
      outputRange: [
        `M0,25 Q0,0 25,0 L${0},0 Q${15},0 ${25},8 T${45},25 T${65},8 Q${75},0 ${90},0 L${SCREEN_WIDTH - 25},0 Q${SCREEN_WIDTH},0 ${SCREEN_WIDTH},25 L${SCREEN_WIDTH},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`,
        `M0,25 Q0,0 25,0 L${SCREEN_WIDTH - 90},0 Q${SCREEN_WIDTH - 75},0 ${SCREEN_WIDTH - 65},8 T${SCREEN_WIDTH - 45},25 T${SCREEN_WIDTH - 25},8 Q${SCREEN_WIDTH - 15},0 ${SCREEN_WIDTH},0 L${SCREEN_WIDTH - 25},0 Q${SCREEN_WIDTH},0 ${SCREEN_WIDTH},25 L${SCREEN_WIDTH},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`
      ]
    });
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
        <Feather
          name={tabs.find(t => t.key === currentTab)?.icon as any}
          size={26}
          color="#FFFFFF"
        />
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
                const curveStart = centerX - 35;
                const curveEnd = centerX + 35;
                
                return `M0,20 Q0,0 20,0 L${curveStart - 10},0 Q${curveStart},0 ${curveStart + 8},7 Q${curveStart + 18},20 ${centerX},20 Q${curveEnd - 18},20 ${curveEnd - 8},7 Q${curveEnd},0 ${curveEnd + 10},0 L${SCREEN_WIDTH - 20},0 Q${SCREEN_WIDTH},0 ${SCREEN_WIDTH},20 L${SCREEN_WIDTH},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`;
              })
            })}
            fill="#FFFFFF"
          />
        </AnimatedSvg>

        {/* Tab Icons */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab, index) => {
            const isActive = currentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.route)}
                activeOpacity={0.8}
              >
                {!isActive && (
                  <Feather
                    name={tab.icon as any}
                    size={24}
                    color="#9CA3AF"
                  />
                )}
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
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 15,
    width: SCREEN_WIDTH,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  bottomLine: {
    position: 'absolute',
    bottom: 8,
    width: 30,
    height: 3,
    backgroundColor: '#1F2937',
    borderRadius: 2,
  },
});