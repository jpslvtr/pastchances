import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
    signInWithPopup,
    // signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isValidStanfordRelatedEmail, isAlumniEmail, normalizeEmail } from '../utils/emailUtils';
import type { UserData, UserClass } from '../types';
import { getClassNames, getUserDocumentId } from '../utils';

interface AuthContextType {
    user: FirebaseUser | null;
    userData: UserData | null;
    loading: boolean;
    needsOnboarding: boolean;
    needsAccountLinking: boolean;
    nameOptions: string[] | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    logout: () => Promise<void>;
    refreshUserData: () => Promise<void>;
    selectName: (name: string) => Promise<void>;
    completeAccountLinking: () => void;
    startNewAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [needsAccountLinking, setNeedsAccountLinking] = useState(false);
    const [nameOptions, setNameOptions] = useState<string[] | null>(null);
    const [pendingUserClass, setPendingUserClass] = useState<UserClass | null>(null);

    // Prevent concurrent fetches
    const fetchingUserData = useRef(false);
    const redirectChecked = useRef(false);

    const fetchUserData = async (firebaseUser: FirebaseUser): Promise<UserData | null> => {
        // Prevent race conditions from concurrent calls
        if (fetchingUserData.current) {
            console.log('Already fetching user data, skipping...');
            return null;
        }

        fetchingUserData.current = true;

        try {
            const email = firebaseUser.email;
            if (!email) return null;

            const normalizedEmail = normalizeEmail(email);

            // First check by Firebase UID
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                console.log('Found user by Firebase UID');
                return userDocSnap.data() as UserData;
            }

            // If alumni email, check if it exists in emailAlumni or emailAlumniGSB fields
            if (isAlumniEmail(normalizedEmail)) {
                const existingUserId = await checkExistingUserByAlumniEmail(normalizedEmail);
                if (existingUserId) {
                    const existingUserRef = doc(db, 'users', existingUserId);
                    const existingUserSnap = await getDoc(existingUserRef);
                    if (existingUserSnap.exists()) {
                        console.log('Found user by alumni email lookup');
                        return existingUserSnap.data() as UserData;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
        } finally {
            fetchingUserData.current = false;
        }
    };

    const checkExistingUserByAlumniEmail = async (email: string): Promise<string | null> => {
        try {
            const normalizedEmail = normalizeEmail(email);
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);

            for (const docSnap of usersSnapshot.docs) {
                const data = docSnap.data();

                // Case-insensitive comparison for all email fields
                const alumniMatch = data.emailAlumni && normalizeEmail(data.emailAlumni) === normalizedEmail;
                const alumniGSBMatch = data.emailAlumniGSB && normalizeEmail(data.emailAlumniGSB) === normalizedEmail;

                if (alumniMatch || alumniGSBMatch) {
                    console.log('Found existing user by alumni email:', docSnap.id);
                    return docSnap.id;
                }
            }

            console.log('No existing user found with alumni email');
            return null;
        } catch (error) {
            console.error('Error checking alumni email:', error);
            return null;
        }
    };

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const initAuth = async () => {
            // Check for redirect result first (important for mobile)
            if (!redirectChecked.current) {
                redirectChecked.current = true;
                try {
                    console.log('Checking for redirect result...');
                    const result = await getRedirectResult(auth);
                    if (result) {
                        console.log('Redirect sign-in successful:', result.user.email);
                        // Auth state change will handle the rest
                    }
                } catch (error: any) {
                    console.error('Error handling redirect result:', error);
                    if (error.code !== 'auth/invalid-credential') {
                        // Don't show error for invalid credential - just let them try again
                        alert('Authentication failed. Please try again.');
                    }
                    setLoading(false);
                    return;
                }
            }

            // Set up auth state listener
            unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                console.log('Auth state changed:', firebaseUser?.email);
                setUser(firebaseUser);

                if (firebaseUser) {
                    const data = await fetchUserData(firebaseUser);
                    setUserData(data);

                    // Update lastLogin for existing users
                    if (data) {
                        try {
                            const docId = getUserDocumentId(firebaseUser, data);
                            console.log('Updating lastLogin for document:', docId);
                            const userRef = doc(db, 'users', docId);

                            await runTransaction(db, async (transaction) => {
                                const userDoc = await transaction.get(userRef);
                                if (userDoc.exists()) {
                                    console.log('Document exists, updating lastLogin');
                                    transaction.update(userRef, {
                                        lastLogin: serverTimestamp()
                                    });
                                } else {
                                    console.log('Document does not exist:', docId);
                                }
                            });
                            console.log('lastLogin updated successfully');
                        } catch (error) {
                            console.error('Error updating lastLogin:', error);
                            // Don't block auth flow if lastLogin update fails
                        }
                    }

                    const email = firebaseUser.email;
                    if (!email) {
                        setLoading(false);
                        return;
                    }

                    // Check if email is valid Stanford-related
                    if (!isValidStanfordRelatedEmail(email)) {
                        console.error('Invalid email domain');
                        await firebaseSignOut(auth);
                        setLoading(false);
                        return;
                    }

                    // Handle onboarding and account linking flows
                    if (!data) {
                        if (isAlumniEmail(email)) {
                            // Alumni email not found in database - show account linking
                            setNeedsAccountLinking(true);
                            setNeedsOnboarding(false);
                            setNameOptions(null);
                            setPendingUserClass('gsb');
                        } else {
                            // Stanford email not found - show name selection
                            setNeedsAccountLinking(false);
                            setNeedsOnboarding(true);
                            await handleNewStanfordUser(firebaseUser, 'gsb');
                        }
                    } else {
                        // User found - clear all onboarding states
                        setNeedsAccountLinking(false);
                        setNeedsOnboarding(false);
                        setNameOptions(null);
                    }
                } else {
                    setUserData(null);
                    setNeedsOnboarding(false);
                    setNeedsAccountLinking(false);
                    setNameOptions(null);
                }

                setLoading(false);
            });
        };

        initAuth();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const handleNewStanfordUser = async (firebaseUser: FirebaseUser, userClass: UserClass) => {
        try {
            const allNames = await getClassNames(userClass);
            const displayName = firebaseUser.displayName || '';
            const nameParts = displayName.trim().split(' ');

            let matchingNames: string[] = [];

            if (nameParts.length >= 2) {
                const firstName = nameParts[0].toLowerCase();
                const lastName = nameParts[nameParts.length - 1].toLowerCase();

                matchingNames = allNames.filter(name => {
                    const lowerName = name.toLowerCase();
                    return lowerName.includes(firstName) && lowerName.includes(lastName);
                });
            }

            if (matchingNames.length === 0) {
                matchingNames = allNames.filter(name => {
                    const lowerName = name.toLowerCase();
                    return nameParts.some(part =>
                        part.length > 2 && lowerName.includes(part.toLowerCase())
                    );
                });
            }

            if (matchingNames.length === 1) {
                // Auto-create with single match
                await createUserDocument(firebaseUser, matchingNames[0], userClass);
                const data = await fetchUserData(firebaseUser);
                setUserData(data);
                setNeedsOnboarding(false);
                setNameOptions(null);
            } else {
                // Show name selection
                setNameOptions(matchingNames.length > 0 ? matchingNames : allNames);
                setPendingUserClass(userClass);
            }
        } catch (error) {
            console.error('Error handling new Stanford user:', error);
        }
    };

    const createUserDocument = async (firebaseUser: FirebaseUser, name: string, userClass: UserClass) => {
        const normalizedEmail = normalizeEmail(firebaseUser.email || '');

        // Determine document ID based on user
        let docId = firebaseUser.uid;
        if (firebaseUser.email === 'jpark22@stanford.edu') {
            docId = `${firebaseUser.uid}_${userClass}`;
        }

        const userRef = doc(db, 'users', docId);

        await setDoc(userRef, {
            uid: docId,
            email: normalizedEmail,
            emailAlumni: '',
            emailAlumniGSB: '',
            name: name,
            photoURL: firebaseUser.photoURL || '',
            crushes: [],
            lockedCrushes: [],
            matches: [],
            crushCount: 0,
            userClass: userClass,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });
    };

    const selectName = async (name: string) => {
        if (!user || !pendingUserClass) {
            throw new Error('No user or pending class');
        }

        await createUserDocument(user, name, pendingUserClass);
        const data = await fetchUserData(user);
        setUserData(data);
        setNeedsOnboarding(false);
        setNameOptions(null);
    };

    const completeAccountLinking = () => {
        // Called after successful account linking
        setNeedsAccountLinking(false);
        setNeedsOnboarding(false);
        setNameOptions(null);
        // Force refresh
        if (user) {
            refreshUserData();
        }
    };

    const startNewAccount = () => {
        // Switch from account linking to name selection
        setNeedsAccountLinking(false);
        setNeedsOnboarding(true);
        if (user && pendingUserClass) {
            handleNewStanfordUser(user, pendingUserClass);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            // Force popup mode - it works better cross-platform now
            console.log('Using popup for authentication');
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setUserData(null);
            setNeedsOnboarding(false);
            setNeedsAccountLinking(false);
            setNameOptions(null);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    // Alias for backwards compatibility
    const logout = signOut;

    const refreshUserData = async () => {
        if (user) {
            const data = await fetchUserData(user);
            setUserData(data);

            // Clear all onboarding states if data is now available
            if (data) {
                setNeedsAccountLinking(false);
                setNeedsOnboarding(false);
                setNameOptions(null);
            }
        }
    };

    const value = {
        user,
        userData,
        loading,
        needsOnboarding,
        needsAccountLinking,
        nameOptions,
        signInWithGoogle,
        signOut,
        logout,
        refreshUserData,
        selectName,
        completeAccountLinking,
        startNewAccount
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};