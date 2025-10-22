import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Animated,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { AgentFloatingActionButton } from './AgentFloatingActionButton';
// --- FIX ---
// Changed from default import 'AgentQRScanner' to named import '{ AgentQRScanner }'
import { AgentQRScanner } from './AgentQRScanner';
// --- END FIX ---
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 5;
const CIRCLE_SIZE = 56;
const CURVE_HEIGHT = 75;
const ANIMATION_DURATION = 300;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AgentBottomTabsProps {
  currentTab: 'home' | 'chat' | 'updates' | 'calls' | 'account';
}

export const AgentBottomTabs: React.FC<AgentBottomTabsProps> = ({ currentTab }) => {
  const pathname = usePathname();
  const circlePosition = useRef(new Animated.Value(TAB_WIDTH * 2)).current;
  const indicatorPosition = useRef(new Animated.Value(TAB_WIDTH * 2 + TAB_WIDTH / 2 - 20)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;
  const [displayedIcon, setDisplayedIcon] = useState<string>('home');
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannerAction, setScannerAction] = useState<'collect' | 'print'>('collect');

  const tabs = [
    {
      key: 'chat', 
      label: 'Chat',
      icon: 'message-square',
      route: '/(agent)/chat',
    },
    {
      key: 'updates',
      label: 'Updates',
      icon: 'layers',
      route: '/(agent)/updates',
    },
    {
      key: 'home',
      label: 'Home',
      icon: 'home',
      route: '/(agent)',
    },
    {
      key: 'calls',
      label: 'Calls',
      icon: 'phone',
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
    const targetIndicatorPosition = targetCirclePosition + TAB_WIDTH / 2 - 20;
    const newIcon = tabs.find(t => t.key === currentTab)?.icon || 'home';

    if (!isAnimating) {
      setIsAnimating(true);

      Animated.timing(iconOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }).start(() => {
        setDisplayedIcon(newIcon);
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION / 2,
          useNativeDriver: true,
        }).start(() => {
          setIsAnimating(false);
        });
      });

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
  }, [currentTab]);

  const handleTabPress = (route: string) => {
    if (pathname !== route) {
      router.push(route);
    }
  };

  const handleNewPress = () => {
    Toast.show({
      type: 'info',
      text1: 'New Package',
      text2: 'Navigate to create new package screen',
      position: 'top',
      visibilityTime: 2000,
    });
  };

  const handleScanPress = () => {
    setScannerAction('collect');
    setShowScanner(true);
  };

  const handleQuickCallPress = async () => {
    const phoneNumber = 'tel:+1234567890';
    try {
      const supported = await Linking.canOpenURL(phoneNumber);
      if (supported) {
        await Linking.openURL(phoneNumber);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Cannot Make Call',
          text2: 'Phone dialer not available',
          position: 'top',
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Call Failed',
        text2: 'Unable to initiate call',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const handleScanSuccess = (result: any) => {
    setShowScanner(false);
    Toast.show({
      type: 'success',
      text1: 'Package Processed',
      text2: `${result.code} processed successfully`,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  return (
    <>
      <View style={styles.container}>
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

      <AgentFloatingActionButton
        onNewPress={handleNewPress}
        onScanPress={handleScanPress}
        onQuickCallPress={handleQuickCallPress}
      />

      <AgentQRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        actionType={scannerAction}
        onScanSuccess={handleScanSuccess}
        autoPrint={true}
      />
    </>
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

