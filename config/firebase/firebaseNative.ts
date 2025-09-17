// config/firebase/firebaseNative.ts - React Native Firebase for native builds
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';

interface NativeFirebaseService {
  messaging: () => FirebaseMessagingTypes.Module;
  app: any;
  isNative: boolean;
}

// Check if Firebase is already initialized
if (!firebase.apps.length) {
  // Firebase will be initialized automatically via google-services.json and GoogleService-Info.plist
  console.log('🔥 React Native Firebase initialized for native');
}

const nativeFirebase: NativeFirebaseService = {
  messaging: () => messaging(),
  app: firebase.app(),
  isNative: true,
};

export default nativeFirebase;