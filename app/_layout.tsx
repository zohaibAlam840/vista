// File: app/_layout.tsx
import React, { useState, useEffect } from 'react';
import { Slot } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

export default function RootLayout() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [user, setUser] = useState<import('firebase/auth').User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Show welcome screen for 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Welcome splash
  if (showWelcome) {
    return (
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeText}>Welcome to StockVista</Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Still waiting for auth state
  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Once ready, render the rest of the app (auth or tabs via index.tsx redirect)
  return <Slot />;
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
