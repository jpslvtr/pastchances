import React from 'react';
import '../styles/legal.css';

const Terms: React.FC = () => {
    return (
        <div className="legal-container">
            <div className="legal-content">
                <h1>Terms of Service</h1>
                <p className="last-updated">Last updated: December 23, 2024</p>

                <section>
                    <h2>Acceptance of Terms</h2>
                    <p>
                        By accessing Second Chances, you agree to these terms. If you disagree with any part of these terms, you may not use our service.
                    </p>
                </section>

                <section>
                    <h2>Eligibility</h2>
                    <p>
                        This service is exclusively for Stanford Graduate School of Business alumni and students with valid @stanford.edu, @alumni.stanford.edu, or @alumni.gsb.stanford.edu email addresses.
                    </p>
                </section>

                <section>
                    <h2>User Conduct</h2>
                    <p>You agree to:</p>
                    <ul>
                        <li>Provide accurate information</li>
                        <li>Use the service respectfully and appropriately</li>
                        <li>Not harass, abuse, or harm other users</li>
                        <li>Not attempt to access other users' accounts or data</li>
                        <li>Not use the service for commercial purposes</li>
                    </ul>
                </section>

                <section>
                    <h2>How It Works</h2>
                    <p>
                        Second Chances allows you to select other users you're interested in connecting with. If two users mutually select each other, both receive an email notification revealing the match. Selections remain private unless mutual interest exists.
                    </p>
                </section>

                <section>
                    <h2>Account Security</h2>
                    <p>
                        You are responsible for maintaining the security of your account. Do not share your login credentials with others.
                    </p>
                </section>

                <section>
                    <h2>Service Availability</h2>
                    <p>
                        We provide the service "as is" without warranties. We may modify, suspend, or discontinue the service at any time without notice.
                    </p>
                </section>

                <section>
                    <h2>Limitation of Liability</h2>
                    <p>
                        Second Chances is not responsible for the outcomes of matches or interactions between users. We are not liable for any damages arising from your use of the service.
                    </p>
                </section>

                <section>
                    <h2>Privacy</h2>
                    <p>
                        Your use of the service is also governed by our Privacy Policy, which describes how we collect and use your information.
                    </p>
                </section>

                <section>
                    <h2>Termination</h2>
                    <p>
                        We reserve the right to terminate or suspend your account at any time for violations of these terms or for any other reason.
                    </p>
                </section>

                <section>
                    <h2>Changes to Terms</h2>
                    <p>
                        We may update these terms at any time. Continued use of the service after changes constitutes acceptance of the updated terms.
                    </p>
                </section>

                <section>
                    <h2>Contact</h2>
                    <p>
                        For questions about these terms, please contact jamespark@alumni.stanford.edu.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Terms;