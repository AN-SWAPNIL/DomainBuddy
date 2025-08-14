const supabase = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const crypto = require('crypto');

const authController = {
  // @desc    Register a new user
  // @route   POST /api/auth/register
  // @access  Public
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const { data: user, error } = await supabase
        .from('users')
        .insert([
          {
            name,
            email,
            password: hashedPassword,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select('id, name, email, created_at, updated_at')
        .single();

      if (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create user account'
        });
      }

      // Generate tokens
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token in database
      await supabase
        .from('refresh_tokens')
        .insert([
          {
            user_id: user.id,
            token: refreshToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          }
        ]);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  },

  // @desc    Login user
  // @route   POST /api/auth/login
  // @access  Public
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate tokens
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token in database
      await supabase
        .from('refresh_tokens')
        .insert([
          {
            user_id: user.id,
            token: refreshToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          }
        ]);

      // Update last login
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token,
          refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  },

  // @desc    Get current user
  // @route   GET /api/auth/me
  // @access  Private
  getMe: async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Logout user
  // @route   POST /api/auth/logout
  // @access  Private
  logout: async (req, res) => {
    try {
      const authHeader = req.header('Authorization');
      const token = authHeader && authHeader.substring(7);

      // Delete all refresh tokens for this user
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('user_id', req.user.id);

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during logout'
      });
    }
  },

  // @desc    Forgot password
  // @route   POST /api/auth/forgot-password
  // @access  Public
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .single();

      if (error || !user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'If an account with that email exists, we have sent a password reset link'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save reset token to database
      await supabase
        .from('password_resets')
        .insert([
          {
            user_id: user.id,
            token: resetToken,
            expires_at: resetTokenExpiry.toISOString(),
            used: false
          }
        ]);

      // TODO: Send email with reset link
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link',
        // In development, include the token
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Reset password
  // @route   POST /api/auth/reset-password
  // @access  Public
  resetPassword: async (req, res) => {
    try {
      const { token, password } = req.body;

      // Find valid reset token
      const { data: resetRecord, error } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !resetRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update user password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', resetRecord.user_id);

      if (updateError) {
        throw updateError;
      }

      // Mark reset token as used
      await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('id', resetRecord.id);

      // Delete all refresh tokens for security
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('user_id', resetRecord.user_id);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Update password
  // @route   PUT /api/auth/password
  // @access  Private
  updatePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with current password
      const { data: user, error } = await supabase
        .from('users')
        .select('password')
        .eq('id', req.user.id)
        .single();

      if (error || !user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: hashedNewPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user.id);

      if (updateError) {
        throw updateError;
      }

      // Delete all refresh tokens for security
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('user_id', req.user.id);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Refresh access token
  // @route   POST /api/auth/refresh
  // @access  Public
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Check if refresh token exists in database
      const { data: tokenRecord, error } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token', refreshToken)
        .eq('user_id', decoded.userId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !tokenRecord) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      // Generate new tokens
      const newToken = generateToken(decoded.userId);
      const newRefreshToken = generateRefreshToken(decoded.userId);

      // Delete old refresh token and create new one
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('id', tokenRecord.id);

      await supabase
        .from('refresh_tokens')
        .insert([
          {
            user_id: decoded.userId,
            token: newRefreshToken,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]);

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  }
};

module.exports = authController;
