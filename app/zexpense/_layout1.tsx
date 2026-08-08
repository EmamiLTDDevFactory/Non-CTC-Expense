import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { ClaimProvider } from '../../src/context/ClaimContext';
import { ActivityIndicator, Image, LogBox, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Suppress dev-mode error overlay so red X does not appear during demo
LogBox.ignoreAllLogs();

function RootLayoutNav() {
  const { isAuthenticated, isInitializing, currentUser, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === 'zexpense' && segments[1] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/zexpense/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/zexpense/(tabs)');
    }
  }, [isAuthenticated, isInitializing, segments]);

  if (isInitializing) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#005A9E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        {isAuthenticated && currentUser ? (
          <View style={styles.userBar}>
            <View style={styles.userBarLeft}>
              <View style={styles.logoWrap}>
                <Image
                  source={require('../../assets/images/emami-logo.png.png')}
                  style={styles.userLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.userBarLabel}>Logged in as</Text>
                <Text style={styles.userBarName} numberOfLines={1} ellipsizeMode="tail">{currentUser.employeeName || currentUser.name || 'Unknown User'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                logout();
                router.replace('/zexpense/login');
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="claim/[id]" 
            options={{ 
              headerShown: true, 
              headerTitle: "Claim Details & Audit Trail",
              headerStyle: { backgroundColor: '#002E5D' },
              headerTintColor: '#FFFFFF',
            }} 
          />
        </Stack>
      </SafeAreaView>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ClaimProvider>
        <RootLayoutNav />
      </ClaimProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E5D',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  userBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  logoWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  userLogo: {
    width: 94,
    height: 94,
  },
  userBarLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  userBarName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  logoutBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  logoutText: {
    color: '#005A9E',
    fontWeight: '700',
  },
});
