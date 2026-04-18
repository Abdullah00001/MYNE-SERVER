export const signupSuccessfulEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome! Account Verified</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #059669; border-radius: 8px 8px 0 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <!-- Success Icon -->
                                        <div style="display: inline-block; background-color: #ffffff; border-radius: 50%; width: 60px; height: 60px; margin-bottom: 20px;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" height="60">
                                                <tr>
                                                    <td style="text-align: center; vertical-align: middle;">
                                                        <span style="color: #059669; font-size: 36px; font-weight: bold;">&#10004;</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="text-align: center;">
                                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to Our Platform!</h1>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                Hello <strong>{{name}}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                Congratulations! Your email has been successfully verified and your account is now active. Welcome aboard!
                            </p>
                            
                            <!-- Success Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                                <tr>
                                    <td style="background-color: #d1fae5; border-left: 4px solid #059669; padding: 20px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; color: #065f46; font-size: 16px; line-height: 22px; font-weight: bold;">
                                            &#10004; Account verified successfully
                                        </p>
                                        <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 20px;">
                                            You can now access all features of your account.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                                You're all set to start using our platform. We're excited to have you with us!
                            </p>
                            
                            <!-- Next Steps Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
                                <tr>
                                    <td style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; border-radius: 4px;">
                                        <p style="margin: 0 0 10px 0; color: #075985; font-size: 14px; line-height: 20px; font-weight: bold;">
                                            What's Next?
                                        </p>
                                        <ul style="margin: 0; padding-left: 20px; color: #075985; font-size: 13px; line-height: 18px;">
                                            <li style="margin-bottom: 5px;">Complete your profile to get started</li>
                                            <li style="margin-bottom: 5px;">Explore our features and tools</li>
                                            <li style="margin-bottom: 0;">Connect with our community</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Support Info -->
                            <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 20px;">
                                If you have any questions or need assistance, feel free to reach out to our support team. We're here to help!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 20px; text-align: center;">
                                This email was sent to <a href="mailto:{{email}}" style="color: #059669; text-decoration: none;">{{email}}</a>
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
