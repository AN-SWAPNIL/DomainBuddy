const supabase = require('../config/database');
const { hashPassword } = require('../utils/password');

const userController = {
  // @desc    Get user profile
  // @route   GET /api/user/profile
  // @access  Private
  getProfile: async (req, res) => {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, created_at, updated_at, last_login')
        .eq('id', req.user.id)
        .single();

      if (error || !user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Update user profile
  // @route   PUT /api/user/profile
  // @access  Private
  updateProfile: async (req, res) => {
    try {
      const { name, email } = req.body;
      const updateData = {};

      // Only update fields that are provided
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) {
        // Check if email is already taken by another user
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .neq('id', req.user.id)
          .single();

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken'
          });
        }
        updateData.email = email;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      updateData.updated_at = new Date().toISOString();

      // Update user
      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', req.user.id)
        .select('id, name, email, created_at, updated_at, last_login')
        .single();

      if (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update profile'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  },

  // @desc    Delete user account
  // @route   DELETE /api/user/account
  // @access  Private
  deleteAccount: async (req, res) => {
    try {
      // Delete all related data first
      await Promise.all([
        supabase.from('refresh_tokens').delete().eq('user_id', req.user.id),
        supabase.from('password_resets').delete().eq('user_id', req.user.id),
      ]);

      // Delete user account
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', req.user.id);

      if (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete account'
        });
      }

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
};

module.exports = userController;
