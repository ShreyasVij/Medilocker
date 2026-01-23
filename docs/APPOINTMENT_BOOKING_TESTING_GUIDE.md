# Doctor Appointment Booking System - Testing Guide

## System Overview

This is a complete appointment booking flow where patients can:
1. Search for doctors using a unique 16-character code
2. Book appointments with automatic file transfer
3. Doctors manage appointments and files are auto-deleted after completion

---

## Prerequisites

1. **MongoDB Connection** - Ensure `MONGODB_URI` is set in `.env`
2. **NextAuth Setup** - Google OAuth configured
3. **User Roles** - Users need "doctor" role in their profile

---

## How to Test

### Step 1: Create a Doctor Account

1. **Sign in as a doctor user** (ensure user has "doctor" role in `users` collection)
2. **Visit**: `/doctor/profile`
3. **Fill out profile** with:
   - Name, phone, date of birth
   - Hospital name (hos field)
   - City, state, country
   - (Optional) Specialization

4. **On save**, a unique 16-character doctor code will be generated automatically
5. **View your code** at `/doctor/patients` - it will display at the top

Example code format: `ABCD-EFGH-IJKL-MNOP`

---

### Step 2: Patient Books an Appointment

1. **Sign in as a patient**
2. **Visit**: `/appointments/book`
3. **Enter the doctor code** from Step 1
4. **Click "Search"**
   - Doctor profile will appear if code is valid
   - Error will show if code is invalid or doctor is inactive

5. **Select appointment date and time**
   - Date must be today or future
   - Choose from available time slots

6. **Add reason** (optional)
7. **Click "Confirm Appointment"**

**What Happens:**
- Appointment is created with status "upcoming"
- ALL patient medical files are automatically copied to `doctorFiles` collection
- Files are linked to: appointmentId, doctorId, patientId
- Original patient files remain untouched

---

### Step 3: Doctor Views Appointment

1. **Sign in as doctor**
2. **Visit**: `/doctor/patients`
3. **Your doctor code** displays at the top
4. **Calendar shows all appointments**
   - Filter by date using calendar
   - See patient details, time, reason
   - Status: upcoming/ongoing/completed

---

### Step 4: Mark Appointment Complete

1. **On an appointment card**, click **"Mark Complete"**
2. **System automatically:**
   - Updates appointment status to "completed"
   - Sets completedAt timestamp
   - **Deletes all files in `doctorFiles` for this appointment**
   - Patient's original files remain safe in `documents` collection

---

## Database Verification

### Check Doctor Code

```javascript
db.doctors.findOne({ email: "doctor@example.com" })
```

Expected output:
```json
{
  "_id": ObjectId("..."),
  "doctorCode": "ABCD1234EFGH5678",
  "email": "doctor@example.com",
  "name": "Dr. Smith",
  "profile": { ... },
  "status": "active"
}
```

---

### Check Appointments

```javascript
db.appointments.find({ doctorId: ObjectId("...") })
```

Expected output:
```json
{
  "_id": ObjectId("..."),
  "doctorId": ObjectId("..."),
  "patientId": ObjectId("..."),
  "patientName": "John Doe",
  "date": "2026-01-20",
  "appointmentTime": "10:00 AM",
  "status": "upcoming",
  "createdAt": ISODate("...")
}
```

---

### Check Transferred Files

```javascript
db.doctorFiles.find({ appointmentId: ObjectId("...") })
```

Expected output (before completion):
```json
{
  "_id": ObjectId("..."),
  "appointmentId": ObjectId("..."),
  "doctorId": ObjectId("..."),
  "patientId": ObjectId("..."),
  "originalFileId": ObjectId("..."),
  "fileName": "Lab Report.pdf",
  "fileType": "lab",
  "storageUrl": "https://...",
  "transferredAt": ISODate("...")
}
```

After marking complete: Should return **empty array** (files deleted)

---

## API Endpoints

### 1. Search Doctor
```bash
POST /api/doctor/search
Content-Type: application/json

{
  "code": "ABCD-EFGH-IJKL-MNOP"
}
```

Response:
```json
{
  "success": true,
  "doctor": {
    "id": "...",
    "name": "Dr. Smith",
    "specialization": "Cardiology",
    "hospital": "City Hospital",
    "city": "New York"
  }
}
```

---

### 2. Book Appointment
```bash
POST /api/appointments/book
Content-Type: application/json

{
  "doctorId": "...",
  "date": "2026-01-20",
  "time": "10:00 AM",
  "reason": "Regular checkup"
}
```

Response:
```json
{
  "success": true,
  "appointmentId": "...",
  "message": "Appointment booked successfully. Your medical files have been shared with the doctor."
}
```

---

### 3. Get Doctor Appointments
```bash
GET /api/doctor/appointments
```

Response:
```json
{
  "appointments": [
    {
      "id": "...",
      "patientName": "John Doe",
      "date": "2026-01-20",
      "appointmentTime": "10:00 AM",
      "status": "upcoming",
      "reason": "Regular checkup"
    }
  ]
}
```

---

### 4. Mark Appointment Complete
```bash
PATCH /api/doctor/appointments/{id}
Content-Type: application/json

{
  "status": "completed",
  "notes": "Patient is healthy",
  "prescription": "Vitamin D supplements"
}
```

Response:
```json
{
  "success": true
}
```

---

## Error Scenarios

### 1. Invalid Doctor Code
- Code length ≠ 16 characters
- Code contains invalid characters
- Code doesn't exist in database

**Expected**: 400 or 404 error with message

---

### 2. Double Booking
- Same doctor, same date, same time already booked

**Expected**: 400 error - "This time slot is already booked"

---

### 3. Unauthorized Access
- Patient tries to access doctor endpoints
- Doctor tries to modify other doctor's appointments

**Expected**: 401 or 403 error

---

## Testing Checklist

- [ ] Doctor profile creates unique code
- [ ] Doctor code is exactly 16 alphanumeric characters
- [ ] Code is unique (no duplicates in database)
- [ ] Patient can search doctor by code
- [ ] Invalid code shows proper error
- [ ] Appointment booking creates record in database
- [ ] Files are transferred on booking
- [ ] Double booking is prevented (unique index)
- [ ] Doctor calendar shows all appointments
- [ ] Doctor can mark appointments complete
- [ ] Files are deleted when appointment is completed
- [ ] Patient's original files remain after completion
- [ ] Appointment status updates correctly

---

## Troubleshooting

### Doctor code not generating?
- Check if doctor profile save API is being called
- Verify `generateDoctorCode()` is imported from `@db/utils`
- Check database for `doctorCode` field

### Files not transferring?
- Verify patient has documents in `documents` collection
- Check `transferPatientFilesToDoctor()` function logs
- Ensure `doctorFiles` collection exists

### Files not deleting?
- Check if appointment status is actually "completed"
- Verify `deleteAppointmentFiles()` is called in PATCH route
- Check database query matches appointmentId and doctorId

### Double booking not prevented?
- Verify unique index exists: `{ doctorId: 1, date: 1, appointmentTime: 1 }`
- Run: `db.appointments.getIndexes()` to confirm

---

## Production Deployment Notes

1. **Indexes**: Ensure all indexes are created before production
2. **File Storage**: Implement proper cloud storage (S3, etc.)
3. **Notifications**: Add email/SMS for appointment confirmations
4. **Timezone Handling**: Convert times to doctor's timezone
5. **Cancellation Policy**: Add appointment cancellation feature
6. **File Encryption**: Encrypt medical files at rest
7. **Audit Logs**: Track all file access and transfers

---

## Support

For issues or questions, check:
- Database indexes: `packages/db/indexes.ts`
- Schema definitions: `packages/db/doctors.ts`
- API routes: `apps/web/app/api/`
- Components: `apps/web/app/appointments/` and `apps/web/app/doctor/`
