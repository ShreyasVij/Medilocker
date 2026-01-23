import { Collection, ObjectId } from "mongodb";
import { getDbClient } from "@/lib/db";


export interface FamilyInviteDocument {
  _id: ObjectId;
  familyId: ObjectId;
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}


export async function getFamilyInvitesCollection(): Promise<
  Collection<FamilyInviteDocument>
> {
  const db = await getDbClient();
  return db.collection<FamilyInviteDocument>("familyInvites");
}


export async function ensureFamilyInviteIndexes() {
  const invites = await getFamilyInvitesCollection();

  await invites.createIndex(
    { token: 1 },
    { unique: true, name: "idx_family_invite_token_unique" }
  );

  await invites.createIndex(
    { email: 1 },
    { name: "idx_family_invite_email" }
  );

  await invites.createIndex(
    { familyId: 1 },
    { name: "idx_family_invite_family" }
  );

  await invites.createIndex(
    { expiresAt: 1 },
    { name: "idx_family_invite_expiry" }
  );
}
