import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const FCM_API_URL = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
const SERVER_API_KEY = process.env.FIREBASE_SERVER_KEY || '';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
}

// Calculate hours until event
function hoursUntilEvent(dateStr: string, timeStr: string): number {
  const eventDateTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  return (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
}

// Get notification type based on hours until event
function getNotificationType(hours: number): string | null {
  if (Math.abs(hours - 48) < 1) return 'event_48h';
  if (Math.abs(hours - 24) < 1) return 'event_24h';
  if (Math.abs(hours - 1) < 0.5) return 'event_1h';
  return null;
}

// Send notification via Firebase Cloud Messaging
async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  eventId: string
) {
  try {
    const response = await axios.post(
      FCM_API_URL,
      {
        message: {
          token,
          notification: {
            title,
            body
          },
          data: {
            eventId,
            type: 'event_reminder'
          }
        }
      },
      {
        headers: {
          'Authorization': `key=${SERVER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    throw error;
  }
}

export default async function handler(req: any, res: any) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔔 Starting event reminder notifications...');

    // Get all upcoming events (next 2 days)
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', twoDaysLater.toISOString().split('T')[0]);

    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No upcoming events' });
    }

    let notificationsSent = 0;
    let errors = 0;

    // Process each event
    for (const event of events) {
      const hours = hoursUntilEvent(event.date, event.time);
      const notificationType = getNotificationType(hours);

      if (!notificationType) continue;

      console.log(`📅 Processing event: ${event.title} (${hours.toFixed(1)}h away)`);

      // Get attending members (RSVP status: 'attending' or 'maybe')
      const { data: rsvps, error: rsvpError } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', event.id)
        .in('status', ['attending', 'maybe']);

      if (rsvpError) {
        console.error('Error fetching RSVPs:', rsvpError);
        errors++;
        continue;
      }

      if (!rsvps || rsvps.length === 0) {
        console.log('No attendees for this event');
        continue;
      }

      // Send notification to each attendee
      for (const rsvp of rsvps) {
        try {
          // Check if notification already sent
          const { data: alreadySent } = await supabase
            .from('sent_notifications')
            .select('id')
            .eq('user_id', rsvp.user_id)
            .eq('event_id', event.id)
            .eq('notification_type', notificationType)
            .maybeSingle();

          if (alreadySent) {
            console.log(`⏭️ Notification already sent for user ${rsvp.user_id}`);
            continue;
          }

          // Get user's device tokens
          const { data: deviceTokens, error: tokensError } = await supabase
            .from('device_tokens')
            .select('token')
            .eq('user_id', rsvp.user_id);

          if (tokensError) {
            console.error('Error fetching device tokens:', tokensError);
            errors++;
            continue;
          }

          if (!deviceTokens || deviceTokens.length === 0) {
            console.log(`No device tokens for user ${rsvp.user_id}`);
            continue;
          }

          // Prepare notification message
          let title = '';
          let body = '';

          if (notificationType === 'event_48h') {
            title = `${event.title} - 48 Hours Away! 📅`;
            body = `Reminder: ${event.title} is happening in 2 days at ${event.time}`;
          } else if (notificationType === 'event_24h') {
            title = `${event.title} - Tomorrow! ⏰`;
            body = `Reminder: ${event.title} is happening tomorrow at ${event.time}`;
          } else if (notificationType === 'event_1h') {
            title = `${event.title} - Starting Soon! 🔔`;
            body = `${event.title} starts in 1 hour at ${event.time}`;
          }

          // Send to all device tokens
          for (const device of deviceTokens) {
            try {
              await sendFCMNotification(device.token, title, body, event.id);
              console.log(`✅ Notification sent to ${rsvp.user_id}`);
              notificationsSent++;
            } catch (error) {
              console.error(`Failed to send to token ${device.token}:`, error);
              errors++;
            }
          }

          // Record notification as sent
          await supabase
            .from('sent_notifications')
            .insert({
              user_id: rsvp.user_id,
              event_id: event.id,
              notification_type: notificationType
            });

        } catch (error) {
          console.error(`Error processing user ${rsvp.user_id}:`, error);
          errors++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Sent ${notificationsSent} notifications, ${errors} errors`
    });

  } catch (error) {
    console.error('❌ Error in notification cron job:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}
