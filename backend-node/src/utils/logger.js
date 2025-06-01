const winston = require('winston');
const path = require('path');

// Determine log level from environment variable or default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'cyberguard-backend' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Write all logs with level `info` and below to `combined.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// If we're not in production, also log to the console with colorization
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
