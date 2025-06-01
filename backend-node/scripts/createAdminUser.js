const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../src/config/config');

// Connect to the database
const db = new sqlite3.Database(config.dbPath);

// Admin user details
const adminUser = {
  email: 'admin@example.com',
  fullname: 'Admin User',
  password: 'Admin@1234' // In a real app, this would be set via environment variable
};

// Create the admin user
async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminUser.password, saltRounds);
    
    // Insert the user
    db.run(
      'INSERT OR IGNORE INTO users (email, fullname, password) VALUES (?, ?, ?)',
      [adminUser.email, adminUser.fullname, hashedPassword],
      function(err) {
        if (err) {
          console.error('Error creating admin user:', err);
          return;
        }
        
        if (this.changes > 0) {
          console.log('Admin user created successfully!');
          console.log('Email:', adminUser.email);
          console.log('Password:', adminUser.password);
        } else {
          console.log('Admin user already exists');
        }
        
        // Close the database connection
        db.close();
      }
    );
  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

// Run the script
createAdminUser();
