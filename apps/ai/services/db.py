from __future__ import annotations

import os
from typing import Optional
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

_client: Optional[MongoClient] = None
_db: Optional[Database] = None


def get_db() -> Database:
    global _client, _db
    if _db is not None:
        return _db
    uri = os.getenv("MONGODB_URI")
    name = os.getenv("MONGODB_DB", "medilocker")
    if not uri:
        raise RuntimeError("MONGODB_URI not set for AI service")
    
    # Configure MongoDB client with SSL settings for MongoDB Atlas
    # tlsAllowInvalidCertificates is used for development to bypass SSL verification issues
    # In production, ensure proper SSL certificates are configured
    try:
        print(f"[MongoDB] Connecting to database: {name}...")
        _client = MongoClient(
            uri,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=45000,
            tlsAllowInvalidCertificates=True,  # For development - bypasses SSL cert verification
        )
        # Test connection
        _client.admin.command('ping')
        print(f"✅ MongoDB connected successfully to {name}")
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        raise
    
    _db = _client.get_database(name)
    return _db


def collection(name: str) -> Collection:
    return get_db().get_collection(name)
