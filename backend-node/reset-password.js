#!/usr/bin/env node

/**
 * Password Reset Utility for CyberGuard AI
 * 
 * This utility allows resetting a user's password in the development environment
 * Usage: node reset-password.js <email> <new_password>
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Get database path from config or use default
const dbPath = path.join(__dirname, 'data/cyberguard.db');

// Ensure the database exists
if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database not found at ${dbPath}`);
  process.exit(1);
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node reset-password.js <email> <new_password>');
  process.exit(1);
}

// Initialize database connection
const db = new sqlite3.Database(dbPath);

// Check if user exists
db.get('SELECT id, email FROM users WHERE email = ?', [email], (err, user) => {
  if (err) {
    console.error('Database error:', err);
    db.close();
    process.exit(1);
  }
  
  if (!user) {
    console.error(`User with email ${email} not found.`);
    console.log('Available users:');
    db.all('SELECT email FROM users', (err, users) => {
      if (err) {
        console.error('Error listing users:', err);
      } else {
        users.forEach(user => console.log(` - ${user.email}`));
      }
      db.close();
      process.exit(1);
    });
    return;
  }
  
  // Hash the new password
  bcrypt.hash(newPassword, 10, (err, hash) => {
    if (err) {
      console.error('Error hashing password:', err);
      db.close();
      process.exit(1);
    }
    
    // Update the user's password
    db.run('UPDATE users SET password = ? WHERE email = ?', [hash, email], function(err) {
      if (err) {
        console.error('Error updating password:', err);
        db.close();
        process.exit(1);
      }
      
      console.log(`Password updated successfully for ${email}`);
      console.log('You can now log in with the new password');
      db.close();
    });
  });
});
