import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.resquared.app',
  appName: 'RE²',
  webDir: 'build',

  // Load the live production site inside the native shell.
  // This means every Netlify deploy automatically updates the app —
  // no App Store resubmission needed for content changes.
  server: {
    url: 'https://resquared.io',
    cleartext: false,
    allowNavigation: ['resquared.io', '*.resquared.io', 'clerk.accounts.dev', '*.clerk.accounts.dev']
  },

  ios: {
    // Respect safe area insets (notch, home indicator) natively
    contentInset: 'automatic',
    // Prevent rubber-band over-scroll bounce on the app shell
    scrollEnabled: false,
    // Allow Clerk auth redirects to work inside the webview
    limitsNavigationsToAppBoundDomains: false
  },

  android: {
    // Use HTTPS scheme for deep links (matches modern Android best practices)
    // This ensures OAuth redirects from Clerk work correctly
    allowMixedContent: false,
    // Capture external navigation for allowed domains
    // (Clerk auth flows need to open in the same WebView)
    webContentsDebuggingEnabled: false
  }
};

export default config;
