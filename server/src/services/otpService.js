const supabase = require('../config/database');
const emailService = require('./emailService');

class OTPService {
  constructor() {
    this.OTP_EXPIRY_MINUTES = 3; // OTP expires in 3 minutes
    this.MAX_ATTEMPTS = 3; // Maximum attempts allowed
  }

  // Generate and send OTP for payment verification
  async generateAndSendOTP(userId, email, paymentData, domainName) {
    try {
      console.log('🔍 Generating OTP for:', { userId, email: email.toLowerCase(), domainName });
      
      // Clean up any existing OTPs for this user
      await this.cleanupExpiredOTPs();
      await this.deleteExistingOTPs(userId, email.toLowerCase());

      // Generate OTP
      const otpCode = emailService.generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      console.log('🔍 Generated OTP:', { otpCode, expiresAt });

      // Store OTP in database
      const { data: otpRecord, error: insertError } = await supabase
        .from('otp_verifications')
        .insert([
          {
            user_id: userId,
            email: email.toLowerCase(),
            otp_code: otpCode,
            payment_data: paymentData,
            expires_at: expiresAt.toISOString(),
            verified: false,
            attempts: 0,
          },
        ])
        .select()
        .single();

      console.log('🔍 OTP stored:', { otpRecord, insertError });

      if (insertError) {
        console.error('Error storing OTP:', insertError);
        throw new Error('Failed to generate verification code');
      }

      // Send OTP email (with fallback for development)
      try {
        await emailService.sendOTPEmail(email, otpCode, domainName);
        console.log('📧 OTP email sent successfully');
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);
        
        // In development, continue even if email fails
        if (process.env.NODE_ENV === 'development') {
          console.log('🚧 Development mode: Continuing without email...');
          console.log('🔑 YOUR OTP CODE:', otpCode);
        } else {
          throw new Error('Failed to send verification email');
        }
      }

      return {
        success: true,
        otpId: otpRecord.id,
        expiresAt: expiresAt,
        message: 'Verification code sent successfully',
      };
    } catch (error) {
      console.error('Error generating OTP:', error);
      throw new Error(error.message || 'Failed to send verification code');
    }
  }

  // Verify OTP and return payment data if valid
  async verifyOTP(userId, email, otpCode) {
    try {
      console.log('🔍 Verifying OTP:', { userId, email: email.toLowerCase(), otpCode });
      
      // Clean up expired OTPs first
      await this.cleanupExpiredOTPs();

      // First, let's try to find the OTP record with more flexible matching
      // Try exact match first
      let { data: otpRecord, error: findError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('otp_code', otpCode)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      console.log('🔍 OTP lookup result (email + code):', { otpRecord, findError });

      // If not found, try with user_id as well
      if (findError || !otpRecord) {
        const { data: otpRecordWithUser, error: findWithUserError } = await supabase
          .from('otp_verifications')
          .select('*')
          .eq('user_id', userId)
          .eq('email', email.toLowerCase())
          .eq('otp_code', otpCode)
          .eq('verified', false)
          .gt('expires_at', new Date().toISOString())
          .single();

        console.log('🔍 OTP lookup with user_id:', { otpRecordWithUser, findWithUserError });
        
        if (!findWithUserError && otpRecordWithUser) {
          otpRecord = otpRecordWithUser;
          findError = null;
        }
      }

      if (findError || !otpRecord) {
        // Let's check what OTPs exist for this email
        const { data: allOTPs } = await supabase
          .from('otp_verifications')
          .select('*')
          .eq('email', email.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(5);
        
        console.log('🔍 All OTPs for email:', allOTPs);

        // Check if there's any valid OTP for this email (regardless of user_id)
        const validOTPForEmail = allOTPs?.find(otp => 
          otp.otp_code === otpCode && 
          !otp.verified && 
          new Date(otp.expires_at) > new Date()
        );

        if (validOTPForEmail) {
          console.log('🔍 Found valid OTP for email, using it:', validOTPForEmail);
          otpRecord = validOTPForEmail;
        } else {
          // Check for any unverified, non-expired OTP to increment attempts
          const { data: invalidOTP } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          console.log('🔍 Invalid OTP check:', invalidOTP);

          if (invalidOTP) {
            // Increment attempt counter
            const newAttempts = (invalidOTP.attempts || 0) + 1;
            
            if (newAttempts >= this.MAX_ATTEMPTS) {
              // Too many attempts, mark as expired
              await supabase
                .from('otp_verifications')
                .update({ expires_at: new Date().toISOString() })
                .eq('id', invalidOTP.id);
                
              throw new Error('Too many incorrect attempts. Please request a new verification code.');
            } else {
              // Update attempt counter
              await supabase
                .from('otp_verifications')
                .update({ attempts: newAttempts })
                .eq('id', invalidOTP.id);
            }
          }

          throw new Error('Invalid or expired verification code');
        }
      }

      // Mark OTP as verified
      const { error: updateError } = await supabase
        .from('otp_verifications')
        .update({ 
          verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', otpRecord.id);

      if (updateError) {
        console.error('Error updating OTP status:', updateError);
        throw new Error('Verification failed');
      }

      return {
        success: true,
        paymentData: otpRecord.payment_data,
        message: 'Verification successful',
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error(error.message || 'Verification failed');
    }
  }

  // Resend OTP
  async resendOTP(userId, email) {
    try {
      // Find existing unverified OTP
      const { data: existingOTP, error: findError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('email', email)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (findError || !existingOTP) {
        throw new Error('No active verification session found. Please start the payment process again.');
      }

      // Check if it's too soon to resend (prevent spam)
      const timeSinceCreation = new Date() - new Date(existingOTP.created_at);
      const minResendInterval = 30 * 1000; // 30 seconds

      if (timeSinceCreation < minResendInterval) {
        const waitTime = Math.ceil((minResendInterval - timeSinceCreation) / 1000);
        throw new Error(`Please wait ${waitTime} seconds before requesting a new code.`);
      }

      // Generate new OTP
      const newOtpCode = emailService.generateOTP();
      const newExpiresAt = new Date();
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      // Update existing record
      const { error: updateError } = await supabase
        .from('otp_verifications')
        .update({
          otp_code: newOtpCode,
          expires_at: newExpiresAt.toISOString(),
          attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOTP.id);

      if (updateError) {
        console.error('Error updating OTP:', updateError);
        throw new Error('Failed to resend verification code');
      }

      // Extract domain name from payment data
      const domainName = existingOTP.payment_data?.domain || 'your domain';

      // Send new OTP email
      await emailService.sendOTPEmail(email, newOtpCode, domainName);

      return {
        success: true,
        expiresAt: newExpiresAt,
        message: 'New verification code sent successfully',
      };
    } catch (error) {
      console.error('Error resending OTP:', error);
      throw new Error(error.message || 'Failed to resend verification code');
    }
  }

  // Clean up expired OTPs
  async cleanupExpiredOTPs() {
    try {
      const { error } = await supabase
        .from('otp_verifications')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error && error.code !== 'PGRST116') {
        console.error('Error cleaning up expired OTPs:', error);
      }
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  }

  // Delete existing OTPs for a user/email combination
  async deleteExistingOTPs(userId, email) {
    try {
      const { error } = await supabase
        .from('otp_verifications')
        .delete()
        .eq('email', email.toLowerCase());

      if (error && error.code !== 'PGRST116') {
        console.error('Error deleting existing OTPs:', error);
      }
    } catch (error) {
      console.error('Error in deleteExistingOTPs:', error);
    }
  }

  // Check if user has active OTP session
  async hasActiveOTPSession(userId, email) {
    try {
      const { data: activeOTP, error } = await supabase
        .from('otp_verifications')
        .select('id, expires_at, created_at')
        .eq('user_id', userId)
        .eq('email', email)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking active OTP session:', error);
        return false;
      }

      return !!activeOTP;
    } catch (error) {
      console.error('Error in hasActiveOTPSession:', error);
      return false;
    }
  }

  // Get OTP session status
  async getOTPSessionStatus(userId, email) {
    try {
      const { data: otpRecord, error } = await supabase
        .from('otp_verifications')
        .select('id, expires_at, created_at, attempts, verified')
        .eq('user_id', userId)
        .eq('email', email)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        return { hasActiveSession: false };
      }

      if (!otpRecord) {
        return { hasActiveSession: false };
      }

      const now = new Date();
      const expiresAt = new Date(otpRecord.expires_at);
      const timeRemaining = Math.max(0, expiresAt - now);

      return {
        hasActiveSession: true,
        timeRemaining: timeRemaining,
        attemptsRemaining: this.MAX_ATTEMPTS - (otpRecord.attempts || 0),
        canResend: (now - new Date(otpRecord.created_at)) > 30000, // 30 seconds
      };
    } catch (error) {
      console.error('Error getting OTP session status:', error);
      return { hasActiveSession: false };
    }
  }
}

module.exports = new OTPService();
