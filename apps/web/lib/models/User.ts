import { Collection } from "mongodb";
import { getDbClient } from "@/lib/db";
import { UserDocument } from "@db/users"; 


export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDbClient();
  return db.collection<UserDocument>("users");
}
