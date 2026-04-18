export const recoverUserOtpEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #DC2626; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Password Reset Request</h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                Hello <strong>{{name}}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                We received a request to reset your password. Please use the following One-Time Password (OTP) to complete the password reset process:
                            </p>
                            
                            <!-- OTP Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 20px 0;">
                                        <div style="display: inline-block; background-color: #fef2f2; border: 2px dashed #DC2626; border-radius: 8px; padding: 20px 40px;">
                                            <span style="font-size: 32px; font-weight: bold; color: #DC2626; letter-spacing: 8px; font-family: 'Courier New', monospace;">{{otp}}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                This OTP will expire in <strong>{{expirationTime}} minutes</strong>.
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 20px;">
                                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                            </p>
                            
                            <!-- Warning Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
                                <tr>
                                    <td style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px;">
                                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 20px;">
                                            <strong>Security Warning:</strong> Never share this OTP with anyone, including our support team. We will never ask for this code.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Additional Info -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                                <tr>
                                    <td style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; color: #075985; font-size: 14px; line-height: 20px;">
                                            <strong>Didn't request this?</strong>
                                        </p>
                                        <p style="margin: 0; color: #075985; font-size: 13px; line-height: 18px;">
                                            If you didn't initiate this password reset, someone may be trying to access your account. We recommend changing your password immediately and enabling two-factor authentication for added security.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 20px; text-align: center;">
                                This email was sent to <a href="mailto:{{email}}" style="color: #DC2626; text-decoration: none;">{{email}}</a>
                            </p>
                            <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px; text-align: center;">
                                &copy; 2026 Your Company Name. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
