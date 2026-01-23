# Quick Start Guide: Family Member Management

## For Family Owners

### Viewing Your Family
1. Navigate to `/family`
2. You'll see all family members with their roles
3. Your role badge shows "Owner"

### Removing a Family Member
1. Go to `/family`
2. Find the member you want to remove
3. Click the **trash icon** (🗑️) next to their name
   - Note: You can only remove regular members, not yourself or other owners
4. A confirmation modal will appear asking you to confirm
5. Click **"Remove Member"**
6. A success notification will appear
7. The member list will refresh automatically

**What happens when you remove a member:**
- They are removed from the family group
- Their emergency access tokens are revoked
- They lose access to shared family documents
- The action is logged in the audit trail
- They can still access their own documents

### Viewing a Family Member's Documents
1. Go to `/family`
2. **Click anywhere on a member's card**
3. You'll be taken to their detail page showing:
   - Profile summary
   - Medical information (if available)
   - All their medical documents

### Searching and Filtering Documents
On a member's detail page:
- **Search**: Type in the search box to find documents by patient name, doctor name, diagnosis, or tags
- **Filter by Type**: Select a document type from the dropdown (Prescription, Lab Report, Scan, etc.)
- **Sort**: Choose how to sort documents:
  - Newest First (default)
  - Oldest First
  - Type A-Z
  - Type Z-A

### Viewing Individual Documents
- Click on any document card to view the full document details
- You'll be taken to `/dashboard/documents/[documentId]`

## For Family Members

### Viewing Your Family
1. Navigate to `/family`
2. You'll see all family members
3. Your role badge shows "Member"

### Viewing Other Family Members' Documents
1. Go to `/family`
2. **Click on any family member's card**
3. You'll see their profile and all their documents
4. Use search and filters to find specific documents

**What you can do:**
- View all family members' profiles
- View all family members' documents
- Search and filter documents

**What you cannot do:**
- Remove family members (owner-only)
- Invite new members (owner-only)

## Common Use Cases

### Emergency Situation
1. Navigate to `/family`
2. Click on the family member who needs medical attention
3. View their:
   - Blood group
   - Known allergies
   - Chronic conditions
   - Recent medical reports
4. Use search to find specific document types (e.g., "prescription")

### Reviewing Medical History
1. Go to family member's page
2. Sort by "Oldest First" to see medical history chronologically
3. Filter by type to see all lab reports, prescriptions, etc.

### Finding a Specific Document
1. Navigate to family member's page
2. Type doctor's name, diagnosis, or other keywords in search
3. Documents will filter in real-time

## Error Messages & What They Mean

### "Only the family owner can remove members"
- You must be the family owner to remove members
- Contact your family owner if you need to remove someone

### "Member not found or has been removed from family"
- The member is no longer in your family
- They may have been removed by the owner
- You cannot access their documents anymore

### "You don't have permission to view this member's documents"
- You are not in the same family as this member
- The member may have been removed
- Contact your family owner

### "Cannot remove yourself from the family"
- You cannot remove your own account
- Contact another family member or support

## Tips & Best Practices

### For Owners
- **Be careful when removing members** - they will immediately lose access
- **Communicate with family members** before removing them
- **Review the confirmation modal** carefully before confirming

### For All Users
- **Use search effectively** - search works across multiple fields
- **Organize with filters** - filter by document type for better organization
- **Check dates** - documents are timestamped for easy chronological review

## Keyboard Shortcuts & Accessibility

- **Tab**: Navigate between elements
- **Enter**: Click on focused element
- **Esc**: Close modals
- **Arrow Keys**: Navigate through lists

## Mobile Support

All features work on mobile devices:
- Touch-friendly buttons
- Responsive layout
- Swipe-friendly cards
- Mobile-optimized search and filters

## Privacy & Security

### What's Protected
- Only family members can view each other's documents
- Removed members immediately lose access
- All actions are logged in audit trail
- Emergency tokens are revoked on removal

### What's Logged
- Document access attempts
- Member removal actions
- Failed access attempts
- Search queries (for security monitoring)

## Need Help?

If you encounter issues:
1. Check error messages for guidance
2. Try refreshing the page
3. Verify you're logged in
4. Ensure you're part of a family group
5. Contact support if problems persist

## Feature Status

✅ **Available Now:**
- Remove family members (owner only)
- View family member documents
- Search and filter documents
- Real-time updates
- Audit logging

🚧 **Coming Soon:**
- Emergency mode limited access
- Bulk member operations
- Transfer ownership
- Email notifications
- Activity feed
