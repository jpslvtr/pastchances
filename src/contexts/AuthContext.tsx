import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';

interface MatchInfo {
    name: string;
    email: string;
}

interface UserData {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    verifiedName: string;
    crushes: string[];
    lockedCrushes: string[];
    matches: MatchInfo[];
    crushCount: number;
    createdAt: any;
    updatedAt: any;
    lastLogin: any;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

const DEFAULT_PROFILE_URL = '/files/default-profile.png';

// Helper function to check if user should be allowed to create account
function isUserAllowedToSignUp(displayName: string, email: string): { allowed: boolean; reason?: string } {
    if (!displayName || !email) {
        return { allowed: false, reason: 'Missing display name or email' };
    }

    // Normalize the display name for comparison
    const normalizedDisplayName = displayName.trim().toLowerCase().replace(/\s+/g, ' ');

    // Check if display name matches any name in GSB_CLASS_NAMES (case-insensitive)
    const matchesClassName = GSB_CLASS_NAMES.some(className =>
        className.toLowerCase().replace(/\s+/g, ' ') === normalizedDisplayName
    );

    if (matchesClassName) {
        return { allowed: true };
    }

    // Check partial matches (first + last name)
    const displayParts = normalizedDisplayName.split(' ');
    if (displayParts.length >= 2) {
        const displayFirstLast = `${displayParts[0]} ${displayParts[displayParts.length - 1]}`;

        const matchesPartialName = GSB_CLASS_NAMES.some(className => {
            const nameParts = className.toLowerCase().replace(/\s+/g, ' ').split(' ');
            if (nameParts.length >= 2) {
                const nameFirstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
                return nameFirstLast === displayFirstLast;
            }
            return false;
        });

        if (matchesPartialName) {
            return { allowed: true };
        }
    }

    return {
        allowed: false,
        reason: `Your name "${displayName}" was not found in the GSB Class of 2025 roster. Please contact the administrator if you believe this is an error.`
    };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    const normalizeMatches = (matches: any[]): MatchInfo[] => {
        if (!matches || !Array.isArray(matches)) return [];

        return matches.map(match => {
            if (typeof match === 'string') {
                return {
                    name: match,
                    email: match.toLowerCase().replace(/\s+/g, '.') + '@stanford.edu'
                };
            } else if (match && typeof match === 'object' && match.name && match.email) {
                return {
                    name: match.name,
                    email: match.email
                };
            } else {
                return {
                    name: 'Unknown',
                    email: 'unknown@stanford.edu'
                };
            }
        });
    };

    const refreshUserData = async () => {
        if (!user?.uid) {
            console.warn('refreshUserData called without user');
            return;
        }

        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                const userData: UserData = {
                    uid: data.uid,
                    email: data.email,
                    displayName: data.displayName,
                    photoURL: data.photoURL,
                    verifiedName: data.verifiedName || '',
                    crushes: data.crushes || [],
                    lockedCrushes: data.lockedCrushes || [],
                    matches: normalizeMatches(data.matches),
                    crushCount: data.crushCount || 0,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    lastLogin: data.lastLogin
                };
                setUserData(userData);
            } else {
                console.error('User document does not exist after creation');
                setUserData(null);
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
            setUserData(null);
        }
    };

    const createOrUpdateUserDocument = async (user: User) => {
        if (!user.uid) return null;

        const userRef = doc(db, 'users', user.uid);

        try {
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                // Check if new user should be allowed to sign up
                const allowedCheck = isUserAllowedToSignUp(
                    user.displayName || user.email?.split('@')[0] || '',
                    user.email || ''
                );

                if (!allowedCheck.allowed) {
                    console.log('User not allowed to sign up:', allowedCheck.reason);

                    // Sign them out immediately
                    await signOut(auth);

                    // Show error message
                    alert(allowedCheck.reason || 'You are not authorized to access this application.');

                    return null;
                }

                const newUserData: UserData = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || user.email?.split('@')[0] || '',
                    photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                    verifiedName: '',
                    crushes: [],
                    lockedCrushes: [],
                    matches: [],
                    crushCount: 0,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, newUserData);
                console.log('New user document created:', user.email);
                setUserData(newUserData);
                return newUserData;
            } else {
                const existingData = userDoc.data();
                const updatedData: UserData = {
                    uid: existingData.uid,
                    email: existingData.email,
                    displayName: user.displayName || existingData.displayName,
                    photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                    verifiedName: existingData.verifiedName || '',
                    crushes: existingData.crushes || [],
                    lockedCrushes: existingData.lockedCrushes || [],
                    matches: normalizeMatches(existingData.matches),
                    crushCount: existingData.crushCount || 0,
                    createdAt: existingData.createdAt,
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                };

                await setDoc(userRef, updatedData, { merge: true });
                console.log('User document updated:', user.email);
                setUserData(updatedData);
                return updatedData;
            }
        } catch (error) {
            console.error('Error creating/updating user document:', error);
            return null;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user?.email);

            if (user) {
                if (!user.email?.endsWith('@stanford.edu')) {
                    console.log('Invalid email domain:', user.email);
                    await signOut(auth);
                    setUser(null);
                    setUserData(null);
                    setLoading(false);
                    alert('Only @stanford.edu email addresses are allowed. Please sign in with your Stanford account.');
                } else {
                    setUser(user);
                    // Create/update user document and set loading to false after completion
                    await createOrUpdateUserDocument(user);
                    setLoading(false);
                }
            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            console.log('Attempting Google sign-in...');
            const result = await signInWithPopup(auth, googleProvider);
            console.log('Sign-in successful:', result.user.email);

            if (!result.user.email?.endsWith('@stanford.edu')) {
                await signOut(auth);
                throw new Error('Only @stanford.edu email addresses are allowed');
            }

        } catch (error: any) {
            console.error('Login error:', error);

            if (error.code === 'auth/configuration-not-found') {
                alert('Authentication is not properly configured. Please contact the administrator.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                console.log('Sign-in popup was closed by user');
            } else if (error.code === 'auth/cancelled-popup-request') {
                console.log('Another sign-in popup is already open');
            } else {
                alert('Login failed. Please make sure you\'re using a @stanford.edu email address.');
            }
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUserData(null);
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const value = {
        user,
        userData,
        loading,
        signInWithGoogle,
        logout,
        refreshUserData
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};