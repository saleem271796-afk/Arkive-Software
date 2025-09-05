// firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, off } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDIo7q8OuI1P63q9t9E1s-ENQjBdCd37nI",
  authDomain: "arkive-da661.firebaseapp.com",
  databaseURL: "https://arkive-da661-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "arkive-da661",
  storageBucket: "arkive-da661.appspot.com",
  messagingSenderId: "416097604327",
  appId: "1:416097604327:web:198600d582bd82aeee8842"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

// Auto-authenticate for database access
let authInitialized = false;

export async function initializeFirebaseAuth() {
  if (authInitialized) return;
  
  try {
    await signInAnonymously(auth);
    authInitialized = true;
    console.log('✅ Firebase authentication initialized');
  } catch (error) {
    console.error('❌ Firebase authentication failed:', error);
    throw error;
  }
}

// Initialize auth immediately
initializeFirebaseAuth().catch(console.error);

// Setup realtime listeners for all stores
export function setupRealtimeSync() {
  const stores = [
    'users', 'clients', 'receipts', 'expenses', 'employees', 
    'attendance', 'notifications', 'documents', 'tasks', 
    'clientAccessRequests', 'clientTasks', 'employeePermissions'
  ];

  stores.forEach(store => {
    const storeRef = ref(rtdb, store);
    onValue(storeRef, (snapshot) => {
      const data = snapshot.val() || {};
      console.log(`📡 Firebase realtime update for ${store}:`, Object.keys(data).length, 'items');
      
      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent(`firebase-${store}-update`, {
        detail: Object.values(data)
      }));
    }, (error) => {
      console.error(`Firebase listener error for ${store}:`, error);
    });
  });
}

// Remove all listeners
export function removeRealtimeSync() {
  const stores = [
    'users', 'clients', 'receipts', 'expenses', 'employees', 
    'attendance', 'notifications', 'documents', 'tasks', 
    'clientAccessRequests', 'clientTasks', 'employeePermissions'
  ];

  stores.forEach(store => {
    const storeRef = ref(rtdb, store);
    off(storeRef);
  });
}