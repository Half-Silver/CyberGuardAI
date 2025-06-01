const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure the data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(config.dbPath);

// Initialize tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    fullname TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Sessions table
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Chat history table
  db.run(`CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    model TEXT,
    threat_level TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
  
  // Function to add title column if it doesn't exist
  const addTitleColumn = () => {
    console.log('Checking if title column exists in chat_history table...');
    
    // First, try to select from the column to see if it exists
    db.get('SELECT title FROM chat_history LIMIT 1', [], (err) => {
      if (err) {
        // If we get an error, the column doesn't exist, so add it
        if (err.message.includes('no such column: title')) {
          console.log('Adding title column to chat_history table...');
          db.run('ALTER TABLE chat_history ADD COLUMN title TEXT', (alterErr) => {
            if (alterErr) {
              console.error('Error adding title column:', alterErr);
            } else {
              console.log('Successfully added title column to chat_history table');
            }
          });
        } else {
          console.error('Error checking for title column:', err);
        }
      } else {
        console.log('Title column already exists in chat_history table');
      }
    });
  };
  
  // Execute the function
  addTitleColumn();
});

// Database utility functions
const dbUtils = {
  // User management
  createUser: (email, fullname, password) => {
    return new Promise((resolve, reject) => {
      // Check if user already exists
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(false); // User already exists
        
        // Hash password and create user
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) return reject(err);
          
          db.run(
            'INSERT INTO users (email, fullname, password) VALUES (?, ?, ?)',
            [email, fullname, hash],
            function(err) {
              if (err) return reject(err);
              resolve(this.lastID > 0);
            }
          );
        });
      });
    });
  },
  
  verifyUser: (email, password) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return reject(err);
        if (!user) return resolve(null);
        
        bcrypt.compare(password, user.password, (err, match) => {
          if (err) return reject(err);
          if (!match) return resolve(null);
          
          // Return user info (without password)
          const userInfo = {
            id: user.id,
            email: user.email,
            fullname: user.fullname
          };
          
          resolve(userInfo);
        });
      });
    });
  },
  
  // Session management
  createSession: (userId, expiresHours = 24) => {
    return new Promise((resolve, reject) => {
      const token = require('crypto').randomBytes(32).toString('hex');
      const expires = new Date();
      expires.setHours(expires.getHours() + expiresHours);
      
      db.run(
        'INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)',
        [token, userId, expires.toISOString()],
        (err) => {
          if (err) return reject(err);
          
          resolve({
            token,
            expires: expires.toISOString()
          });
        }
      );
    });
  },
  
  verifySession: (token) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT s.*, u.email, u.fullname FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ?`,
        [token],
        (err, session) => {
          if (err) return reject(err);
          if (!session) return resolve(null);
          
          // Check if session is expired
          const expires = new Date(session.expires);
          if (expires < new Date()) {
            // Delete expired session
            db.run('DELETE FROM sessions WHERE token = ?', [token]);
            return resolve(null);
          }
          
          resolve({
            id: session.user_id,
            email: session.email,
            fullname: session.fullname,
            token: session.token
          });
        }
      );
    });
  },
  
  logout: (token) => {
    return new Promise((resolve) => {
      db.run('DELETE FROM sessions WHERE token = ?', [token], () => {
        resolve(true);
      });
    });
  },
  
  // Chat history management
  saveMessage: (userId, sessionId, role, content, model = null, threatLevel = null, title = null) => {
    return new Promise((resolve, reject) => {
      // If this is the first message in the session, set the title
      if (role === 'user' && !title) {
        // Use the first 30 characters of the message as the title
        title = content.length > 30 ? content.substring(0, 30) + '...' : content;
      }
      
      db.run(
        `INSERT INTO chat_history 
         (user_id, session_id, role, content, model, threat_level, title) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, sessionId, role, content, model, threatLevel, title],
        function(err) {
          if (err) return reject(err);
          
          // If this is the first message in the session, update all messages in the session with this title
          if (title && role === 'user') {
            db.run(
              `UPDATE chat_history 
               SET title = ? 
               WHERE session_id = ? AND user_id = ?`,
              [title, sessionId, userId],
              (updateErr) => {
                if (updateErr) {
                  console.error('Error updating session title:', updateErr);
                }
                resolve(this.lastID);
              }
            );
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  },
  
  getHistory: (userId, limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT session_id 
         FROM chat_history 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [userId, limit],
        (err, sessions) => {
          if (err) return reject(err);
          
          if (!sessions || sessions.length === 0) {
            return resolve([]);
          }
          
          const sessionPromises = sessions.map(session => {
            return new Promise((resolve, reject) => {
              db.all(
                `SELECT * FROM chat_history
                 WHERE session_id = ? AND user_id = ?
                 ORDER BY created_at ASC`,
                [session.session_id, userId],
                (err, messages) => {
                  if (err) return reject(err);
                  
                  if (!messages || messages.length === 0) {
                    return resolve(null);
                  }
                  
                  resolve({
                    session_id: session.session_id,
                    messages: messages.map(msg => ({
                      id: msg.id,
                      role: msg.role,
                      content: msg.content,
                      model: msg.model,
                      threat_level: msg.threat_level,
                      timestamp: msg.created_at
                    })),
                    last_updated: messages[messages.length - 1].created_at,
                    created_at: messages[0].created_at
                  });
                }
              );
            });
          });
          
          Promise.all(sessionPromises)
            .then(sessions => {
              // Filter out any null sessions and sort by last_updated
              const validSessions = sessions.filter(s => s !== null);
              validSessions.sort((a, b) => 
                new Date(b.last_updated) - new Date(a.last_updated)
              );
              resolve(validSessions);
            })
            .catch(reject);
        }
      );
    });
  },
  
  getSession: (sessionId, userId = null) => {
    return new Promise((resolve, reject) => {
      const query = userId 
        ? `SELECT * FROM chat_history
           WHERE session_id = ? AND user_id = ?
           ORDER BY created_at ASC`
        : `SELECT * FROM chat_history
           WHERE session_id = ?
           ORDER BY created_at ASC`;
      
      const params = userId ? [sessionId, userId] : [sessionId];
      
      db.all(query, params, (err, messages) => {
        if (err) return reject(err);
        
        if (!messages || messages.length === 0) {
          return resolve(null);
        }
        
        resolve({
          session_id: sessionId,
          messages: messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            model: msg.model,
            threat_level: msg.threat_level,
            timestamp: msg.created_at
          })),
          last_updated: messages[messages.length - 1].created_at,
          created_at: messages[0].created_at
        });
      });
    });
  },
  
  getSessions: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT 
            session_id as id,
            (SELECT title FROM chat_history h2 
             WHERE h2.session_id = h1.session_id 
             AND h2.title IS NOT NULL 
             LIMIT 1) as title,
            (SELECT content FROM chat_history h3 
             WHERE h3.session_id = h1.session_id 
             AND h3.role = 'user' 
             ORDER BY created_at ASC LIMIT 1) as first_message,
            MAX(created_at) as updatedAt
         FROM chat_history h1 
         WHERE user_id = ? 
         GROUP BY session_id 
         ORDER BY MAX(created_at) DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error fetching sessions:', err);
            reject(err);
          } else {
            // If title is null, use the first message as the title
            const sessions = rows.map(row => ({
              ...row,
              title: row.title || (row.first_message ? 
                (row.first_message.length > 30 ? 
                  row.first_message.substring(0, 30) + '...' : 
                  row.first_message) : 
                'New Chat')
            }));
            resolve(sessions);
          }
        }
      );
    });
  },

  updateSessionTitle: (userId, sessionId, title) => {
    return new Promise((resolve) => {
      // First, verify the session exists and belongs to the user
      db.get(
        'SELECT 1 FROM chat_history WHERE session_id = ? AND user_id = ? LIMIT 1',
        [sessionId, userId],
        (err, row) => {
          if (err || !row) {
            console.error('Session not found or not authorized:', { sessionId, userId });
            resolve(false);
            return;
          }
          
          // Update the title for all messages in the session
          db.run(
            `UPDATE chat_history 
             SET title = ? 
             WHERE session_id = ? AND user_id = ?`,
            [title, sessionId, userId],
            function(err) {
              if (err) {
                console.error('Error updating session title:', err);
                resolve(false);
              } else {
                console.log(`Updated title for session ${sessionId} to: ${title} (${this.changes} messages updated)`);
                // Verify the update was successful
                db.get(
                  'SELECT title FROM chat_history WHERE session_id = ? AND user_id = ? LIMIT 1',
                  [sessionId, userId],
                  (err, updatedRow) => {
                    if (err || !updatedRow) {
                      console.error('Failed to verify title update:', err);
                      resolve(false);
                    } else {
                      const success = updatedRow.title === title;
                      if (!success) {
                        console.error('Title verification failed. Expected:', title, 'Got:', updatedRow.title);
                      }
                      resolve(success);
                    }
                  }
                );
              }
            }
          );
        }
      );
    });
  },

  clearSession: (sessionId) => {
    return new Promise((resolve) => {
      resolve(true);
    });
  },
  
  // Get messages for a specific session
  getMessages: (sessionId, userId, limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM chat_history 
         WHERE session_id = ? AND user_id = ?
         ORDER BY created_at ASC
         LIMIT ?`,
        [sessionId, userId, limit],
        (err, messages) => {
          if (err) return reject(err);
          resolve(messages || []);
        }
      );
    });
  }
};

// Add error handlers for database connection
db.on('error', (err) => {
  console.error('Database error:', err);
  // Consider implementing reconnection logic here
});

// Close the database connection when the Node process ends
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = dbUtils;
