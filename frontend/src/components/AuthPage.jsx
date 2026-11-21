import React, { useState } from 'react';
import { UtensilsCrossed, Eye, EyeOff, AlertCircle, ArrowRight, Clock3, WalletCards } from 'lucide-react';
import { login, signup, staffLogin, setToken, setUser } from '../services/api';

export default function AuthPage({ onAuthSuccess, expiredMessage }) {
  const [mode, setMode] = useState('student-login'); // 'student-login' | 'student-signup' | 'staff-login'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Student login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Student signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Staff login fields
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const clearError = () => setError('');

  // ── Student Login ──────────────────────────────────────────────────────────
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(loginEmail.trim(), loginPassword);
      if (res.status === 'ok') {
        setToken(res.token);
        setUser(res.user);
        onAuthSuccess(res.user, res.token);
      } else {
        setError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Student Signup ─────────────────────────────────────────────────────────
  const validateSignup = () => {
    const errs = {};
    if (!signupName.trim()) errs.name = 'Name is required.';
    if (!signupEmail.trim() || !signupEmail.includes('@')) errs.email = 'Valid email is required.';
    if (!/^\d{10}$/.test(signupPhone.trim())) errs.phone = 'Phone must be exactly 10 digits.';
    if (signupPassword.length < 8) errs.password = 'Password must be at least 8 characters.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStudentSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateSignup()) return;
    setLoading(true);
    try {
      const res = await signup(signupName.trim(), signupEmail.trim().toLowerCase(), signupPhone.trim(), signupPassword);
      if (res.status === 'ok') {
        setToken(res.token);
        setUser(res.user);
        onAuthSuccess(res.user, res.token);
      } else {
        setError(res.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Staff Login ────────────────────────────────────────────────────────────
  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await staffLogin(staffUsername.trim(), staffPassword);
      if (res.status === 'ok') {
        setToken(res.token);
        setUser({ ...res.user, role: 'staff' });
        onAuthSuccess({ ...res.user, role: 'staff' }, res.token);
      } else {
        setError(res.message || 'Invalid staff credentials.');
      }
    } catch (err) {
      setError(err.message || 'Staff login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setShowPassword(false);
  };

  return (
    <div className="auth-page">
      <aside className="auth-story" aria-label="Smart Canteen benefits">
        <div className="auth-brand" aria-label="Smart Canteen">
          <span className="auth-brand-mark"><UtensilsCrossed size={21} /></span>
          <span>Smart Canteen</span>
        </div>
        <div className="auth-story-copy">
          <span className="auth-eyebrow">SCOE · CAMPUS DINING</span>
          <h2>Your next<br />favorite meal<br /><em>is closer.</em></h2>
          <p>Skip the guesswork. Order ahead, follow your place in the queue, and make your break count.</p>
          <div className="auth-benefits">
            <div><span className="auth-benefit-icon"><Clock3 size={17} /></span><span><strong>Know your wait</strong><small>Live kitchen updates</small></span></div>
            <div><span className="auth-benefit-icon"><WalletCards size={17} /></span><span><strong>Keep it simple</strong><small>Your campus wallet, at a glance</small></span></div>
          </div>
        </div>
        <div className="auth-story-footer">MADE FOR YOUR CAMPUS DAY <span>✳</span></div>
      </aside>
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-card-heading">
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            backgroundColor: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '0.75rem'
          }}>
            <UtensilsCrossed size={28} />
          </div>
          <span className="auth-kicker">{mode === 'student-login' ? 'WELCOME BACK' : mode === 'student-signup' ? 'GET STARTED' : 'CANTEEN TEAM'}</span>
          <h1>{mode === 'student-login' ? 'Sign in to continue' : mode === 'student-signup' ? 'Create your account' : 'Staff sign in'}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {mode === 'student-login' && 'Order ahead and make your break count.'}
            {mode === 'student-signup' && 'A better campus lunch starts here.'}
            {mode === 'staff-login' && 'Manage the kitchen and keep orders moving.'}
          </p>
        </div>

        {/* Session expired banner */}
        {expiredMessage && !error && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 0.85rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: '#92400e'
          }}>
            {expiredMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="form-error" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
            marginBottom: '1rem',
            padding: '0.65rem 0.85rem',
            background: '#fee2e2',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #fecaca'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── Student Login Form ───────────────────────────────────────────── */}
        {mode === 'student-login' && (
          <form onSubmit={handleStudentLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@college.edu"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); clearError(); }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); clearError(); }}
                  required
                />
                <button type="button" className="toggle-pw" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('student-signup')}>Sign up</button>
            </p>

            <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-light)' }}>
              <button type="button" className="link-btn" style={{ color: 'var(--text-light)' }} onClick={() => switchMode('staff-login')}>
                Staff? Login here
              </button>
            </p>
          </form>
        )}

        {/* ── Student Signup Form ──────────────────────────────────────────── */}
        {mode === 'student-signup' && (
          <form onSubmit={handleStudentSignup}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                type="text"
                className="form-input"
                placeholder="Your name"
                autoComplete="name"
                value={signupName}
                onChange={(e) => { setSignupName(e.target.value); setFieldErrors(f => ({ ...f, name: '' })); }}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                type="email"
                className="form-input"
                placeholder="you@college.edu"
                autoComplete="email"
                value={signupEmail}
                onChange={(e) => { setSignupEmail(e.target.value); setFieldErrors(f => ({ ...f, email: '' })); }}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-phone">Phone number (10 digits)</label>
              <input
                id="signup-phone"
                type="tel"
                className="form-input"
                placeholder="9876543210"
                autoComplete="tel"
                maxLength={10}
                value={signupPhone}
                onChange={(e) => { setSignupPhone(e.target.value.replace(/\D/g, '')); setFieldErrors(f => ({ ...f, phone: '' })); }}
              />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => { setSignupPassword(e.target.value); setFieldErrors(f => ({ ...f, password: '' })); }}
                />
                <button type="button" className="toggle-pw" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('student-login')}>Log in</button>
            </p>
          </form>
        )}

        {/* ── Staff Login Form ─────────────────────────────────────────────── */}
        {mode === 'staff-login' && (
          <form onSubmit={handleStaffLogin}>
            <div style={{
              background: 'var(--primary-light)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.6rem 0.85rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: 'var(--primary)',
              fontWeight: 600
            }}>
              Staff Portal — Canteen Management
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="staff-username">Username</label>
              <input
                id="staff-username"
                type="text"
                className="form-input"
                placeholder="canteen_staff"
                autoComplete="username"
                value={staffUsername}
                onChange={(e) => { setStaffUsername(e.target.value); clearError(); }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="staff-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Staff password"
                  autoComplete="current-password"
                  value={staffPassword}
                  onChange={(e) => { setStaffPassword(e.target.value); clearError(); }}
                  required
                />
                <button type="button" className="toggle-pw" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Staff Login'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <button type="button" className="link-btn" onClick={() => switchMode('student-login')}>← Back to student login</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

