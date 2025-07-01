// File: firebase/config.ts

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// You can either hard-code your values here...
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT.firebaseapp.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };



// …or pull them from environment variables:
const firebaseConfig = {
  apiKey: "AIzaSyAeQ3ipSU5ZJbHAGaJRrE13mdLE1rmkGXw",
  authDomain: "loginsignup2-420f1.firebaseapp.com",
  projectId: "loginsignup2-420f1",
  storageBucket: "loginsignup2-420f1.firebasestorage.app",
  messagingSenderId: "353232666852",
  appId: "1:353232666852:web:13a450b8fbdbd902b66cf1",
  measurementId: "G-TL3K4X374G"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
