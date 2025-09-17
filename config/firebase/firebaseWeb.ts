// config/firebase/firebaseWeb.ts - Firebase JS SDK for web and Expo Go
import { getApps, initializeApp, FirebaseApp } from '@firebase/app';
import { getMessaging, isSupported, Messaging } from '@firebase/messaging';

interface WebFirebaseService {
  messaging: () => Messaging | null;
  app: FirebaseApp;
  isNative: boolean;
}

// Firebase web configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Web messaging (only if supported)
let webMessaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported: boolean) => {
    if (supported) {
      webMessaging = getMessaging(app);
      console.log('🔥 Firebase Web messaging initialized');
    }
  }).catch((error) => {
    console.error('🔥 Firebase Web messaging not supported:', error);
  });
}

const webFirebase: WebFirebaseService = {
  messaging: () => webMessaging,
  app,
  isNative: false,
};

export default webFirebase;