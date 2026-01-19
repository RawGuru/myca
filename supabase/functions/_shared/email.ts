// Shared email helper using Resend
// Usage: await sendEmail(to, subject, html)

export interface EmailResult {
  success: boolean
  error?: string
  testModeBlocked?: boolean // true if blocked by Resend test-mode restrictions
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Myca <noreply@myca.com>'

  if (!RESEND_API_KEY) {
    console.error('[EMAIL] RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()

      // Handle 403 as test-mode restriction (not a real failure)
      if (response.status === 403) {
        console.log(`[EMAIL] Blocked by Resend test-mode for ${to}`)
        return {
          success: true,
          testModeBlocked: true,
          error: 'Blocked by Resend test-mode restriction'
        }
      }

      console.error(`[EMAIL] Resend API error: ${response.status} - ${errorData}`)
      return { success: false, error: `Resend API error: ${response.status}` }
    }

    const data = await response.json()
    console.log(`[EMAIL] Sent to ${to}: ${subject} (ID: ${data.id})`)
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
