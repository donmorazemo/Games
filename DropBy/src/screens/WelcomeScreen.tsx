import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useGoogleAuth, signInWithGoogle } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { Colors, Spacing, Radius } from '../utils/theme';

export default function WelcomeScreen() {
  const { request, response, promptAsync } = useGoogleAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken && authentication?.accessToken) {
        handleSignIn(authentication.idToken, authentication.accessToken);
      }
    }
  }, [response]);

  async function handleSignIn(idToken: string, accessToken: string) {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle(idToken, accessToken);
      router.replace('/(tabs)/tonight?magic=true');
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.porchEmoji}>🏡</Text>
        <Text style={styles.title}>Drop By</Text>
        <Text style={styles.subtitle}>
          Leave your porch light on.{'\n'}
          Let friends know when you're home.
        </Text>
      </View>

      <View style={styles.features}>
        <FeatureRow emoji="🕰" text="Set recurring open hours for your circles" />
        <FeatureRow emoji="◉" text="Different circles see different availability" />
        <FeatureRow emoji="🚶" text="Signal you're dropping by — no RSVP needed" />
        <FeatureRow emoji="📅" text="Your Google Calendar handles the conflicts" />
      </View>

      <View style={styles.bottom}>
        {!isSupabaseConfigured ? (
          <View style={styles.setupBanner}>
            <Text style={styles.setupTitle}>⚙️ Setup required</Text>
            <Text style={styles.setupBody}>
              Add your Supabase URL and Google OAuth credentials to{' '}
              <Text style={styles.setupCode}>DropBy/app.json</Text> to enable sign-in.
            </Text>
          </View>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? (
              <ActivityIndicator color={Colors.white} size="large" />
            ) : (
              <Pressable
                style={[styles.googleBtn, !request && { opacity: 0.5 }]}
                onPress={() => promptAsync()}
                disabled={!request}
              >
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </Pressable>
            )}
          </>
        )}
        <Text style={styles.legalText}>
          By signing in you agree that Drop By reads your Google Calendar only to detect
          conflicts with your open hours. No event details are stored or shared.
        </Text>
      </View>
    </View>
  );
}

function FeatureRow({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  porchEmoji: { fontSize: 64 },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.lightBlue,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: Spacing.sm,
  },
  features: {
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontSize: 16, color: Colors.skyBlue, flex: 1, lineHeight: 22 },
  bottom: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
  },
  googleBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  googleBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.navy,
  },
  setupBanner: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  setupTitle: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  setupBody: { color: Colors.lightBlue, fontSize: 14, lineHeight: 20 },
  setupCode: { fontFamily: 'monospace', color: Colors.white },
  legalText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
