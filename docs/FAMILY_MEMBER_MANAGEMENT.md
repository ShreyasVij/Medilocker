# Family Member Management - Implementation Guide

## Overview
This implementation adds comprehensive family member management features to MediLocker, including the ability to remove family members and view their medical documents with proper RBAC enforcement.

## Features Implemented

### 1. Remove/Delete Family Member Feature

#### Backend API: DELETE `/api/family/members/[memberId]`
- **Location**: `apps/web/app/api/family/members/[memberId]/route.ts`
- **Access Control**: Only family owner can remove members
- **Key Features**:
  - Soft unlink (removes from family, doesn't delete user account)
  - Prevents removing self
  - Prevents removing other owners
  - Revokes all emergency access tokens for removed member
  - Logs action in audit trail
  - Atomic database operations

#### Security Measures:
1. **RBAC Enforcement**: Only family owner (`familyRole === "owner"`) can remove members
2. **Validation**: Validates member ID format and family membership
3. **Audit Logging**: All removal attempts (success/failure) logged to `audits` collection
4. **Token Revocation**: Automatically revokes emergency tokens using `emergencyTokens` collection
5. **Safe Guards**: Cannot remove self or other owners

### 2. Click-to-View Family Member Documents

#### Backend API: GET `/api/family/members/[memberId]/documents`
- **Location**: `apps/web/app/api/family/members/[memberId]/documents/route.ts`
- **Access Control**: Only family members in same family can access
- **Key Features**:
  - Fetches all documents for a specific family member
  - Supports search, filtering, and sorting
  - Prevents access to removed members (validates current family membership)
  - Prevents ID guessing attacks (validates both users are in same family)
  - Enriches documents with summaries, versions, and OCR data
  - Audit logging for all access attempts

#### Query Parameters:
- `search`: Search in patient name, doctor name, diagnosis, tags
- `type`: Filter by document type (prescription, lab, scan, discharge, other)
- `status`: Filter by status (default: active)
- `sortBy`: Sort field (date, type)
- `sortOrder`: Sort direction (asc, desc)

#### Security Measures:
1. **Family Membership Validation**: Verifies both current user and target member are in same family
2. **Removed Member Protection**: Rejects access if member no longer in family
3. **ID Guessing Prevention**: Cannot access arbitrary user IDs
4. **Audit Trail**: Logs all document access attempts
5. **Profile-Based Access**: Only fetches documents from profiles owned by target member

### 3. Family Member Detail Page

#### Frontend Page: `/family/members/[memberId]`
- **Location**: `apps/web/app/family/members/[memberId]/page.tsx`
- **Key Features**:
  - Member profile summary with medical information
  - Full document list with search and filtering
  - Real-time search functionality
  - Document type filtering
  - Sorting options (newest/oldest, type)
  - Empty states for no documents
  - Error handling for removed/inaccessible members
  - Loading states
  - Medical-grade clean UX

#### UI Components:
- Profile header with avatar and basic info
- Medical information card (blood group, allergies, conditions)
- Document search bar
- Type and sort filters
- Document cards with:
  - Document type badges
  - Date stamps
  - Doctor name
  - Summary preview
  - Diagnosis
  - Tags
  - Click to view full document

### 4. Updated Family List with Remove Functionality

#### Component: `FamilyMemberCard`
- **Location**: `apps/web/components/FamilyMemberCard.tsx`
- **Key Features**:
  - Click anywhere on card to view member details
  - Remove button (only for owner, not for self or other owners)
  - Confirmation modal before removal
  - Success/error toast notifications
  - Loading states during removal
  - Automatic page refresh after successful removal

#### Component: `ConfirmModal`
- **Location**: `apps/web/components/ConfirmModal.tsx`
- **Reusable modal for dangerous actions**
- Features:
  - Warning icon
  - Customizable title and message
  - Confirm/cancel buttons
  - Loading state support
  - Backdrop click to close

#### Component: `Toast`
- **Location**: `apps/web/components/Toast.tsx`
- **Notification system**
- Types: success, error, info
- Auto-dismiss after 5 seconds
- Slide-up animation
- Manual dismiss option

## Database Schema

### Collections Modified/Used

#### `users` Collection
```typescript
{
  _id: ObjectId,
  email: string,
  name: string,
  familyId?: string,  // Reference to families collection
  familyRole?: "owner" | "member",
  // ... other fields
}
```

#### `families` Collection
```typescript
{
  _id: ObjectId,
  ownerId: ObjectId,  // User who created family
  members: ObjectId[],  // Array of user IDs
  createdAt: Date
}
```

#### `emergencyTokens` Collection
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  profileId: ObjectId,
  tokenHash: string,
  used: boolean,
  revoked: boolean,
  revokedAt?: Date,
  revokedBy?: ObjectId,
  // ... other fields
}
```

#### `audits` Collection
```typescript
{
  id: string,
  actorId: string,
  action: 'access.revoke' | 'document.download' | ...,
  target: string,  // Member ID being accessed/removed
  targetType: 'user' | 'document' | ...,
  result: 'success' | 'failure',
  timestamp: Date,
  metadata: Record<string, unknown>
}
```

## User Flow

### Removing a Family Member

1. Family owner navigates to `/family`
2. Clicks trash icon next to member (only visible for non-owner members)
3. Confirmation modal appears with warning
4. Owner clicks "Remove Member"
5. Backend:
   - Validates owner permissions
   - Removes member from `families.members` array
   - Clears `familyId` and `familyRole` from user document
   - Revokes all emergency tokens for member's profiles
   - Logs action to audit trail
6. Success toast appears
7. Page refreshes to show updated member list

### Viewing Family Member Documents

1. Family member navigates to `/family`
2. Clicks on a member card
3. Navigates to `/family/members/[memberId]`
4. Backend:
   - Validates both users are in same family
   - Prevents access to removed members
   - Fetches member's profiles
   - Fetches all documents for those profiles
   - Enriches with summaries and metadata
5. Page displays:
   - Member profile summary
   - Medical information
   - Searchable/filterable document list
6. User can:
   - Search documents
   - Filter by type
   - Sort by date or type
   - Click document to view details

## Security Considerations

### RBAC Enforcement
- Family owner role required for removal
- Family membership required for viewing documents
- Profile ownership validated for document access

### Audit Trail
All actions logged with:
- Actor ID (who performed action)
- Target ID (who was affected)
- Action type
- Result (success/failure)
- Metadata (additional context)
- IP address and user agent

### Token Revocation
When member removed:
- All emergency tokens for their profiles revoked
- `revoked` flag set to `true`
- `revokedAt` timestamp recorded
- `revokedBy` set to actor (family owner)

### Input Validation
- ObjectId format validation
- Family membership validation
- Role validation
- Prevents self-removal
- Prevents removing other owners

## API Endpoints Summary

| Endpoint | Method | Purpose | Access |
|----------|--------|---------|--------|
| `/api/family/members/[memberId]` | DELETE | Remove family member | Owner only |
| `/api/family/members/[memberId]` | GET | Get member details | Family members |
| `/api/family/members/[memberId]/documents` | GET | Get member's documents | Family members |

## Frontend Routes

| Route | Purpose | Access |
|-------|---------|--------|
| `/family` | Family member list | Authenticated |
| `/family/members/[memberId]` | Member detail & documents | Family members |
| `/family/invite` | Invite new member | Owner only |

## Testing Checklist

- [ ] Owner can remove regular members
- [ ] Owner cannot remove self
- [ ] Owner cannot remove other owners
- [ ] Regular members cannot remove anyone
- [ ] Removed member loses access to family documents
- [ ] Emergency tokens revoked on removal
- [ ] Audit logs created for all actions
- [ ] Cannot access removed member's documents
- [ ] Cannot guess member IDs
- [ ] Search and filtering works
- [ ] Sorting works correctly
- [ ] Toast notifications appear
- [ ] Page refreshes after removal
- [ ] Loading states display properly
- [ ] Error handling works

## Files Created/Modified

### Created:
- `apps/web/app/api/family/members/[memberId]/route.ts`
- `apps/web/app/api/family/members/[memberId]/documents/route.ts`
- `apps/web/app/family/members/[memberId]/page.tsx`
- `apps/web/components/FamilyMemberCard.tsx`
- `apps/web/components/ConfirmModal.tsx`
- `apps/web/components/Toast.tsx`

### Modified:
- `apps/web/app/family/page.tsx` (integrated FamilyMemberCard)
- `apps/web/app/globals.css` (added toast animation)

## Future Enhancements

1. **Emergency Mode Support**: Implement limited access mode for emergency situations
2. **Bulk Operations**: Remove multiple members at once
3. **Transfer Ownership**: Allow owner to transfer ownership to another member
4. **Member Permissions**: Granular permissions per member
5. **Activity Feed**: Show recent document access by family members
6. **Notifications**: Email notifications when removed from family
7. **Undo Feature**: Temporary undo for accidental removals
8. **Archive Instead of Remove**: Soft archive with restore capability

## Performance Considerations

- Documents limited to 100 per request
- Indexes on `userId`, `familyId`, `profileId` for fast lookups
- Efficient aggregation queries
- Pagination support (ready for implementation)
- Batch emergency token revocation

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Color contrast compliance
- Screen reader friendly
- Focus management in modals
- Loading state announcements

## Medical-Grade UX

- Clear visual hierarchy
- Professional color scheme
- Confirmation for destructive actions
- Loading states for all async operations
- Error messages with recovery options
- Success feedback
- Empty states with helpful messaging
- Consistent spacing and typography
