import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  HelpCircle,
  Lock,
  Mail,
  Moon,
  Send,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { AppRoute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LANGUAGE_LABELS, LanguageCode, useTheme } from '../contexts/ThemeContext';
import { appCheckActive, OWNER_EMAIL } from '../firebase/config';
import { sendNotification } from '../services/firestoreService';
import { formatReadableFirebaseError } from '../firebase/errors';
import securityReviewEmblemImg from '../assets/images/security_review_emblem_1795018729714.jpg';

interface InfoPagesProps {
  page: 'settings' | 'privacy' | 'terms' | 'about' | 'help' | 'contact';
  onBack: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function InfoPages({ page, onBack, onNavigate }: InfoPagesProps) {
  const { firebaseUser, isVerified, resendVerificationEmail, sendResetPassword } = useAuth();
  const { theme, setTheme, language, setLanguage } = useTheme();

  const [securityMsg, setSecurityMsg] = useState<string | null>(null);
  const [contactSubject, setContactSubject] = useState('');
  const [contactBody, setContactBody] = useState('');
  const [contactStatus, setContactStatus] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !isVerified) {
      setContactStatus(`Please sign in with a verified email or write directly to ${OWNER_EMAIL}.`);
      return;
    }
    try {
      await sendNotification({
        recipientId: 'OWNER',
        senderId: firebaseUser.uid,
        type: 'ACCOUNT_UPDATE',
        title: `Owner Inquiry: ${contactSubject}`,
        message: `From ${firebaseUser.email}: ${contactBody}`,
      });
      setContactSubject('');
      setContactBody('');
      setContactStatus('Message delivered directly to the Owner notification queue.');
    } catch (err) {
      setContactStatus(formatReadableFirebaseError(err));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {page === 'settings' && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Settings &amp; Account Security
          </h1>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Appearance &amp; Localization
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Theme Mode
                </p>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[40px] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
                      theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[40px] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
                      theme === 'dark' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark Theme
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Interface Language
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" />
              Account Security
            </h2>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p>
                Email Verification Status:{' '}
                <strong className={isVerified ? 'text-emerald-600' : 'text-amber-600'}>
                  {firebaseUser ? (isVerified ? 'Verified' : 'Pending Verification') : 'Not signed in'}
                </strong>
              </p>
              <p>
                Firebase App Check Protection:{' '}
                <strong>{appCheckActive ? 'Active (reCAPTCHA v3)' : 'Optional site key not configured'}</strong>
              </p>
            </div>
            {securityMsg && (
              <p className="text-xs text-blue-600 dark:text-blue-400">{securityMsg}</p>
            )}
            {firebaseUser && (
              <div className="flex flex-wrap gap-3">
                {!isVerified && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await resendVerificationEmail();
                        setSecurityMsg('Verification email sent.');
                      } catch (err) {
                        setSecurityMsg(formatReadableFirebaseError(err));
                      }
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Send Verification Email
                  </button>
                )}
                {firebaseUser.email && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await sendResetPassword(firebaseUser.email!);
                        setSecurityMsg(`Password reset email sent to ${firebaseUser.email}.`);
                      } catch (err) {
                        setSecurityMsg(formatReadableFirebaseError(err));
                      }
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    Send Password Reset Link
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {page === 'about' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <img
              src={securityReviewEmblemImg}
              alt="APPVERSE verification emblem"
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
            />
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                About APPVERSE
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Free application publishing with mandatory Owner security approval.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <p>
              APPVERSE enables independent developers and creators to share Android (<strong>APK</strong>, <strong>AAB</strong>) and iOS (<strong>IPA</strong>) builds without submission fees, subject to platform free-tier quotas and strict file-size caps.
            </p>
            <p>
              <strong>Zero-Trust Moderation:</strong> Every uploaded binary is scanned for valid archive headers, platform manifests, and SHA-256 integrity, and remains strictly private until the APPVERSE Owner inspects and approves the release.
            </p>
            <p>
              <strong>Free Tier Policy:</strong> APPVERSE operates on Firebase free-tier quotas and enforces configurable per-file and per-user limits rather than promising unlimited hosting.
            </p>
          </div>
        </div>
      )}

      {page === 'privacy' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Privacy Policy
          </h1>
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>Data Minimization:</strong> APPVERSE collects only the account details required for developer authentication and abuse prevention: your Firebase UID, email address, display name, username, registration date, and submission timestamps.
            </p>
            <p>
              <strong>PII Isolation:</strong> Private user records (including your email address and account status) are stored in a restricted Firestore collection accessible only to you and the authorized Platform Owner. Public visitors only see non-PII developer display names and approved applications.
            </p>
            <p>
              <strong>Unpublished Binaries:</strong> Pending, rejected, or suspended application files are never exposed through public URLs.
            </p>
          </div>
        </div>
      )}

      {page === 'terms' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Terms and Conditions
          </h1>
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <p>
              1. <strong>Authentic Binaries Only:</strong> You may only upload Android (.apk, .aab) and iOS (.ipa) packages that you have the legal right to distribute. Malware, trojans, spoofed packages, and desktop executables are prohibited.
            </p>
            <p>
              2. <strong>Owner Approval Authority:</strong> All submissions enter PENDING state and require explicit Owner approval before appearing publicly. The Owner may reject or suspend applications or accounts that violate platform safety rules.
            </p>
            <p>
              3. <strong>Platform Installation Limitations:</strong> Android APK files require manual user installation permission; AAB files are distribution bundles; iOS IPA files depend on Apple signing and provisioning requirements.
            </p>
          </div>
        </div>
      )}

      {page === 'help' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-5">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            Help &amp; Support
          </h1>
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Why is my uploaded app not visible in Search?</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Every upload stays private in PENDING or UNDER_REVIEW state until the Owner completes verification and approves it. Check status anytime in My Apps.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Why can I not install an AAB or IPA directly?</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Android App Bundles (.aab) must be converted via bundletool or Play Console into device-specific APKs. iOS .ipa packages require valid Apple Developer signing and provisioning profiles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'contact' })}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-medium inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Contact Owner
            </button>
          </div>
        </div>
      )}

      {page === 'contact' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Contact APPVERSE Owner
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Direct inquiries are routed to the Owner inbox ({OWNER_EMAIL}).
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1">Subject</label>
              <input
                type="text"
                required
                maxLength={100}
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="Appeal review, quota request, or security disclosure"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Message</label>
              <textarea
                required
                rows={4}
                maxLength={500}
                value={contactBody}
                onChange={(e) => setContactBody(e.target.value)}
                placeholder="Include App ID or details..."
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            {contactStatus && (
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {contactStatus}
              </p>
            )}
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send to Owner
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
