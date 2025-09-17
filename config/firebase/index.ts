// config/firebase/index.ts - Main Firebase module with platform detection
import Constants from 'expo-constants';

interface FirebaseService {
  messaging: () => any;
  app: any;
  isNative: boolean;
}

const firebase: FirebaseService = (Constants.appOwnership === 'expo') 
  ? require('./firebaseWeb').default 
  : require('./firebaseNative').default;

export default firebase;