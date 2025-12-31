import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './shared/Navbar';
import '../styles/legal.css';

const Privacy: React.FC = () => {
    const { user, userData } = useAuth();

    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                {user && userData && (
                    <Navbar
                        user={user}
                        userData={userData}
                    />
                )}

                <div className="legal-content">
                    <h1>Privacy Policy</h1>
                    <p className="last-updated">Last updated: December 19, 2024</p>

                    <section>
                        <h2>What We Collect</h2>
                        <p>
                            Second Chances collects only the information necessary to provide our service:
                        </p>
                        <ul>
                            <li>Your name (from Google account)</li>
                            <li>Your email address (@stanford.edu, @alumni.stanford.edu, or @alumni.gsb.stanford.edu)</li>
                            <li>Account metadata</li>
                        </ul>
                    </section>

                    <section>
                        <h2>How We Use Your Information</h2>
                        <p>We use your information to:</p>
                        <ul>
                            <li>Authenticate your account</li>
                            <li>Match you with other users who share mutual interest</li>
                            <li>Notify you of matches</li>
                        </ul>
                    </section>

                    <section>
                        <h2>Who Can See Your Information</h2>
                        <p>
                            Your name selections remain private unless a mutual match occurs. When you and another user both select each other, both parties are made known of the match.
                        </p>
                    </section>

                    <section>
                        <h2>Data Retention</h2>
                        <p>
                            Your account and data remain active as long as you use the service. You may request account deletion by contacting us.
                        </p>
                    </section>

                    <section>
                        <h2>Third-Party Services</h2>
                        <p>
                            We use Google OAuth for authentication and Google Firebase for data storage. These services have their own privacy policies.
                        </p>
                    </section>

                    <section>
                        <h2>Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul>
                            <li>Access your data</li>
                            <li>Request data deletion</li>
                            <li>Update your information</li>
                        </ul>
                    </section>

                    <section>
                        <h2>Contact</h2>
                        <p>
                            For questions about this privacy policy or to request data deletion, please contact jamespark@alumni.stanford.edu.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Privacy;