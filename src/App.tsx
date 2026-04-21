import React, { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Home from './components/Home';
import Profile from './components/Profile';
import HowTo from './components/HowTo';
import NameSelection from './components/NameSelection';
import AccountLinking from './components/AccountLinking';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import './App.css';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, userData, loading, nameOptions, needsAccountLinking, completeAccountLinking, startNewAccount, logout } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check account linking first, before checking userData
  if (needsAccountLinking) {
    return (
      <AccountLinking
        user={user}
        userClass="gsb"
        onLinkingComplete={completeAccountLinking}
        onStartNewAccount={startNewAccount}
        logout={logout}
      />
    );
  }

  if (!userData) {
    return <div className="loading">Setting up your account...</div>;
  }

  if (nameOptions && nameOptions.length > 0) {
    return <NameSelection />;
  }

  if (!userData.name) {
    return <div className="loading">Completing setup...</div>;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/howto"
            element={
              <ProtectedRoute>
                <HowTo />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
