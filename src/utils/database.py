#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - Database Module
This module handles database connections and operations for user authentication.
"""

import os
import logging
import sqlite3
import hashlib
import secrets
import time
from datetime import datetime, timedelta
import json
from typing import Dict, List, Optional, Tuple, Any
import sys

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Database file path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'cyberguard.db')

class Database:
    """
    SQLite database handler for CyberGuard AI.
    Implements secure user authentication and session management.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize the database connection"""
        self.db_path = db_path or DB_PATH
        
        # Create data directory if it doesn't exist
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Initialize the database
        self._init_db()
    
    def _init_db(self) -> None:
        """Initialize the database schema if it doesn't exist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    fullname TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            ''')
            
            # Create sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            conn.commit()
            conn.close()
            logger.info("Database initialized successfully")
        
        except sqlite3.Error as e:
            logger.error(f"Database initialization error: {e}")
            raise
    
    def _hash_password(self, password: str, salt: Optional[str] = None) -> Tuple[str, str]:
        """
        Hash a password using PBKDF2 with SHA-256
        
        Args:
            password: Plain text password
            salt: Optional salt, if not provided, a new one will be generated
            
        Returns:
            Tuple of (password_hash, salt)
        """
        if not salt:
            salt = secrets.token_hex(16)
        
        # Use PBKDF2 with 100,000 iterations (good balance of security and performance)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        
        return key, salt
    
    def create_user(self, email: str, fullname: str, password: str) -> bool:
        """
        Create a new user
        
        Args:
            email: User's email
            fullname: User's full name
            password: User's plain text password
            
        Returns:
            Success status
        """
        try:
            # Hash the password
            password_hash, salt = self._hash_password(password)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                logger.warning(f"Attempted to create duplicate user: {email}")
                return False
            
            # Insert the new user
            cursor.execute(
                "INSERT INTO users (email, fullname, password_hash, salt) VALUES (?, ?, ?, ?)",
                (email, fullname, password_hash, salt)
            )
            
            conn.commit()
            conn.close()
            
            logger.info(f"User created successfully: {email}")
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Database error creating user: {e}")
            return False
    
    def verify_user(self, email: str, password: str) -> Optional[dict]:
        """
        Verify a user's credentials
        
        Args:
            email: User's email
            password: User's plain text password
            
        Returns:
            User data if valid, None otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get user data
            cursor.execute(
                "SELECT id, email, fullname, password_hash, salt FROM users WHERE email = ?", 
                (email,)
            )
            user = cursor.fetchone()
            
            if not user:
                conn.close()
                return None
            
            user_id, email, fullname, stored_hash, salt = user
            
            # Verify password
            input_hash, _ = self._hash_password(password, salt)
            
            if input_hash != stored_hash:
                conn.close()
                return None
            
            # Update last login
            cursor.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
                (user_id,)
            )
            
            conn.commit()
            conn.close()
            
            return {
                "id": user_id,
                "email": email,
                "fullname": fullname
            }
            
        except sqlite3.Error as e:
            logger.error(f"Database error verifying user: {e}")
            return None
    
    def create_session(self, user_id: int, expires_in: int = 86400) -> Optional[Dict[str, Any]]:
        """
        Create a new session token for a user
        
        Args:
            user_id: User's ID
            expires_in: Session lifetime in seconds (default: 24 hours)
            
        Returns:
            Session data if successful, None otherwise
        """
        try:
            # Generate a secure token
            token = secrets.token_hex(32)
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Insert new session
            cursor.execute(
                "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user_id, token, expires_at)
            )
            
            # Get user info
            cursor.execute("SELECT email, fullname FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                conn.rollback()
                conn.close()
                return None
            
            email, fullname = user
            
            conn.commit()
            conn.close()
            
            return {
                "user_id": user_id,
                "email": email,
                "fullname": fullname,
                "token": token,
                "expires": expires_at.isoformat()
            }
            
        except sqlite3.Error as e:
            logger.error(f"Database error creating session: {e}")
            return None
    
    def verify_session(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verify a session token
        
        Args:
            token: Session token
            
        Returns:
            Session data if valid, None otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get session data
            cursor.execute(
                """
                SELECT s.id, s.user_id, s.expires_at, u.email, u.fullname
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
                """, 
                (token,)
            )
            
            session = cursor.fetchone()
            conn.close()
            
            if not session:
                return None
            
            session_id, user_id, expires_at, email, fullname = session
            
            # Check if session is expired
            if datetime.fromisoformat(expires_at) < datetime.now():
                self._delete_session(token)
                return None
            
            return {
                "session_id": session_id,
                "user_id": user_id,
                "email": email,
                "fullname": fullname,
                "expires": expires_at
            }
            
        except sqlite3.Error as e:
            logger.error(f"Database error verifying session: {e}")
            return None
    
    def _delete_session(self, token: str) -> bool:
        """
        Delete a session
        
        Args:
            token: Session token
            
        Returns:
            Success status
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
            
            conn.commit()
            conn.close()
            
            return True
            
        except sqlite3.Error as e:
            logger.error(f"Database error deleting session: {e}")
            return False
    
    def logout(self, token: str) -> bool:
        """
        Log out a user by invalidating their session
        
        Args:
            token: Session token
            
        Returns:
            Success status
        """
        return self._delete_session(token)
    
    # Cleanup expired sessions periodically
    def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions
        
        Returns:
            Number of sessions removed
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP")
            removed = cursor.rowcount
            
            conn.commit()
            conn.close()
            
            return removed
            
        except sqlite3.Error as e:
            logger.error(f"Database error cleaning up sessions: {e}")
            return 0

# Create a singleton instance
db = Database()
