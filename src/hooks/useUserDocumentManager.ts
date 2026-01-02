import { useCallback } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserClass } from '../types';
import { getClassNames } from '../utils';
import { findUserByEmail, normalizeEmail, isAlumniEmail, getEmailPrefix, generateAlumniEmails } from '../utils/emailUtils';

export const useUserDocumentManager = (
    setNameOptions: (options: string[] | null) => void,
    setPendingUserClass: (userClass: UserClass | null) => void,
    setLastUsedClass: (userClass: UserClass) => void,
    setNeedsAccountLinking: (needs: boolean) => void,
    setLinkedDocId: (id: string | null) => void
) => {
    const createOrUpdateUserDocument = useCallback(async (user: User, userClass: UserClass) => {
        try {
            console.log('=== START createOrUpdateUserDocument ===');
            console.log('createOrUpdateUserDocument called with:', {
                email: user.email,
                uid: user.uid,
                userClass
            });

            if (!user.email) {
                console.log('No email, returning early');
                return;
            }

            const signInEmail = normalizeEmail(user.email);
            console.log('Normalized email:', signInEmail);

            console.log('About to call findUserByEmail...');
            const lookupResult = await findUserByEmail(signInEmail);
            console.log('Lookup result:', lookupResult);

            if (lookupResult.docId && lookupResult.userData) {
                console.log('Found existing user, updating lastLogin');
                const userRef = doc(db, 'users', lookupResult.docId);
                await setDoc(userRef, {
                    lastLogin: serverTimestamp()
                }, { merge: true });
                console.log('Updated lastLogin successfully');

                setLastUsedClass(lookupResult.userData.userClass || userClass);
                setNeedsAccountLinking(false);
                console.log('=== END createOrUpdateUserDocument (existing user) ===');
                return;
            }

            console.log('No existing user found');
            if (isAlumniEmail(signInEmail)) {
                console.log('Is alumni email, setting needsAccountLinking');
                setNeedsAccountLinking(true);
                setPendingUserClass(userClass);
                console.log('=== END createOrUpdateUserDocument (needs linking) ===');
                return;
            }

            console.log('Is Stanford email, checking for existing doc');
            let actualUid: string;
            let userRef;

            if (user.email === 'jpark22@stanford.edu') {
                actualUid = `${user.uid}_${userClass}`;
                userRef = doc(db, 'users', actualUid);
                console.log('Test user, using UID:', actualUid);
            } else {
                actualUid = user.uid;
                userRef = doc(db, 'users', actualUid);
                console.log('Regular user, using UID:', actualUid);
            }

            console.log('Checking if user doc exists...');
            const userDoc = await getDoc(userRef);
            console.log('User doc exists?', userDoc.exists());

            if (userDoc.exists()) {
                console.log('Doc exists, updating lastLogin');
                await setDoc(userRef, {
                    lastLogin: serverTimestamp()
                }, { merge: true });

                setLastUsedClass(userClass);
                console.log('=== END createOrUpdateUserDocument (existing doc) ===');
                return;
            }

            console.log('Doc does not exist, getting class names');
            const allNames = await getClassNames(userClass);
            console.log('Got class names, count:', allNames.length);

            const displayName = user.displayName || '';
            console.log('Display name:', displayName);

            const nameParts = displayName.trim().split(' ');
            console.log('Name parts:', nameParts);

            let matchingNames: string[] = [];

            if (nameParts.length >= 2) {
                const firstName = nameParts[0].toLowerCase();
                const lastName = nameParts[nameParts.length - 1].toLowerCase();
                console.log('Searching for first+last:', firstName, lastName);

                matchingNames = allNames.filter(name => {
                    const lowerName = name.toLowerCase();
                    return lowerName.includes(firstName) && lowerName.includes(lastName);
                });
                console.log('First+last matches:', matchingNames.length);
            }

            if (matchingNames.length === 0) {
                console.log('No first+last matches, trying partial match');
                matchingNames = allNames.filter(name => {
                    const lowerName = name.toLowerCase();
                    return nameParts.some(part =>
                        part.length > 2 && lowerName.includes(part.toLowerCase())
                    );
                });
                console.log('Partial matches:', matchingNames.length);
            }

            if (matchingNames.length === 1) {
                console.log('Exactly one match, creating doc with name:', matchingNames[0]);
                await setDoc(userRef, {
                    uid: user.uid,
                    email: signInEmail,
                    emailAlumni: '',
                    emailAlumniGSB: '',
                    name: matchingNames[0],
                    photoURL: user.photoURL || '',
                    crushes: [],
                    lockedCrushes: [],
                    matches: [],
                    crushCount: 0,
                    userClass: userClass,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });
                console.log('Doc created successfully');

                setLastUsedClass(userClass);
                console.log('=== END createOrUpdateUserDocument (new doc created) ===');
                return;
            }

            if (matchingNames.length > 1) {
                console.log('Multiple matches, setting nameOptions');
                setNameOptions(matchingNames);
                setPendingUserClass(userClass);
                console.log('=== END createOrUpdateUserDocument (multiple matches) ===');
                return;
            }

            console.log('No matches, showing all names');
            setNameOptions(allNames);
            setPendingUserClass(userClass);
            console.log('=== END createOrUpdateUserDocument (no matches, all names) ===');

        } catch (error) {
            console.error('!!! ERROR in createOrUpdateUserDocument !!!', error);
            throw error;
        }
    }, [setNameOptions, setPendingUserClass, setLastUsedClass, setNeedsAccountLinking, setLinkedDocId]);

    const createNewAccountWithAlumniEmail = useCallback(async (
        user: User,
        userClass: UserClass,
        selectedName: string
    ) => {
        if (!user.email) return;

        const signInEmail = normalizeEmail(user.email);
        const prefix = getEmailPrefix(signInEmail);
        const { emailAlumni, emailAlumniGSB } = generateAlumniEmails(prefix);

        const actualUid = user.uid;
        const userRef = doc(db, 'users', actualUid);

        const userData: any = {
            uid: user.uid,
            name: selectedName,
            photoURL: user.photoURL || '',
            crushes: [],
            lockedCrushes: [],
            matches: [],
            crushCount: 0,
            userClass: userClass,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        };

        if (signInEmail.endsWith('@alumni.stanford.edu')) {
            userData.email = '';
            userData.emailAlumni = signInEmail;
            userData.emailAlumniGSB = emailAlumniGSB;
        } else if (signInEmail.endsWith('@alumni.gsb.stanford.edu')) {
            userData.email = '';
            userData.emailAlumni = emailAlumni;
            userData.emailAlumniGSB = signInEmail;
        } else {
            userData.email = signInEmail;
            userData.emailAlumni = '';
            userData.emailAlumniGSB = '';
        }

        await setDoc(userRef, userData);
        setLastUsedClass(userClass);
    }, [setLastUsedClass]);

    return {
        createOrUpdateUserDocument,
        createNewAccountWithAlumniEmail
    };
};