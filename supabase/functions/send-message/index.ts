import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MessageRequest {
  recipients: string[] | 'all'
  subject: string
  message: string
  isImportant?: boolean
  senderId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { recipients, subject, message, isImportant, senderId } = await req.json() as MessageRequest

    console.log('Sending message:', { recipients, subject, isImportant, senderId })

    // Get sender info
    const { data: sender } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', senderId)
      .single()

    if (!sender) {
      throw new Error('Sender not found')
    }

    // Get recipient emails
    let recipientEmails: string[] = []
    
    if (recipients === 'all') {
      const { data: users } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'member')
      
      if (users) {
        recipientEmails = users.map(u => u.email)
      }
    } else {
      recipientEmails = recipients
    }

    console.log(`Sending to ${recipientEmails.length} recipients`)

    // Check if Resend is configured
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured. Saving message to database only.')
      
      // Save message to database (even without email service)
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: senderId,
          subject: subject,
          message: message,
          is_important: isImportant || false,
          recipient_count: recipientEmails.length,
          sent_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error saving message:', insertError)
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Message saved (email service not configured)',
          recipientCount: recipientEmails.length,
          warning: 'Emails not sent - Resend API key missing'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Send email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            ${isImportant ? '.important-badge { background-color: #dc2626; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-bottom: 10px; }' : ''}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>EGMC ChoirHub</h1>
            </div>
            <div class="content">
              ${isImportant ? '<div class="important-badge">⚠️ Important</div>' : ''}
              <p><strong>From:</strong> ${sender.name}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <hr>
              <div style="white-space: pre-wrap;">${message}</div>
            </div>
            <div class="footer">
              <p>This message was sent via EGMC ChoirHub</p>
              <p><a href="https://egmchoir.vercel.app">Visit ChoirHub</a></p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email to all recipients
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'EGMC ChoirHub <noreply@egmcchoir.org>',
        to: recipientEmails,
        subject: isImportant ? `[Important] ${subject}` : subject,
        html: emailHtml,
        reply_to: sender.email
      })
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      throw new Error(`Failed to send email: ${resendData.message || 'Unknown error'}`)
    }

    console.log('Email sent successfully via Resend')

    // Save message to database
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        subject: subject,
        message: message,
        is_important: isImportant || false,
        recipient_count: recipientEmails.length,
        sent_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Error saving message:', insertError)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Message sent successfully',
        recipientCount: recipientEmails.length,
        emailId: resendData.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in send-message function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send message',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
