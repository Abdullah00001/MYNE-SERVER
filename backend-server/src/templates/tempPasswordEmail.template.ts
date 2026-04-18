export const tempPasswordEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Your Temporary Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">

    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td style="padding: 20px 0;">

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
                    style="margin: 0 auto; width: 100%; max-width: 600px;">
                    <tr>
                        <td>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                                <!-- Header -->
                                <tr>
                                    <td style="background-color: #0284c7; padding: 40px 40px 30px 40px; text-align: center;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 20px auto;">
                                            <tr>
                                                <td style="width: 64px; height: 64px; background-color: #ffffff; border-radius: 50%; text-align: center; vertical-align: middle;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="64" height="64">
                                                        <tr>
                                                            <td style="text-align: center; vertical-align: middle;">
                                                                <span style="font-size: 28px; color: #0284c7; font-weight: bold; line-height: 1;">&#128274;</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: bold; line-height: 1.3; font-family: Arial, Helvetica, sans-serif;">
                                            Your Account Is Ready
                                        </h1>
                                        <p style="margin: 10px 0 0 0; color: #bae6fd; font-size: 15px; line-height: 1.5; font-family: Arial, Helvetica, sans-serif;">
                                            An administrator has created an account for you
                                        </p>
                                    </td>
                                </tr>

                                <!-- Body -->
                                <tr>
                                    <td style="padding: 40px 40px 20px 40px;">

                                        <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px; font-family: Arial, Helvetica, sans-serif;">
                                            Hello <strong>{{name}}</strong>,
                                        </p>

                                        <p style="margin: 0 0 28px 0; color: #555555; font-size: 15px; line-height: 24px; font-family: Arial, Helvetica, sans-serif;">
                                            Your account has been set up and is ready to use. Below is your temporary login password. Please log in and set a new password as soon as possible.
                                        </p>

                                        <!-- Credentials box -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                                            <tr>
                                                <td style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 24px;">
                                                    <p style="margin: 0 0 16px 0; color: #075985; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif;">
                                                        Your login credentials
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                                        <tr>
                                                            <td style="width: 80px; padding: 8px 0; vertical-align: top;">
                                                                <span style="color: #64748b; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">Email</span>
                                                            </td>
                                                            <td style="padding: 8px 0; vertical-align: top;">
                                                                <span style="color: #0c4a6e; font-size: 14px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">{{email}}</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                                        <tr>
                                                            <td style="border-top: 1px solid #bae6fd; font-size: 0; line-height: 0;">&nbsp;</td>
                                                        </tr>
                                                    </table>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="width: 80px; padding: 8px 0; vertical-align: middle;">
                                                                <span style="color: #64748b; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">Password</span>
                                                            </td>
                                                            <td style="padding: 8px 0; vertical-align: middle;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                                    <tr>
                                                                        <td style="background-color: #0284c7; border-radius: 4px; padding: 8px 16px;">
                                                                            <span style="color: #ffffff; font-size: 16px; font-weight: bold; letter-spacing: 2px; font-family: 'Courier New', Courier, monospace;">{{password}}</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Expiry warning -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 28px;">
                                            <tr>
                                                <td style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px 20px; border-radius: 0 4px 4px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="width: 24px; vertical-align: top; padding-top: 1px;">
                                                                <span style="font-size: 16px; color: #c2410c;">&#9888;</span>
                                                            </td>
                                                            <td style="padding-left: 8px; vertical-align: top;">
                                                                <p style="margin: 0 0 4px 0; color: #9a3412; font-size: 14px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">
                                                                    This password expires in {{passwordExpireAt}} {{passwordExpireAtTimeUnit}}
                                                                </p>
                                                                <p style="margin: 0; color: #c2410c; font-size: 13px; line-height: 20px; font-family: Arial, Helvetica, sans-serif;">
                                                                    After it expires, use the <strong>Forgot Password</strong> option on the login page to regain access.
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Steps -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                                            <tr>
                                                <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px;">
                                                    <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 14px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">
                                                        What to do next
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                                        <tr>
                                                            <td style="width: 28px; vertical-align: top; padding-top: 1px;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                                    <tr>
                                                                        <td style="width: 22px; height: 22px; background-color: #0284c7; border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                            <span style="color: #ffffff; font-size: 11px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">1</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td style="padding-left: 10px; vertical-align: top;">
                                                                <p style="margin: 0; color: #334155; font-size: 14px; line-height: 22px; font-family: Arial, Helvetica, sans-serif;">
                                                                    Log in using the email and temporary password above
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">
                                                        <tr>
                                                            <td style="width: 28px; vertical-align: top; padding-top: 1px;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                                    <tr>
                                                                        <td style="width: 22px; height: 22px; background-color: #0284c7; border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                            <span style="color: #ffffff; font-size: 11px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">2</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td style="padding-left: 10px; vertical-align: top;">
                                                                <p style="margin: 0; color: #334155; font-size: 14px; line-height: 22px; font-family: Arial, Helvetica, sans-serif;">
                                                                    You will be prompted to set a new permanent password immediately
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="width: 28px; vertical-align: top; padding-top: 1px;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                                    <tr>
                                                                        <td style="width: 22px; height: 22px; background-color: #059669; border-radius: 50%; text-align: center; vertical-align: middle;">
                                                                            <span style="color: #ffffff; font-size: 11px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">&#10003;</span>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td style="padding-left: 10px; vertical-align: top;">
                                                                <p style="margin: 0; color: #334155; font-size: 14px; line-height: 22px; font-family: Arial, Helvetica, sans-serif;">
                                                                    Your account is fully activated — start exploring!
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>

                                        <p style="margin: 24px 0 0 0; color: #666666; font-size: 13px; line-height: 20px; font-family: Arial, Helvetica, sans-serif;">
                                            If you did not expect this email or have any questions, please contact our support team and we will assist you.
                                        </p>

                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 24px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                                        <p style="margin: 0 0 8px 0; color: #666666; font-size: 13px; line-height: 20px; text-align: center; font-family: Arial, Helvetica, sans-serif;">
                                            This email was sent to
                                            <a href="mailto:{{email}}" style="color: #0284c7; text-decoration: none;">{{email}}</a>
                                        </p>
                                        <p style="margin: 0 0 8px 0; color: #999999; font-size: 12px; line-height: 18px; text-align: center; font-family: Arial, Helvetica, sans-serif;">
                                            Do not share your password with anyone. We will never ask for it.
                                        </p>
                                        <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px; text-align: center; font-family: Arial, Helvetica, sans-serif;">
                                            &copy; 2026 Your Company Name. All rights reserved.
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

</body>
</html>
`;
