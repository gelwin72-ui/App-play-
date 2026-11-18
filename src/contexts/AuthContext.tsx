import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, OWNER_EMAIL } from '../firebase/config';
import { OperationType, handleFirestoreError } from '../firebase/errors';
import { UserAccount } from '../types';
import { clampString } from '../utils/validation';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserAccount | null;
  isAuthReady: boolean;
  isOwner: boolean;
  isVerified: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildDefaultUsername(email: string | null, displayName: string | null, uid: string): string {
  const base = (displayName || email?.split('@')[0] || `dev_${uid.slice(0, 6)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 28);
  return base.length >= 2 ? base : `dev_${uid.slice(0, 6)}`;
}

const pendingUserSync = new Map<string, Promise<void>>();

async function ensureUserDocuments(user: User): Promise<void> {
  const existingPromise = pendingUserSync.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = (async () => {
    const userRef = doc(db, 'users', user.uid);
    const devRef = doc(db, 'developers', user.uid);
    const userSnap = await getDoc(userRef);

    const displayName = clampString(user.displayName || user.email?.split('@')[0] || 'Developer', 80);
    const username = buildDefaultUsername(user.email, user.displayName, user.uid);

    if (!userSnap.exists()) {
      try {
        await setDoc(userRef, {
          uid: user.uid,
          username,
          displayName,
          email: clampString(user.email || `${user.uid}@appverse.local`, 160),
          role: 'USER',
          accountStatus: 'ACTIVE',
          avatarUrl: clampString(user.photoURL || '', 1000),
          developerBio: '',
          supportEmail: clampString(user.email || '', 160),
          website: '',
          uploadedCount: 0,
          registrationDate: serverTimestamp(),
          lastActivity: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
      }
    } else {
      try {
        await updateDoc(userRef, {
          lastActivity: serverTimestamp(),
        });
      } catch {
        // Non-critical activity timestamp update
      }
    }

    const devSnap = await getDoc(devRef);
    if (!devSnap.exists()) {
      try {
        await setDoc(devRef, {
          uid: user.uid,
          username,
          displayName,
          bio: '',
          avatarUrl: clampString(user.photoURL || '', 1000),
          website: '',
          approvedAppCount: 0,
          accountStatus: 'ACTIVE',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `developers/${user.uid}`);
      }
    }
  })().finally(() => {
    pendingUserSync.delete(user.uid);
  });

  pendingUserSync.set(user.uid, syncPromise);
  return syncPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasAdminDoc, setHasAdminDoc] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubAdmin: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubAdmin) {
        unsubAdmin();
        unsubAdmin = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserProfile(null);
        setHasAdminDoc(false);
        setIsAuthReady(true);
        return;
      }

      try {
        await ensureUserDocuments(user);
      } catch (err) {
        console.error('Error syncing user profile:', err);
      }

      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          setUserProfile(snap.exists() ? (snap.data() as UserAccount) : null);
          setIsAuthReady(true);
        },
        (err) => {
          console.warn('User profile listener error:', err);
          setIsAuthReady(true);
        }
      );

      unsubAdmin = onSnapshot(
        doc(db, 'admins', user.uid),
        (snap) => {
          setHasAdminDoc(snap.exists());
        },
        () => {
          setHasAdminDoc(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubAdmin) unsubAdmin();
    };
  }, []);

  const [, setAuthTick] = useState(0);

  const isVerified = Boolean(firebaseUser?.emailVerified);
  const isOwner = Boolean(
    firebaseUser &&
      ((firebaseUser.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() && firebaseUser.emailVerified) ||
        hasAdminDoc)
  );

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) });
    }
    await sendEmailVerification(cred.user);
    await ensureUserDocuments(cred.user);
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setFirebaseUser(auth.currentUser);
    setAuthTick((n) => n + 1);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isAuthReady,
        isOwner,
        isVerified,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendResetPassword,
        resendVerificationEmail,
        refreshAuthUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
