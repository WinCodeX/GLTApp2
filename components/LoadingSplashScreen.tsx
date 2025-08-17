import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  FeDropShadow,
  Rect,
  Circle,
  G,
  Text,
  Polygon,
  Line,
  Animate
} from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LoadingSplashScreenProps {
  backgroundColor?: string;
}

export default function LoadingSplashScreen({ 
  backgroundColor = '#1a1b2e' 
}: LoadingSplashScreenProps) {
  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }}>
      <Svg
        width={screenWidth}
        height={screenHeight}
        viewBox={`0 0 ${screenWidth} ${screenHeight}`}
      >
        <Defs>
          {/* Gradient for the crystalline logo mark */}
          <LinearGradient id="crystalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#9d4edd" stopOpacity="1" />
            <Stop offset="50%" stopColor="#c77dff" stopOpacity="1" />
            <Stop offset="100%" stopColor="#7b2cbf" stopOpacity="1" />
          </LinearGradient>
          
          {/* Enhanced glow effect */}
          <Filter id="glow">
            <FeGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <FeMerge> 
              <FeMergeNode in="coloredBlur"/>
              <FeMergeNode in="SourceGraphic"/>
            </FeMerge>
          </Filter>
          
          {/* Shadow filter */}
          <Filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <FeDropShadow dx="4" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.5"/>
          </Filter>
        </Defs>
        
        {/* Background */}
        <Rect width={screenWidth} height={screenHeight} fill={backgroundColor} />
        
        {/* Blinking star-like dots scattered across screen */}
        <Circle cx={screenWidth * 0.15} cy={screenHeight * 0.2} r="3" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.3;0.9;0.3" dur="3s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.85} cy={screenHeight * 0.15} r="2" fill="#9d4edd">
          <Animate attributeName="opacity" values="0.2;0.8;0.2" dur="2.5s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.2} cy={screenHeight * 0.8} r="2.5" fill="#c77dff">
          <Animate attributeName="opacity" values="0.1;0.7;0.1" dur="2.8s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.9} cy={screenHeight * 0.75} r="3.5" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.4;1;0.4" dur="3.2s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.1} cy={screenHeight * 0.5} r="1.5" fill="#9d4edd">
          <Animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.2s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.95} cy={screenHeight * 0.4} r="2.5" fill="#c77dff">
          <Animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.7s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.08} cy={screenHeight * 0.7} r="2" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.9s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.82} cy={screenHeight * 0.85} r="3" fill="#9d4edd">
          <Animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.1s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.3} cy={screenHeight * 0.1} r="1.5" fill="#c77dff">
          <Animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.4s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.75} cy={screenHeight * 0.95} r="2" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.6s" repeatCount="indefinite"/>
        </Circle>
        
        {/* Additional scattered stars */}
        <Circle cx={screenWidth * 0.4} cy={screenHeight * 0.25} r="1" fill="#c77dff">
          <Animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.1s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.6} cy={screenHeight * 0.35} r="1.5" fill="#9d4edd">
          <Animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.3s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.25} cy={screenHeight * 0.6} r="1" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.8s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.7} cy={screenHeight * 0.2} r="1.5" fill="#c77dff">
          <Animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.45} cy={screenHeight * 0.9} r="1" fill="#9d4edd">
          <Animate attributeName="opacity" values="0.2;0.6;0.2" dur="3.3s" repeatCount="indefinite"/>
        </Circle>
        <Circle cx={screenWidth * 0.55} cy={screenHeight * 0.75} r="1.5" fill="#7b2cbf">
          <Animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.7s" repeatCount="indefinite"/>
        </Circle>
        
        {/* Main GLT Logo centered */}
        <G transform={`translate(${screenWidth / 2}, ${screenHeight / 2})`}>
          {/* GLT text */}
          <Text
            x="-60"
            y="30"
            fontFamily="Arial, sans-serif"
            fontSize="80"
            fontWeight="bold"
            fill="#c77dff"
            filter="url(#shadow)"
            textAnchor="middle"
          >
            GLT
          </Text>
          
          {/* Crystalline logo mark */}
          <G transform="translate(50, -60) scale(1.8)">
            {/* Main crystal structure */}
            <Polygon
              points="0,20 10,10 20,20 20,40 10,50 0,40"
              fill="url(#crystalGrad)"
              filter="url(#glow)"
              opacity="0.9"
            />
            
            {/* Top facet */}
            <Polygon
              points="0,20 10,10 20,20 10,30"
              fill="#c77dff"
              opacity="0.7"
            />
            
            {/* Side facet */}
            <Polygon
              points="20,20 20,40 10,50 10,30"
              fill="#7b2cbf"
              opacity="0.8"
            />
            
            {/* Movement lines with animation */}
            <G opacity="0.6">
              <Line x1="25" y1="25" x2="40" y2="25" stroke="#9d4edd" strokeWidth="2">
                <Animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite"/>
              </Line>
              <Line x1="25" y1="30" x2="45" y2="30" stroke="#c77dff" strokeWidth="2">
                <Animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.3s" repeatCount="indefinite"/>
              </Line>
              <Line x1="25" y1="35" x2="35" y2="35" stroke="#9d4edd" strokeWidth="2">
                <Animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.7s" repeatCount="indefinite"/>
              </Line>
            </G>
            
            {/* Accent dots with animation */}
            <Circle cx="50" cy="27" r="2.5" fill="#c77dff">
              <Animate attributeName="opacity" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite"/>
            </Circle>
            <Circle cx="55" cy="22" r="2" fill="#9d4edd">
              <Animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.2s" repeatCount="indefinite"/>
            </Circle>
            <Circle cx="52" cy="37" r="2" fill="#7b2cbf">
              <Animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.5s" repeatCount="indefinite"/>
            </Circle>
          </G>
          
          {/* LOGISTICS text */}
          <Text
            x="0"
            y="90"
            fontFamily="Arial, sans-serif"
            fontSize="24"
            fontWeight="normal"
            fill="#9d4edd"
            letterSpacing="4"
            textAnchor="middle"
          >
            LOGISTICS
          </Text>
        </G>
      </Svg>
    </View>
  );
}