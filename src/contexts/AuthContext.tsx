import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import { GSB_CLASS_NAMES } from '../data/names';
import { UNDERGRAD_CLASS_NAMES } from '../data/names-undergrad';
import type { UserData, UserClass, MatchInfo } from '../types/userTypes';

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    nameOptions: string[] | null;
    signInWithGoogle: (userClass: UserClass) => Promise<void>;
    selectName: (selectedName: string) => Promise<void>;
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

// Helper function to normalize names for comparison
function normalizeName(name: string): string {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper function to find potential name matches
function findNameMatches(displayName: string, availableNames: string[]): { exactMatch?: string; potentialMatches: string[] } {
    const normalizedInput = normalizeName(displayName);

    // Try exact match first
    const exactMatch = availableNames.find(name =>
        normalizeName(name) === normalizedInput
    );

    if (exactMatch) {
        return { exactMatch, potentialMatches: [] };
    }

    // If no exact match, look for potential matches
    const inputParts = normalizedInput.split(' ').filter(Boolean);
    if (inputParts.length < 2) {
        return { potentialMatches: [] };
    }

    const inputFirst = inputParts[0];
    const inputLast = inputParts[inputParts.length - 1];

    const potentialMatches = availableNames.filter(name => {
        const normalizedName = normalizeName(name);
        const nameParts = normalizedName.split(' ').filter(Boolean);

        if (nameParts.length < 2) return false;

        const nameFirst = nameParts[0];
        const nameLast = nameParts[nameParts.length - 1];

        return nameFirst === inputFirst && nameLast === inputLast;
    });

    return { potentialMatches };
}

// Helper function to get the correct document ID for user class
function getUserDocumentId(user: User, userClass: UserClass): string {
    if (user.email === 'jpark22@stanford.edu') {
        // For test user, always use class-specific UIDs to ensure complete separation
        return userClass === 'gsb' ? `${user.uid}_gsb` : `${user.uid}_undergrad`;
    }
    return user.uid;
}

// Helper functions for localStorage to remember last used class
function getLastUsedClass(): UserClass | null {
    try {
        return localStorage.getItem('lastUsedClass') as UserClass | null;
    } catch {
        return null;
    }
}

function setLastUsedClass(userClass: UserClass): void {
    try {
        localStorage.setItem('lastUsedClass', userClass);
    } catch {
        // Ignore localStorage errors
    }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [nameOptions, setNameOptions] = useState<string[] | null>(null);
    const [pendingUserClass, setPendingUserClass] = useState<UserClass | null>(null);

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

    const selectName = async (selectedName: string) => {
        if (!user?.uid || !nameOptions || !pendingUserClass) return;

        try {
            const actualUid = getUserDocumentId(user, pendingUserClass);
            const userRef = doc(db, 'users', actualUid);

            await setDoc(userRef, {
                name: selectedName,
                userClass: pendingUserClass,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Remember which class was selected
            setLastUsedClass(pendingUserClass);

            setNameOptions(null);
            setPendingUserClass(null);
            await loadUserDataFromFirestore(user);
        } catch (error) {
            console.error('Error selecting name:', error);
            throw error;
        }
    };

    // NEW: Standalone function to load user data - doesn't depend on state
    const loadUserDataFromFirestore = async (authUser: User) => {
        if (!authUser?.uid) {
            console.warn('loadUserDataFromFirestore called without user');
            return;
        }

        try {
            // For test user, check both documents and prefer based on last used class
            if (authUser.email === 'jpark22@stanford.edu') {
                const gsbDocId = `${authUser.uid}_gsb`;
                const undergradDocId = `${authUser.uid}_undergrad`;

                const gsbRef = doc(db, 'users', gsbDocId);
                const undergradRef = doc(db, 'users', undergradDocId);

                const [gsbDoc, undergradDoc] = await Promise.all([
                    getDoc(gsbRef),
                    getDoc(undergradRef)
                ]);

                let targetData = null;
                let detectedClass: UserClass = 'gsb';

                // Get the last used class from localStorage
                const lastUsedClass = getLastUsedClass();

                // Prefer the last used class if both documents exist and have names
                if (lastUsedClass === 'undergrad' && undergradDoc.exists() && undergradDoc.data().name) {
                    targetData = undergradDoc.data();
                    detectedClass = 'undergrad';
                } else if (lastUsedClass === 'gsb' && gsbDoc.exists() && gsbDoc.data().name) {
                    targetData = gsbDoc.data();
                    detectedClass = 'gsb';
                } else if (gsbDoc.exists() && gsbDoc.data().name) {
                    // Fallback to GSB if no preference or preference doesn't exist
                    targetData = gsbDoc.data();
                    detectedClass = 'gsb';
                } else if (undergradDoc.exists() && undergradDoc.data().name) {
                    targetData = undergradDoc.data();
                    detectedClass = 'undergrad';
                } else if (gsbDoc.exists()) {
                    // Fall back to GSB if neither has a name
                    targetData = gsbDoc.data();
                    detectedClass = 'gsb';
                } else if (undergradDoc.exists()) {
                    targetData = undergradDoc.data();
                    detectedClass = 'undergrad';
                }

                if (targetData) {
                    const userData: UserData = {
                        uid: targetData.uid,
                        email: targetData.email,
                        name: targetData.name || targetData.verifiedName || targetData.displayName || '',
                        photoURL: targetData.photoURL,
                        crushes: targetData.crushes || [],
                        lockedCrushes: targetData.lockedCrushes || [],
                        matches: normalizeMatches(targetData.matches),
                        crushCount: targetData.crushCount || 0,
                        userClass: targetData.userClass || detectedClass,
                        createdAt: targetData.createdAt,
                        updatedAt: targetData.updatedAt,
                        lastLogin: targetData.lastLogin
                    };
                    setUserData(userData);

                    // Update localStorage with the class we're actually using
                    setLastUsedClass(detectedClass);
                    return;
                }
            } else {
                // Regular user logic
                const userRef = doc(db, 'users', authUser.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const userData: UserData = {
                        uid: data.uid,
                        email: data.email,
                        name: data.name || data.verifiedName || data.displayName || '',
                        photoURL: data.photoURL,
                        crushes: data.crushes || [],
                        lockedCrushes: data.lockedCrushes || [],
                        matches: normalizeMatches(data.matches),
                        crushCount: data.crushCount || 0,
                        userClass: data.userClass || 'gsb',
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                        lastLogin: data.lastLogin
                    };
                    setUserData(userData);
                    return;
                }
            }

            console.error('User document does not exist');
            setUserData(null);
        } catch (error) {
            console.error('Error loading user data from Firestore:', error);
            setUserData(null);
        }
    };

    const refreshUserData = async () => {
        if (!user?.uid) {
            console.warn('refreshUserData called without user');
            return;
        }
        await loadUserDataFromFirestore(user);
    };

    const createOrUpdateUserDocument = async (user: User, userClass: UserClass) => {
        if (!user.uid) return null;

        // Remember which class was selected for login
        setLastUsedClass(userClass);

        try {
            // Special handling for test user (you) - always use class-specific UIDs
            if (user.email === 'jpark22@stanford.edu') {
                const actualUid = getUserDocumentId(user, userClass);
                const userRef = doc(db, 'users', actualUid);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    // Create completely new user document for this class
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
                    const displayName = user.displayName || user.email?.split('@')[0] || '';

                    const { exactMatch, potentialMatches } = findNameMatches(displayName, classNames);

                    if (exactMatch) {
                        console.log(`Creating fresh ${userClass} account with name: ${exactMatch}`);
                        const newUserData: UserData = {
                            uid: actualUid,
                            email: user.email || '',
                            name: exactMatch,
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [], // Start fresh - no crushes
                            lockedCrushes: [], // Start fresh - no locked crushes
                            matches: [], // Start fresh - no matches
                            crushCount: 0, // Start fresh - no crush count
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, newUserData);
                        setUserData(newUserData);
                        console.log(`Successfully created fresh ${userClass} account`);
                        return newUserData;
                    } else if (potentialMatches.length > 0) {
                        console.log(`Multiple matches found for ${userClass}, showing selection`);
                        setNameOptions(potentialMatches);
                        setPendingUserClass(userClass);

                        const incompleteUserData: UserData = {
                            uid: actualUid,
                            email: user.email || '',
                            name: '', // Will be set when user selects
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [], // Start fresh
                            lockedCrushes: [], // Start fresh
                            matches: [], // Start fresh
                            crushCount: 0, // Start fresh
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, incompleteUserData);
                        setUserData(incompleteUserData);
                        return incompleteUserData;
                    } else {
                        await signOut(auth);
                        const className = userClass === 'gsb' ? 'GSB Class of 2025' : 'Undergraduate Class of 2025';
                        alert(`Your name was not found in the ${className} roster. If this is a mistake, please contact jpark22@stanford.edu.`);
                        return null;
                    }
                } else {
                    // Document exists, just update login time (don't modify crushes/matches)
                    const existingData = userDoc.data();
                    console.log(`Using existing ${userClass} account for ${existingData.name}`);

                    const updatedData: UserData = {
                        uid: existingData.uid,
                        email: existingData.email,
                        name: existingData.name || existingData.verifiedName || existingData.displayName || '',
                        photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                        crushes: existingData.crushes || [],
                        lockedCrushes: existingData.lockedCrushes || [],
                        matches: normalizeMatches(existingData.matches || []),
                        crushCount: existingData.crushCount || 0,
                        userClass: existingData.userClass || userClass,
                        createdAt: existingData.createdAt,
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, updatedData, { merge: true });
                    setUserData(updatedData);
                    return updatedData;
                }
            } else {
                // Regular user flow for everyone else
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    // New user
                    const classNames = userClass === 'gsb' ? GSB_CLASS_NAMES : UNDERGRAD_CLASS_NAMES;
                    const displayName = user.displayName || user.email?.split('@')[0] || '';
                    const { exactMatch, potentialMatches } = findNameMatches(displayName, classNames);

                    if (exactMatch) {
                        const newUserData: UserData = {
                            uid: user.uid,
                            email: user.email || '',
                            name: exactMatch,
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [],
                            lockedCrushes: [],
                            matches: [],
                            crushCount: 0,
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, newUserData);
                        setUserData(newUserData);
                        return newUserData;
                    } else if (potentialMatches.length > 0) {
                        setNameOptions(potentialMatches);
                        setPendingUserClass(userClass);

                        const incompleteUserData: UserData = {
                            uid: user.uid,
                            email: user.email || '',
                            name: '',
                            photoURL: user.photoURL || DEFAULT_PROFILE_URL,
                            crushes: [],
                            lockedCrushes: [],
                            matches: [],
                            crushCount: 0,
                            userClass: userClass,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        };

                        await setDoc(userRef, incompleteUserData);
                        setUserData(incompleteUserData);
                        return incompleteUserData;
                    } else {
                        await signOut(auth);
                        const className = userClass === 'gsb' ? 'GSB Class of 2025' : 'Undergraduate Class of 2025';
                        alert(`Your name was not found in the ${className} roster. If this is a mistake, please contact jpark22@stanford.edu.`);
                        return null;
                    }
                } else {
                    // Existing user - check if they're trying wrong class
                    const existingData = userDoc.data();
                    if (existingData.userClass && existingData.userClass !== userClass) {
                        await signOut(auth);
                        const existingClassName = existingData.userClass === 'gsb' ? 'GSB' : 'Undergraduate';
                        alert(`You are already registered as a ${existingClassName} student. Please sign in with the ${existingClassName} option.`);
                        return null;
                    }

                    const updatedData: UserData = {
                        uid: existingData.uid,
                        email: existingData.email,
                        name: existingData.name || existingData.verifiedName || existingData.displayName || '',
                        photoURL: user.photoURL || existingData.photoURL || DEFAULT_PROFILE_URL,
                        crushes: existingData.crushes || [],
                        lockedCrushes: existingData.lockedCrushes || [],
                        matches: normalizeMatches(existingData.matches),
                        crushCount: existingData.crushCount || 0,
                        userClass: existingData.userClass || userClass,
                        createdAt: existingData.createdAt,
                        updatedAt: serverTimestamp(),
                        lastLogin: serverTimestamp()
                    };

                    await setDoc(userRef, updatedData, { merge: true });
                    setUserData(updatedData);
                    return updatedData;
                }
            }
        } catch (error) {
            console.error('Error creating/updating user document:', error);
            return null;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (!user.email?.endsWith('@stanford.edu')) {
                    await signOut(auth);
                    setUser(null);
                    setUserData(null);
                    setLoading(false);
                    alert('Only @stanford.edu email addresses are allowed. Please sign in with your Stanford account.');
                } else {
                    setUser(user);
                    // Load user data immediately when auth state is restored
                    await loadUserDataFromFirestore(user);
                    setLoading(false);
                }
            } else {
                setUser(null);
                setUserData(null);
                setNameOptions(null);
                setPendingUserClass(null);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async (userClass: UserClass) => {
        try {
            const result = await signInWithPopup(auth, googleProvider);

            if (!result.user.email?.endsWith('@stanford.edu')) {
                await signOut(auth);
                throw new Error('Only @stanford.edu email addresses are allowed');
            }

            // Create or update user document with the selected class
            await createOrUpdateUserDocument(result.user, userClass);
        } catch (error: any) {
            console.error('Login error:', error);

            if (error.code === 'auth/popup-closed-by-user') {
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
            setNameOptions(null);
            setPendingUserClass(null);
            // Clear the last used class on logout
            try {
                localStorage.removeItem('lastUsedClass');
            } catch {
                // Ignore localStorage errors
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const value = {
        user,
        userData,
        loading,
        nameOptions,
        signInWithGoogle,
        selectName,
        logout,
        refreshUserData
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};