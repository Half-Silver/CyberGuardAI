/**
 * VirusTotal API integration for file and URL security scanning
 */

const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

// API key from environment variables
const API_KEY = process.env.VIRUSTOTAL_API_KEY;

// VirusTotal API base URL
const VIRUSTOTAL_BASE_URL = 'https://www.virustotal.com/api/v3';

/**
 * Calculate file hash (SHA-256)
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - SHA-256 hash of the file
 */
const calculateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', (err) => reject(err));
    
    stream.on('data', (chunk) => hash.update(chunk));
    
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

/**
 * Upload a file to VirusTotal for scanning
 * @param {string} filePath - Path to the file to scan
 * @returns {Promise<object>} - Scan results
 */
const scanFile = async (filePath) => {
  try {
    if (!API_KEY) {
      console.warn('VirusTotal API key not found in environment variables');
      return { error: 'VirusTotal API key not configured', useFallback: true };
    }
    
    // First, check if file has already been scanned using its hash
    const fileHash = await calculateFileHash(filePath);
    
    try {
      // Check if file is already known to VirusTotal
      const hashResponse = await axios.get(`${VIRUSTOTAL_BASE_URL}/files/${fileHash}`, {
        headers: {
          'x-apikey': API_KEY
        }
      });
      
      if (hashResponse.status === 200) {
        console.log('File found in VirusTotal database by hash');
        return processReport(hashResponse.data);
      }
    } catch (hashError) {
      // File not found by hash, continue to file upload
      console.log('File not found in VirusTotal by hash, uploading...');
    }
    
    // File hasn't been analyzed before, upload it
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    
    const uploadResponse = await axios.post(`${VIRUSTOTAL_BASE_URL}/files`, formData, {
      headers: {
        'x-apikey': API_KEY,
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (uploadResponse.status !== 200) {
      throw new Error('Failed to upload file to VirusTotal');
    }
    
    // Get analysis ID from upload response
    const analysisId = uploadResponse.data.data.id;
    
    // Check analysis status until it's complete or timeout
    let analysisResponse;
    let attempts = 0;
    const maxAttempts = 10; // Maximum polling attempts
    
    while (attempts < maxAttempts) {
      analysisResponse = await axios.get(`${VIRUSTOTAL_BASE_URL}/analyses/${analysisId}`, {
        headers: {
          'x-apikey': API_KEY
        }
      });
      
      const status = analysisResponse.data.data.attributes.status;
      
      if (status === 'completed') {
        break;
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return { 
        error: 'VirusTotal analysis timed out', 
        useFallback: true,
        message: 'The file is being analyzed by VirusTotal, but results are not yet available. Using AI analysis as fallback.' 
      };
    }
    
    // Process and return scanning results
    return processReport(analysisResponse.data);
    
  } catch (error) {
    console.error('VirusTotal scan error:', error.message);
    return { 
      error: `VirusTotal scan failed: ${error.message}`, 
      useFallback: true 
    };
  }
};

/**
 * Scan a URL for threats
 * @param {string} url - URL to scan
 * @returns {Promise<object>} - Scan results
 */
const scanUrl = async (url) => {
  try {
    if (!API_KEY) {
      console.warn('VirusTotal API key not found in environment variables');
      return { error: 'VirusTotal API key not configured', useFallback: true };
    }
    
    // Submit URL for analysis
    const submitResponse = await axios.post(
      `${VIRUSTOTAL_BASE_URL}/urls`, 
      new URLSearchParams({ url }), 
      {
        headers: {
          'x-apikey': API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (submitResponse.status !== 200) {
      throw new Error('Failed to submit URL to VirusTotal');
    }
    
    // Get URL ID
    const urlId = submitResponse.data.data.id;
    
    // Check analysis status
    const analysisResponse = await axios.get(`${VIRUSTOTAL_BASE_URL}/analyses/${urlId}`, {
      headers: {
        'x-apikey': API_KEY
      }
    });
    
    // Process and return results
    return processReport(analysisResponse.data);
    
  } catch (error) {
    console.error('VirusTotal URL scan error:', error.message);
    return { 
      error: `VirusTotal URL scan failed: ${error.message}`, 
      useFallback: true 
    };
  }
};

/**
 * Process VirusTotal analysis report
 * @param {object} report - VirusTotal API response
 * @returns {object} - Processed results
 */
const processReport = (report) => {
  try {
    const attributes = report.data.attributes;
    const stats = attributes.stats || {};
    
    // Count positive detections
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const totalEngines = Object.values(stats).reduce((a, b) => a + b, 0);
    
    // Determine threat level
    let threatLevel;
    if (malicious > 5 || (malicious > 0 && malicious + suspicious > 10)) {
      threatLevel = 'high';
    } else if (malicious > 0 || suspicious > 3) {
      threatLevel = 'medium';
    } else {
      threatLevel = 'low';
    }
    
    // Build summary
    const summary = {
      threatLevel,
      detections: {
        malicious,
        suspicious,
        harmless: stats.harmless || 0,
        undetected: stats.undetected || 0,
        totalEngines
      },
      analysisDate: attributes.date || new Date().toISOString(),
      source: 'VirusTotal'
    };
    
    return summary;
    
  } catch (error) {
    console.error('Error processing VirusTotal report:', error);
    return { 
      error: 'Failed to process VirusTotal results', 
      useFallback: true 
    };
  }
};

module.exports = {
  scanFile,
  scanUrl
};
