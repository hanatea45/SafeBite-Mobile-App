
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const [startupStage, setStartupStage] = useState<
    'loading' | 'splash' | 'done'
  >('loading');

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash screen after the layout mounts.
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync();
    }

    // Stage 1: Loading screen for 1.5 seconds.
    const loadingTimer = setTimeout(() => {
      setStartupStage('splash');
    }, 1500);

    // Stage 2: Show the SafeBite splash for 2 seconds.
    const splashTimer = setTimeout(() => {
      // Stage 3: Fade out the splash screen.
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setStartupStage('done');
        }
      });
    }, 3500);

    return () => {
      clearTimeout(loadingTimer);
      clearTimeout(splashTimer);
      fadeAnim.stopAnimation();
    };
  }, [fadeAnim]);

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <View style={{ flex: 1 }}>
        <AppTabs />

        {startupStage !== 'done' && (
          <Animated.View
            style={[
              styles.overlay,
              { opacity: fadeAnim },
            ]}
          >
            {startupStage === 'loading' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color="#F97316"
                />

                <Text style={styles.loadingTitle}>
                  Loading SafeBite...
                </Text>

                <Text style={styles.loadingSubtitle}>
                  Preparing your food safety experience
                </Text>
              </View>
            ) : (
              <View style={styles.splashContainer}>
                <Image
                  source={require('../../assets/images/safebite-icon.png')}
                  style={styles.splashIcon}
                  resizeMode="contain"
                />

                <Text style={styles.splashTitle}>
                  SafeBite
                </Text>

                <Text style={styles.splashSubtitle}>
                  Eat Safe. Live Better.
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  loadingTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#431407',
    marginTop: 22,
  },

  loadingSubtitle: {
    fontSize: 13,
    color: '#82736A',
    marginTop: 8,
    textAlign: 'center',
  },

  splashContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  splashIcon: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },

  splashTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#431407',
    letterSpacing: 1,
  },

  splashSubtitle: {
    fontSize: 14,
    color: '#82736A',
    marginTop: 8,
  },
});
