import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
    const { signInWithGoogle, user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            console.log('User authenticated, redirecting to app');
            navigate('/');
        }
    }, [user, loading, navigate]);

    const handleSignIn = async () => {
        await signInWithGoogle();
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>Second Chances</h1>
                <p>
                    Share your crushes anonymously and see if there's a mutual connection.
                </p>

                <div className="login-content">
                    <p style={{
                        fontSize: '13px',
                        color: '#666',
                        marginBottom: '16px',
                        lineHeight: '1.4'
                    }}>
                        Feel free to sign in with your @stanford.edu if you still have access,
                        or your @alumni.stanford.edu or @alumni.gsb.stanford.edu
                    </p>

                    <br></br>

                    <button
                        className="google-signin-btn"
                        onClick={handleSignIn}
                    >
                        <svg className="google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        GSB MBA Class of 2025
                    </button>
                </div>

                <div className="login-footer">
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                    <span className="footer-separator">•</span>
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                </div>
            </div>
        </div>
    );
};

export default Login;