import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Register user with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name || email.split('@')[0]
                }
            }
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'Registration successful. Please check your email for verification.',
            user: data.user,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: data.user,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Logout user
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            // Sign out from Supabase
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error('Logout error:', error);
            }
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Refresh session
router.post('/refresh', async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        // Refresh session with Supabase
        const { data, error } = await supabase.auth.refreshSession({
            refresh_token
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            success: true,
            session: data.session
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Send password reset email via Supabase
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'Password reset email sent. Please check your inbox.'
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Reset password with new password
router.post('/reset-password', async (req, res) => {
    try {
        const { access_token, refresh_token, new_password } = req.body;

        if (!access_token || !new_password) {
            return res.status(400).json({ error: 'Access token and new password are required' });
        }

        // Set the session first
        const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token
        });

        if (sessionError) {
            return res.status(400).json({ error: sessionError.message });
        }

        // Update the password
        const { error } = await supabase.auth.updateUser({
            password: new_password
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get current user profile
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);

        // Get user from Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.email?.split('@')[0],
                created_at: user.created_at
            }
        });

    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router; 