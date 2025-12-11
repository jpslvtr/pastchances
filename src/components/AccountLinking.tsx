import { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../config/firebase';
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { normalizeEmail } from '../utils/emailUtils';
import type { UserClass } from '../types';

interface AccountLinkingProps {
    user: FirebaseUser;
    userClass: UserClass;
    onLinkingComplete: () => void;
    onStartNewAccount: () => void;
    logout: () => void;
}

interface PotentialMatch {
    id: string;
    name: string;
    email: string;
}

const AccountLinking = ({ user, userClass, onLinkingComplete, onStartNewAccount, logout }: AccountLinkingProps) => {
    const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<PotentialMatch | null>(null);

    useEffect(() => {
        loadPotentialMatches();
    }, []);

    const loadPotentialMatches = async () => {
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            const matches: PotentialMatch[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Only show users with empty alumni email fields and matching userClass
                if (data.userClass === userClass && !data.emailAlumni && !data.emailAlumniGSB) {
                    matches.push({
                        id: doc.id,
                        name: data.name,
                        email: data.email
                    });
                }
            });

            // Sort alphabetically by name
            matches.sort((a, b) => a.name.localeCompare(b.name));
            setPotentialMatches(matches);
        } catch (err) {
            console.error('Error loading potential matches:', err);
            setError('Failed to load account options');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMatch = (match: PotentialMatch) => {
        setSelectedMatch(match);
        setError(null);
    };

    const handleConfirmLink = async () => {
        if (!user?.email || !selectedMatch || linking) return;

        setLinking(true);
        setError(null);

        try {
            const alumniEmail = normalizeEmail(user.email);
            const base = alumniEmail.split('@')[0];
            const alumniStanford = `${base}@alumni.stanford.edu`;
            const alumniGSB = `${base}@alumni.gsb.stanford.edu`;

            // First check outside transaction if these emails are already in use
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);

            for (const doc of usersSnapshot.docs) {
                if (doc.id === selectedMatch.id) continue;

                const data = doc.data();
                const emailMatch = (data.emailAlumni && normalizeEmail(data.emailAlumni) === alumniEmail) ||
                    (data.emailAlumniGSB && normalizeEmail(data.emailAlumniGSB) === alumniEmail);

                if (emailMatch) {
                    throw new Error('This alumni email is already linked to another account');
                }
            }

            const userRef = doc(db, 'users', selectedMatch.id);

            // Use transaction to prevent race conditions
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) {
                    throw new Error('Selected account no longer exists');
                }

                const userData = userDoc.data();

                // Verify the account still has empty alumni emails
                if (userData.emailAlumni || userData.emailAlumniGSB) {
                    throw new Error('This account has already been linked to another alumni email');
                }

                // Verify it's the correct class
                if (userData.userClass !== userClass) {
                    throw new Error(`Can only link to ${userClass} accounts`);
                }

                // Update both alumni email fields atomically
                transaction.update(userRef, {
                    emailAlumni: alumniStanford,
                    emailAlumniGSB: alumniGSB,
                    updatedAt: new Date()
                });
            });

            console.log('Account linked successfully');
            onLinkingComplete();
        } catch (err) {
            console.error('Error linking account:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to link account. Please try again.');
            }
            await loadPotentialMatches();
            setSelectedMatch(null);
        } finally {
            setLinking(false);
        }
    };

    const handleGoBack = () => {
        setSelectedMatch(null);
        setError(null);
    };

    if (loading) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="loading">Loading...</div>
                </div>
            </div>
        );
    }

    // Confirmation screen
    if (selectedMatch) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h1>Confirm Account Link</h1>
                    <p className="auth-email">
                        Signing in as <strong>{user?.email}</strong>
                    </p>

                    {error && (
                        <div className="error-banner">
                            {error}
                        </div>
                    )}

                    {linking && (
                        <div className="linking-banner">
                            Linking account...
                        </div>
                    )}

                    <div className="confirmation-box">
                        <p className="confirmation-question">Are you sure you want to link your alumni email to this account?</p>
                        <div className="selected-account-display">
                            <div className="selected-name">{selectedMatch.name}</div>
                            <div className="selected-email">{selectedMatch.email}</div>
                        </div>
                    </div>

                    <div className="confirmation-buttons">
                        <button
                            onClick={handleConfirmLink}
                            disabled={linking}
                            className="confirm-btn"
                        >
                            Yes, Link Account
                        </button>
                        <button
                            onClick={handleGoBack}
                            disabled={linking}
                            className="cancel-btn"
                        >
                            Go Back
                        </button>
                    </div>

                    <button
                        onClick={logout}
                        disabled={linking}
                        className="signout-link"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // Account selection screen
    return (
        <div className="auth-container">
            <div className="auth-card linking-card">
                <h1>Link Your Alumni Email</h1>
                <p className="auth-email">
                    Signing in as <strong>{user?.email}</strong>
                </p>

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {potentialMatches.length > 0 ? (
                    <>
                        <p className="linking-instructions">
                            Below are Past Chances accounts that haven't been linked with an @alumni.stanford.edu or @alumni.gsb.stanford.edu email. If you see your name, click it to link your account.
                        </p>

                        <div className="account-matches-grid">
                            {potentialMatches.map((match) => (
                                <button
                                    key={match.id}
                                    onClick={() => handleSelectMatch(match)}
                                    className="account-match-card"
                                >
                                    <div className="match-name">{match.name}</div>
                                    <div className="match-email">{match.email}</div>
                                </button>
                            ))}
                        </div>

                        <div className="divider">
                            <span>OR</span>
                        </div>
                    </>
                ) : (
                    <p className="linking-instructions">
                        No existing accounts available to link. Create a new account to continue.
                    </p>
                )}

                <button
                    onClick={onStartNewAccount}
                    className="new-account-btn"
                >
                    Start New Account
                </button>

                <button
                    onClick={logout}
                    className="signout-link"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default AccountLinking;