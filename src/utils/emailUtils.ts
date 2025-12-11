import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { UserData } from '../types';

export const isStanfordEmail = (email: string): boolean => {
    return email.toLowerCase().endsWith('@stanford.edu');
};

export const isAlumniEmail = (email: string): boolean => {
    const lowerEmail = email.toLowerCase();
    return lowerEmail.endsWith('@alumni.stanford.edu') ||
        lowerEmail.endsWith('@alumni.gsb.stanford.edu');
};

export const isValidStanfordRelatedEmail = (email: string): boolean => {
    return isStanfordEmail(email) || isAlumniEmail(email);
};

export const normalizeEmail = (email: string): string => {
    return email.toLowerCase().trim();
};

export const getEmailPrefix = (email: string): string => {
    return email.split('@')[0].toLowerCase();
};

export const generateAlumniEmails = (prefix: string): { emailAlumni: string; emailAlumniGSB: string } => {
    const normalizedPrefix = prefix.toLowerCase();
    return {
        emailAlumni: `${normalizedPrefix}@alumni.stanford.edu`,
        emailAlumniGSB: `${normalizedPrefix}@alumni.gsb.stanford.edu`
    };
};

interface EmailLookupResult {
    docId: string | null;
    userData: UserData | null;
}

export const findUserByEmail = async (email: string): Promise<EmailLookupResult> => {
    try {
        const normalizedEmail = normalizeEmail(email);
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        for (const doc of snapshot.docs) {
            const data = doc.data() as UserData;

            // Check all three email fields with case-insensitive comparison
            const emailMatch = data.email && normalizeEmail(data.email) === normalizedEmail;
            const alumniMatch = data.emailAlumni && normalizeEmail(data.emailAlumni) === normalizedEmail;
            const alumniGSBMatch = data.emailAlumniGSB && normalizeEmail(data.emailAlumniGSB) === normalizedEmail;

            if (emailMatch || alumniMatch || alumniGSBMatch) {
                return {
                    docId: doc.id,
                    userData: data
                };
            }
        }

        return { docId: null, userData: null };
    } catch (error) {
        console.error('Error in findUserByEmail:', error);
        return { docId: null, userData: null };
    }
};