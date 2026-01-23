import { Collection, ObjectId } from "mongodb";
import { getDbClient } from "@/lib/db";


export interface FamilyDocument {
  _id: ObjectId;
  ownerId: ObjectId;
  members: ObjectId[];
  createdAt: Date;
}


export async function getFamiliesCollection(): Promise<
  Collection<FamilyDocument>
> {
  const db = await getDbClient();
  return db.collection<FamilyDocument>("families");
}


export async function ensureFamilyIndexes() {
  const families = await getFamiliesCollection();

  await families.createIndex(
    { ownerId: 1 },
    { name: "idx_family_owner" }
  );

  await families.createIndex(
    { members: 1 },
    { name: "idx_family_members" }
  );
}
