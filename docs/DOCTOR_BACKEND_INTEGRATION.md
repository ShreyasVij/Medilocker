# Doctor Module - Backend Integration

This document describes the backend integration for the doctor module.

## Schema Structure

### DoctorDocument
Located in `packages/db/doctors.ts`

```typescript
{
  _id: ObjectId,
  userId?: ObjectId,  // Link to users collection
  email: string,
  name: string,
  profile?: {
    phone?: string,
    dob?: Date,
    gender?: "male" | "female" | "other" | "prefer_not_to_say",
    profileImageUrl?: string,
    profileImageName?: string,
    location?: {
      hos?: string,     // Hospital name
      city?: string,
      state?: string,
      country?: string
    }
  },
  role: "Doctor",
  status?: "active" | "inactive" | "suspended",
  lastLoginAt?: Date,
  createdAt: Date,
  updatedAt?: Date
}
```

### AppointmentDocument
Located in `packages/db/doctors.ts`

```typescript
{
  _id: ObjectId,
  doctorId: ObjectId,
  patientId?: ObjectId,
  patientName: string,
  patientAge: number,
  patientGender: "Male" | "Female" | "Other",
  appointmentTime: string,  // e.g., "09:00 AM"
  date: string,             // ISO date: "2026-01-16"
  duration?: number,        // minutes
  status: "upcoming" | "ongoing" | "completed" | "cancelled",
  reason?: string,
  notes?: string,
  diagnosis?: string,
  prescription?: string,
  createdAt: Date,
  updatedAt?: Date,
  completedAt?: Date,
  cancelledAt?: Date
}
```

## API Endpoints

### Doctor Profile

#### GET `/api/doctor/profile`
Fetch the logged-in doctor's profile.

**Response:**
```json
{
  "profile": { /* DoctorProfile */ },
  "doctor": { /* Full DoctorDocument */ }
}
```

#### POST `/api/doctor/profile`
Update the doctor's profile.

**Request Body:**
```json
{
  "phone": "string",
  "dob": "2000-01-01",
  "gender": "male",
  "hos": "Hospital Name",
  "city": "City",
  "state": "State",
  "country": "India",
  "avatarUrl": "url",
  "avatarFileName": "filename.jpg"
}
```

### Appointments

#### GET `/api/doctor/appointments`
Fetch appointments for the logged-in doctor.

**Query Parameters:**
- `date` (optional): Filter by date (YYYY-MM-DD)
- `status` (optional): Filter by status

**Response:**
```json
{
  "appointments": [
    {
      "id": "string",
      "patientName": "string",
      "age": 30,
      "gender": "Male",
      "appointmentTime": "09:00 AM",
      "date": "2026-01-16",
      "status": "upcoming",
      "reason": "Checkup",
      "notes": "..."
    }
  ]
}
```

#### POST `/api/doctor/appointments`
Create a new appointment.

**Request Body:**
```json
{
  "patientName": "string",
  "patientAge": 30,
  "patientGender": "Male",
  "appointmentTime": "09:00 AM",
  "date": "2026-01-16",
  "duration": 30,
  "reason": "Checkup",
  "notes": "...",
  "patientId": "optional"
}
```

**Response:**
```json
{
  "success": true,
  "appointmentId": "string"
}
```

#### PATCH `/api/doctor/appointments/[id]`
Update an appointment.

**Request Body:**
```json
{
  "status": "completed",
  "notes": "...",
  "diagnosis": "...",
  "prescription": "..."
}
```

#### DELETE `/api/doctor/appointments/[id]`
Delete/cancel an appointment.

## Frontend Integration

### Services

#### `services/doctorService.ts`
Handles doctor profile operations:
- `fetchProfile()` - Get doctor profile
- `updateProfile(data)` - Update doctor profile
- `uploadAvatar(file)` - Upload profile picture

#### `services/appointmentService.ts`
Handles appointment operations:
- `fetchAppointments(date?, status?)` - Get appointments
- `createAppointment(data)` - Create new appointment
- `updateAppointment(id, updates)` - Update appointment
- `deleteAppointment(id)` - Delete appointment
- `markComplete(id)` - Mark as completed
- `markOngoing(id)` - Mark as ongoing

### Usage in Components

#### Doctor Profile Page
```typescript
// apps/web/app/doctor/profile/page.tsx
// Uses /api/doctor/profile for loading and saving
```

#### Patients Page
```typescript
// apps/web/app/doctor/patients/page.tsx
// Fetches real appointments from backend
// Updates appointment status via API
```

## Database Setup

The collections are automatically initialized with indexes when the app starts.

**Collections:**
- `doctors` - Doctor profiles
- `appointments` - Appointment records

**Indexes:**
- Doctor email (unique)
- Doctor userId
- Appointment doctorId + date
- Appointment status
- And more (see `packages/db/doctors.ts`)

## Authorization

All doctor endpoints verify:
1. User is authenticated (via NextAuth session)
2. User has "doctor" role in their user document
3. Operations only affect the logged-in doctor's data

## Next Steps

To fully connect the system:

1. **Ensure users have doctor role:**
   ```typescript
   // Add "doctor" to user's roles array
   roles: ["patient", "doctor"]
   ```

2. **Initialize doctor profile:**
   - On first login, create DoctorDocument
   - Link to user via userId field

3. **Add appointment creation UI:**
   - Form to create new appointments
   - Calendar integration for scheduling

4. **Add patient linking:**
   - Link appointments to patient user accounts
   - Enable patient access to their appointments
