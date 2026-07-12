import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
if (typeof window !== 'undefined' && window.location) {
  const hostname = window.location.hostname;
  if (hostname && (hostname.includes('expo.app') || hostname.includes('expo.dev') || hostname.includes('expo.io'))) {
    window.location.replace('https://uniconnect-platform-gamma.vercel.app' + window.location.search);
  }
}

registerRootComponent(App);
