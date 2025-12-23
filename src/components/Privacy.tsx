import React from 'react';
import '../styles/legal.css';

const Privacy: React.FC = () => {
    return (
        <div className="legal-container">
            <div className="legal-content">
                <h1>Privacy Policy</h1>
                <p className="last-updated">Last updated: December 23, 2024</p>

                <section>
                    <h2>What We Collect</h2>
                    <p>
                        Second Chances collects only the information necessary to provide our service:
                    </p>
                    <ul>
                        <li>Your name (from Google account)</li>
                        <li>Your email address (@stanford.edu, @alumni.stanford.edu, or @alumni.gsb.stanford.edu)</li>
                        <li>Names you select as potential matches</li>
                        <li>Match results when mutual interest exists</li>
                    </ul>
                </section>

                <section>
                    <h2>How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul>
                        <li>Authenticate your account</li>
                        <li>Match you with other users who share mutual interest</li>
                        <li>Notify you of matches via email</li>
                        <li>Display basic analytics to administrators (aggregated, not individual data)</li>
                    </ul>
                </section>

                <section>
                    <h2>Who Can See Your Information</h2>
                    <p>
                        Your name selections remain private unless a mutual match occurs. When you and another user both select each other, both parties receive an email notification revealing the match.
                    </p>
                    <p>
                        Administrators can see aggregated usage statistics but cannot view individual user selections unless a match has occurred.
                    </p>
                </section>

                <section>
                    <h2>Data Storage</h2>
                    <p>
                        All data is stored securely in Google Firebase. We use industry-standard security measures to protect your information.
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
                        <li>Opt out of email notifications</li>
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
    );
};

export default Privacy;