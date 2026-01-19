// Shared email helper using Resend
// Usage: await sendEmail(to, subject, html)

export interface EmailResult {
  success: boolean
  httpStatus: number
  providerMessageId?: string
  errorMessage?: string
  recipient: string
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Myca <noreply@myca.com>'
  const EMAIL_DEBUG = Deno.env.get('EMAIL_DEBUG') === 'true'
  const RESEND_TEST_RECIPIENT = Deno.env.get('RESEND_TEST_RECIPIENT')

  if (!RESEND_API_KEY) {
    console.error('[EMAIL] RESEND_API_KEY not configured')
    return {
      success: false,
      httpStatus: 0,
      errorMessage: 'Email service not configured',
      recipient: to
    }
  }

  // Test mode: override recipient if RESEND_TEST_RECIPIENT is set
  let actualRecipient = to
  if (RESEND_TEST_RECIPIENT) {
    actualRecipient = RESEND_TEST_RECIPIENT
    if (EMAIL_DEBUG) {
      console.log(`[EMAIL] TEST MODE: Overriding recipient ${to} -> ${actualRecipient}`)
    }
  }

  try {
    const requestBody = {
      from: EMAIL_FROM,
      to: [actualRecipient],
      subject,
      html,
    }

    if (EMAIL_DEBUG) {
      console.log('[EMAIL] Sending request:', {
        to: actualRecipient,
        originalTo: to,
        subject,
      })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    let responseData: any = {}

    try {
      responseData = JSON.parse(responseText)
    } catch {
      // Response is not JSON
    }

    if (!response.ok) {
      const errorMsg = responseData.message || responseData.error || responseText
      console.error(`[EMAIL] Resend API error ${response.status} to ${actualRecipient}:`, errorMsg)

      return {
        success: false,
        httpStatus: response.status,
        errorMessage: errorMsg,
        recipient: to
      }
    }

    const messageId = responseData.id || 'unknown'

    if (EMAIL_DEBUG) {
      console.log(`[EMAIL] Success: ${actualRecipient} - ${subject} (ID: ${messageId})`)
    } else {
      console.log(`[EMAIL] Sent to ${actualRecipient} (ID: ${messageId})`)
    }

    return {
      success: true,
      httpStatus: response.status,
      providerMessageId: messageId,
      recipient: to
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMAIL] Failed to send email:', errorMsg)

    return {
      success: false,
      httpStatus: 0,
      errorMessage: errorMsg,
      recipient: to
    }
  }
}
