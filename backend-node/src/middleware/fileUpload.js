/**
 * File Upload Middleware
 * Handles file uploads for analysis by CyberGuard AI
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Validate file types
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedFileTypes = {
    // Images
    'image/jpeg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    
    // Documents
    'application/pdf': true,
    'text/plain': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    
    // Logs and data
    'text/csv': true,
    'application/json': true,
    'application/xml': true,
    'text/xml': true,
    
    // Code files
    'text/javascript': true,
    'text/html': true,
    'text/css': true,
    'text/x-python': true,
    'text/x-java': true,
    'application/x-sh': true,
  };
  
  // Check if file type is allowed
  if (allowedFileTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported. Please upload images, PDFs, text files, or code files.`), false);
  }
};

// Size limits for different file types (in bytes)
const getSizeLimit = (mimetype) => {
  // Default to 5MB
  const defaultLimit = 5 * 1024 * 1024;
  
  // Specific limits based on file type
  const limits = {
    // Images: 2MB
    'image/jpeg': 2 * 1024 * 1024,
    'image/png': 2 * 1024 * 1024,
    'image/gif': 2 * 1024 * 1024,
    'image/webp': 2 * 1024 * 1024,
    
    // Documents: 10MB
    'application/pdf': 10 * 1024 * 1024,
    'application/msword': 10 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024,
    
    // Log files and code: 1MB
    'text/plain': 1 * 1024 * 1024,
    'text/javascript': 1 * 1024 * 1024,
    'text/x-python': 1 * 1024 * 1024,
    'text/html': 1 * 1024 * 1024,
    'text/css': 1 * 1024 * 1024,
  };
  
  return limits[mimetype] || defaultLimit;
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Max 10MB, but will be further limited by file type
  }
});

// Create a wrapper to handle file size limits based on type
const fileUploadMiddleware = (req, res, next) => {
  const uploadHandler = upload.single('file');
  
  uploadHandler(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Please upload a smaller file.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({ error: err.message });
    }
    
    // Additional validation based on file type
    if (req.file) {
      const sizeLimit = getSizeLimit(req.file.mimetype);
      if (req.file.size > sizeLimit) {
        // Remove file if it's too large
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: `File too large. ${req.file.mimetype} files must be less than ${Math.round(sizeLimit / (1024 * 1024))}MB.` 
        });
      }
    }
    
    next();
  });
};

// Clean up temporary files older than 1 hour
const cleanupTempFiles = () => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads directory:', err);
      return;
    }
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error stating file ${file}:`, err);
          return;
        }
        
        if (stats.isFile() && stats.mtimeMs < oneHourAgo) {
          fs.unlink(filePath, err => {
            if (err) {
              console.error(`Error deleting file ${file}:`, err);
            } else {
              console.log(`Deleted old upload: ${file}`);
            }
          });
        }
      });
    });
  });
};

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

module.exports = {
  fileUploadMiddleware,
  uploadDir
};
