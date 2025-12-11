import React from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Home from './components/Home';
import NameSelection from './components/NameSelection';
import AccountLinking from './components/AccountLinking';
import './App.css';

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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;