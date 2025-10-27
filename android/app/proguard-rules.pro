# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Fresco - Keep animated image cache classes
-keep class com.facebook.imagepipeline.cache.AnimatedCache { *; }
-keep class com.facebook.imagepipeline.cache.AnimationFrames { *; }
-keep class com.facebook.imagepipeline.nativecode.WebpTranscoder { *; }
-keep class com.facebook.imagepipeline.nativecode.WebpTranscoderImpl { *; }

# Fresco - Keep all classes in animated packages
-keep class com.facebook.fresco.animation.** { *; }
-keep class com.facebook.imagepipeline.animated.** { *; }