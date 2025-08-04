'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, LogIn, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

export default function LoginPage() {
    const { login, register, loading, forgotPassword } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        confirmPassword: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error and success messages when user starts typing
        if (error) setError(null);
        if (successMessage) setSuccessMessage(null);
    };

    const validateForm = (): string | null => {
        if (!formData.email) return 'Email is required';
        if (!formData.email.includes('@')) return 'Please enter a valid email address';

        if (showForgotPassword) {
            // Only email is required for forgot password
            return null;
        }

        if (!formData.password) return 'Password is required';
        if (formData.password.length < 6) return 'Password must be at least 6 characters';

        if (isRegistering) {
            if (!formData.name) return 'Name is required';
            if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
        }

        return null;
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.email) {
            setError('Please enter your email address');
            return;
        }

        if (!formData.email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const result = await forgotPassword(formData.email);

            if (result.success) {
                setSuccessMessage('Password reset email sent! Please check your inbox and follow the instructions.');
                setFormData({ email: '', password: '', name: '', confirmPassword: '' });
            } else {
                setError(result.error || 'Failed to send reset email');
            }
        } catch (error) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Handle forgot password submission
        if (showForgotPassword) {
            return handleForgotPassword(e);
        }

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            let result;

            if (isRegistering) {
                result = await register(formData.email, formData.password, formData.name);
                if (result.success) {
                    setSuccessMessage(
                        'Check your email! We’ve sent a confirmation link to your email address. Please click the link in your email to verify your account. After verifying, return to this page or sign in using the new tab.'
                    );
                    setFormData({ email: '', password: '', name: '', confirmPassword: '' });
                    return;
                }
            } else {
                result = await login(formData.email, formData.password);
            }

            if (!result.success) {
                setError(result.error || 'An error occurred');
            }
            // If successful, the AuthContext will handle the redirect for login
        } catch (error) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        setShowForgotPassword(false);
        setError(null);
        setSuccessMessage(null);
        setFormData({
            email: '',
            password: '',
            name: '',
            confirmPassword: ''
        });
    };

    const toggleForgotPassword = () => {
        setShowForgotPassword(!showForgotPassword);
        setIsRegistering(false);
        setError(null);
        setSuccessMessage(null);
        setFormData({
            email: formData.email, // Keep email if entered
            password: '',
            name: '',
            confirmPassword: ''
        });
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F9FAFB',
            padding: '16px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                padding: '32px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#000000',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        {isRegistering ? (
                            <UserPlus style={{ width: '28px', height: '28px', color: '#FFFFFF' }} />
                        ) : (
                            <LogIn style={{ width: '28px', height: '28px', color: '#FFFFFF' }} />
                        )}
                    </div>
                    <h2 style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: '#111827',
                        margin: '0 0 8px 0'
                    }}>
                        {showForgotPassword ? 'Reset Password' : isRegistering ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p style={{
                        color: '#6B7280',
                        fontSize: '14px',
                        margin: '0'
                    }}>
                        {showForgotPassword
                            ? 'Enter your email to receive a password reset link'
                            : isRegistering
                                ? 'Sign up to start analyzing your reviews'
                                : 'Sign in to access your review analytics'
                        }
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <AlertCircle style={{ width: '16px', height: '16px', color: '#DC2626', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', color: '#DC2626' }}>{error}</span>
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <CheckCircle style={{ width: '16px', height: '16px', color: '#16A34A', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', color: '#16A34A' }}>{successMessage}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {/* Name Field (Registration only) */}
                    {isRegistering && (
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '6px'
                            }}>
                                Full Name
                            </label>
                            <div style={{ position: 'relative' }}>
                                <User style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '16px',
                                    height: '16px',
                                    color: '#9CA3AF'
                                }} />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter your full name"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '40px',
                                        paddingRight: '12px',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                                    onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                                />
                            </div>
                        </div>
                    )}

                    {/* Email Field */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '6px'
                        }}>
                            Email Address
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '16px',
                                height: '16px',
                                color: '#9CA3AF'
                            }} />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Enter your email"
                                style={{
                                    width: '100%',
                                    paddingLeft: '40px',
                                    paddingRight: '12px',
                                    paddingTop: '10px',
                                    paddingBottom: '10px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                                onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                            />
                        </div>
                    </div>

                    {/* Password Field - Hidden in forgot password mode */}
                    {!showForgotPassword && (
                        <div style={{ marginBottom: isRegistering ? '20px' : '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '6px'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '16px',
                                    height: '16px',
                                    color: '#9CA3AF'
                                }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Enter your password"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '40px',
                                        paddingRight: '40px',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                                    onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {showPassword ? (
                                        <EyeOff style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
                                    ) : (
                                        <Eye style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Forgot Password Link (Login mode only) */}
                    {!showForgotPassword && !isRegistering && (
                        <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                            <button
                                type="button"
                                onClick={toggleForgotPassword}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#3B82F6',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    {/* Confirm Password Field (Registration only) */}
                    {isRegistering && (
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '6px'
                            }}>
                                Confirm Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '16px',
                                    height: '16px',
                                    color: '#9CA3AF'
                                }} />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Confirm your password"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '40px',
                                        paddingRight: '12px',
                                        paddingTop: '10px',
                                        paddingBottom: '10px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                                    onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                                />
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: submitting ? '#9CA3AF' : '#000000',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {submitting ? (
                            <>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid #FFFFFF',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                                {showForgotPassword ? 'Sending Reset Email...' : isRegistering ? 'Creating Account...' : 'Signing In...'}
                            </>
                        ) : (
                            <>
                                {showForgotPassword ? (
                                    <Mail style={{ width: '16px', height: '16px' }} />
                                ) : isRegistering ? (
                                    <UserPlus style={{ width: '16px', height: '16px' }} />
                                ) : (
                                    <LogIn style={{ width: '16px', height: '16px' }} />
                                )}
                                {showForgotPassword ? 'Send Reset Email' : isRegistering ? 'Create Account' : 'Sign In'}
                            </>
                        )}
                    </button>
                </form>

                {/* Toggle Mode */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '24px',
                    padding: '16px 0',
                    borderTop: '1px solid #E5E7EB'
                }}>
                    {showForgotPassword ? (
                        <>
                            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 8px 0' }}>
                                Remember your password?
                            </p>
                            <button
                                type="button"
                                onClick={toggleForgotPassword}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#3B82F6',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Back to sign in
                            </button>
                        </>
                    ) : (
                        <>
                            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 8px 0' }}>
                                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                            </p>
                            <button
                                type="button"
                                onClick={toggleMode}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#3B82F6',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                {isRegistering ? 'Sign in instead' : 'Create an account'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* CSS for animations */}
            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
} 