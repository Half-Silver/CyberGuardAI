/**
 * File Analyzer Utility
 * Extracts text from various file types for security analysis
 */

const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');

/**
 * Extract text from an image file using OCR
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromImage = async (filePath) => {
  try {
    console.log(`Extracting text from image: ${filePath}`);
    const result = await Tesseract.recognize(
      filePath,
      'eng', // English language
      { logger: m => console.log(m) }
    );
    return result.data.text;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error('Failed to extract text from image');
  }
};

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromPDF = async (filePath) => {
  try {
    console.log(`Extracting text from PDF: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from a plain text file
 * @param {string} filePath - Path to text file
 * @returns {Promise<string>} - File contents
 */
const extractTextFromTextFile = async (filePath) => {
  try {
    console.log(`Reading text file: ${filePath}`);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error reading text file:', error);
    throw new Error('Failed to read text file');
  }
};

/**
 * Extract text from any supported file type
 * @param {object} file - File object from multer
 * @returns {Promise<string>} - Extracted text
 */
const extractTextFromFile = async (file) => {
  if (!file) {
    throw new Error('No file provided');
  }

  const filePath = file.path;
  const mimeType = file.mimetype;
  
  try {
    // Image files
    if (mimeType.startsWith('image/')) {
      return await extractTextFromImage(filePath);
    }
    
    // PDF files
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    }
    
    // Text files, code files, etc.
    if (mimeType.startsWith('text/') || 
        mimeType === 'application/json' || 
        mimeType === 'application/xml') {
      return await extractTextFromTextFile(filePath);
    }
    
    // Word documents and other binary formats
    // These would require additional libraries like mammoth.js for .docx
    // For now, just return an error
    throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
    
  } catch (error) {
    console.error(`Error extracting text from ${file.originalname}:`, error);
    throw error;
  }
};

/**
 * Prepare a prompt for AI analysis based on file type and content
 * @param {object} file - File object from multer
 * @param {string} text - Extracted text from file
 * @returns {string} - Prompt for AI model
 */
const prepareSecurityAnalysisPrompt = (file, text) => {
  const fileName = file.originalname;
  const fileType = file.mimetype;
  const fileSize = file.size;
  
  // Truncate text if it's too long (most models have token limits)
  // Typical limits are around 4000-8000 tokens, which is roughly 16K-32K characters
  const maxLength = 15000;
  const truncatedText = text.length > maxLength 
    ? text.substring(0, maxLength) + '... [CONTENT TRUNCATED DUE TO LENGTH]' 
    : text;
  
  return `
You are a cybersecurity expert analyzing a file for potential security threats.

FILE INFORMATION:
- Filename: ${fileName}
- File type: ${fileType}
- File size: ${Math.round(fileSize / 1024)} KB

FILE CONTENT:
${truncatedText}

ANALYSIS INSTRUCTIONS:
1. Analyze the file content for any potential security threats or suspicious patterns
2. Look for indicators of phishing, malware, exploits, or other malicious content
3. Determine a threat level (LOW, MEDIUM, HIGH) based on your analysis
4. Provide specific evidence for your threat assessment
5. Give recommendations for handling the file safely

Please structure your response as follows:
THREAT LEVEL: [LOW/MEDIUM/HIGH]
SUMMARY: [Brief overview of findings]
EVIDENCE: [Specific suspicious elements found]
RECOMMENDATIONS: [Security advice for handling this file]
  `;
};

module.exports = {
  extractTextFromFile,
  prepareSecurityAnalysisPrompt
};
