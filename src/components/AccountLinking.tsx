import { useState, useEffect } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { normalizeEmail, fuzzyNameMatch, isAlumniEmail } from '../utils/emailUtils';
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
    const [filteredMatches, setFilteredMatches] = useState<PotentialMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<PotentialMatch | null>(null);

    useEffect(() => {
        loadPotentialMatches();
    }, []);

    useEffect(() => {
        // Validate alumni email on component mount
        if (user?.email && !isAlumniEmail(user.email)) {
            setError('Invalid email domain. Please use @alumni.stanford.edu or @alumni.gsb.stanford.edu');
            setLoading(false);
        }
    }, [user?.email]);

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
            
            // Apply fuzzy matching
            const googleName = user.displayName || '';
            if (googleName) {
                const MIN_SCORE = 60;
                const filtered = matches
                    .map(u => ({
                        ...u,
                        score: fuzzyNameMatch(googleName, u.name)
                    }))
                    .filter(u => u.score >= MIN_SCORE)
                    .sort((a, b) => b.score - a.score);

                setFilteredMatches(filtered);
            } else {
                // If no Google name available, show all (fallback)
                setFilteredMatches(matches.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (err) {
            console.error('Error loading potential matches:', err);
            setError('Failed to load account options');
        } finally {
            setLoading(false);
        }
    };

    // Check if we have a high-confidence match (score >= 75)
    const hasHighConfidenceMatch = filteredMatches.length > 0 &&
        filteredMatches.some(m => (m as any).score >= 75);

    const handleSelectMatch = (match: PotentialMatch) => {
        setSelectedMatch(match);
        setError(null);
    };

    const handleConfirmLink = async () => {
        if (!user?.email || !selectedMatch || linking) return;

        // Validate alumni email before linking
        if (!isAlumniEmail(user.email)) {
            setError('Invalid email domain. Please use @alumni.stanford.edu or @alumni.gsb.stanford.edu');
            return;
        }

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
                {user.displayName && (
                    <p className="auth-email" style={{ fontSize: '0.9em', marginTop: '-8px' }}>
                        Google account name: <strong>{user.displayName}</strong>
                    </p>
                )}

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {filteredMatches.length > 0 ? (
                    <>
                        <p className="linking-instructions">
                            Below are Past Chances accounts that match your name and haven't been linked with an alumni email. If you see your name, click it to link your account.
                        </p>

                        <div className="account-matches-grid">
                            {filteredMatches.map((match) => (
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

                        <div className="help-notice">
                            {hasHighConfidenceMatch
                                ? <>Don't see your account but can't create a new one? We found a strong match to your name. If none of these are yours, email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a></>
                                : <>Don't see your account but certain you had one? Email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a></>
                            }
                        </div>

                        {!hasHighConfidenceMatch && (
                            <div className="divider">
                                <span>OR</span>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <p className="linking-instructions">
                            We couldn't find any existing accounts that match your name.
                        </p>
                        <div className="help-notice">
                            If you previously had an account, email <a href="mailto:jamespark@alumni.stanford.edu">jamespark@alumni.stanford.edu</a>
                        </div>
                    </>
                )}

                {!hasHighConfidenceMatch && (
                    <button
                        onClick={onStartNewAccount}
                        className="new-account-btn"
                    >
                        Start New Account
                    </button>
                )}

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