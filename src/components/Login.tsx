import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const { user, loading, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Don't redirect while loading or checking redirect result
        if (!loading && user) {
            console.log('User authenticated, redirecting to home');
            navigate('/', { replace: true });
        }
    }, [user, loading, navigate]);

    const handleSignIn = async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('Sign in error:', error);
        }
    };

    // Show loading state while checking for redirect result
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-red-600 mb-2">Second Chances</h1>
                    <p className="text-gray-600">
                        GSB MBA Class of 2025 matching platform
                    </p>
                </div>

                <button
                    onClick={handleSignIn}
                    className="w-full bg-white border-2 border-gray-300 rounded-lg px-6 py-3 flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
                >
                    <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="w-5 h-5"
                    />
                    <span className="font-medium text-gray-700">Sign in with Google</span>
                </button>

                <p className="text-sm text-gray-500 mt-6 text-center">
                    Use your @stanford.edu, @alumni.stanford.edu, or @alumni.gsb.stanford.edu email
                </p>
            </div>
        </div>
    );
};

export default Login;