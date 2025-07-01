// File: app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { auth } from '../firebase/config';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    if (auth.currentUser) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, []);

  return null;
}
