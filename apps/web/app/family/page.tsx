import { getIdentity } from "@/lib/auth";
import { getUsersCollection } from "@/lib/models/User";
import { getFamiliesCollection } from "@/lib/Family";
import { ObjectId } from "mongodb";
import Link from "next/link";
import { CreateFamilyButton } from "@/components/CreateFamilyButton";
import FamilyMemberCard from "@/components/FamilyMemberCard";
import DeleteFamilyButton from "@/components/DeleteFamilyButton";

function getRoleBadgeStyles(role: string) {
  if (role === "owner") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "M";
}

export default async function FamilyPage() {
  const { session } = await getIdentity();

  if (!session?.user?.email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h1>
          <p className="text-sm text-gray-600">Please login to view your family.</p>
        </div>
      </div>
    );
  }

  const users = await getUsersCollection();
  const families = await getFamiliesCollection();

  const user = await users.findOne({ email: session.user.email });

  if (!user?.familyId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Family</h1>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center max-w-md mx-auto">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">No Family Group</h2>
              <p className="text-sm text-gray-600 mb-6">
                You are not part of any family group. Create one to start sharing medical records securely with family members.
              </p>
              <CreateFamilyButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const family = await families.findOne({
    _id: new ObjectId(user.familyId)
  });

  // Fetch member details
  const memberIds = family?.members || [];
  const memberDetails = await users.find({
    _id: { $in: memberIds.map((id) => new ObjectId(id.toString())) }
  }).toArray();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold text-gray-900">Family</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border ${getRoleBadgeStyles(user.familyRole || "member")}`}>
              {user.familyRole === "owner" ? "Owner" : "Member"}
            </span>
          </div>
          <div className="h-px bg-gray-200 mt-4"></div>
        </div>

        {/* Family Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Family</h2>
            <p className="mt-1 text-sm text-gray-600">
              {memberDetails.length} {memberDetails.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900">Members</h2>
              {user.familyRole === "owner" && (
                <div className="flex items-center gap-3">
                  <Link href="/family/invite">
                    <button className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200">
                      Invite Member
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {memberDetails.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-600">No members found.</p>
              </div>
            ) : (
              memberDetails.map((member) => {
                const isCurrentUser = member.email === session.user?.email;
                const memberRole = member.familyRole || "member";
                
                return (
                  <FamilyMemberCard
                    key={member._id.toString()}
                    member={{
                      id: member._id.toString(),
                      name: member.name,
                      email: member.email,
                      familyRole: memberRole,
                    }}
                    isCurrentUser={isCurrentUser}
                    isOwner={user.familyRole === "owner"}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Helper Text */}
        {memberDetails.length === 1 && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Invite family members to securely share medical records.
            </p>
          </div>
        )}

        {/* Delete Family Section - Owner Only */}
        {user.familyRole === "owner" && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">Danger Zone</h3>
                <p className="text-xs text-gray-600">
                  Delete this family and remove all members. This action cannot be undone.
                </p>
              </div>
              <DeleteFamilyButton memberCount={memberDetails.length} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
