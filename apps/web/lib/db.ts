// MongoDB client bootstrap for server-side operations.
import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDbClient(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'medilocker';
  if (!uri) throw new Error('MONGODB_URI is not set');

  // If client exists but topology is closed, reset
  if (client) {
    try {
      // Test if connection is still alive by pinging the server
      await client.db('admin').command({ ping: 1 });
    } catch (e) {
      console.log('MongoDB topology closed, resetting connection...');
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing stale client:', closeError);
      }
      client = null;
      db = null;
    }
  }

  // Return existing database if connected
  if (db) return db;

  // Create new client connection
  if (!client) {
    const options = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    };
    
    try {
      client = new MongoClient(uri, options);
      await client.connect();
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      client = null;
      db = null;
      throw error;
    }
  }
  
  db = client.db(dbName);
  return db;
}

export async function getCollection<T>(name: string): Promise<Collection<T>> {
  const database = await getDbClient();
  return database.collection<T>(name);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});
