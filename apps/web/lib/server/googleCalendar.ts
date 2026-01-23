import { google, calendar_v3 } from "googleapis";
import type { DoctorDocument } from "@db/doctors";

/**
 * Create an authorized OAuth2 client for Google Calendar API
 */
export function createOAuth2Client(tokens: DoctorDocument["googleTokens"]) {
  if (!tokens?.access_token || !tokens?.refresh_token) {
    throw new Error("Missing Google tokens");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Auto-refresh tokens when expired
  oauth2Client.on("tokens", (newTokens) => {
    console.log("Google tokens refreshed automatically");
  });

  return oauth2Client;
}

/**
 * Create a Google Calendar event for an appointment
 */
export async function createCalendarEvent(params: {
  oauth2Client: any;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  duration?: number; // minutes
  reason?: string;
}): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: params.oauth2Client });

  // Parse date and time
  const [year, month, day] = params.date.split("-").map(Number);
  const [timePart, period] = params.time.split(" ");
  const [hours, minutes] = timePart.split(":").map(Number);
  
  let hour24 = hours;
  if (period === "PM" && hours !== 12) hour24 += 12;
  if (period === "AM" && hours === 12) hour24 = 0;

  // Create start datetime (Asia/Kolkata timezone)
  const startDateTime = new Date(year, month - 1, day, hour24, minutes);
  
  // Calculate end datetime (default 30 minutes if not specified)
  const endDateTime = new Date(startDateTime.getTime() + (params.duration || 30) * 60000);

  const event: calendar_v3.Schema$Event = {
    summary: `Appointment with ${params.patientName}`,
    description: `MediLocker Appointment${params.reason ? `\nReason: ${params.reason}` : ""}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    colorId: "2", // Green color for medical appointments
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 60 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  if (!response.data.id) {
    throw new Error("Failed to create calendar event");
  }

  console.log(`✅ Created Google Calendar event: ${response.data.id}`);
  return response.data.id;
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(
  oauth2Client: any,
  eventId: string
): Promise<void> {
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  await calendar.events.delete({
    calendarId: "primary",
    eventId: eventId,
  });

  console.log(`✅ Deleted Google Calendar event: ${eventId}`);
}

/**
 * Refresh Google OAuth tokens if needed
 */
export async function refreshTokensIfNeeded(
  oauth2Client: any
): Promise<{ access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }> {
  const tokens = oauth2Client.credentials;
  
  // Check if token is expired or expiring soon (within 5 minutes)
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + 5 * 60 * 1000) {
    console.log("Refreshing expired Google tokens...");
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  }
  
  return tokens;
}
