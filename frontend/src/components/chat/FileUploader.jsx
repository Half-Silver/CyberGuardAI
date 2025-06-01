import { useState } from 'react';
import { FiUpload, FiFile, FiCheck, FiLoader, FiAlertTriangle, FiX, FiImage, FiFileText, FiCode, FiLock } from 'react-icons/fi';
import axios from 'axios';
import { API_BASE_URL } from '../../api/chatService';

const FileUploader = ({ onAnalysisComplete, selectedModel }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [supportedFileTypes, setSupportedFileTypes] = useState([
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // Documents
    'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Logs and data
    'text/csv', 'application/json', 'application/xml', 'text/xml', 
    // Code files
    'text/javascript', 'text/html', 'text/css', 'text/x-python', 'text/x-java', 'application/x-sh'
  ]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (supportedFileTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
        setUploadError(null);
      } else {
        setUploadError(`File type not supported. Please upload images, PDFs, text files, or code files.`);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (supportedFileTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setUploadError(null);
      } else {
        setUploadError(`File type ${droppedFile.type} not supported. Please upload images, PDFs, text files, or code files.`);
      }
    }
  };

  const handleClear = () => {
    setFile(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleAnalysis = async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    
    if (selectedModel) {
      formData.append('model', selectedModel);
    }
    
    // Add flag to create a chat session
    formData.append('createSession', 'true');

    try {
      const response = await axios.post(`${API_BASE_URL}/chat/analyze-file`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (onAnalysisComplete) {
        onAnalysisComplete({
          fileName: response.data.fileName,
          fileType: response.data.fileType,
          fileSize: response.data.fileSize,
          analysis: response.data.analysis,
          threatLevel: response.data.threatLevel,
          session: response.data.session
        });
      }
      
      // Reset after successful upload
      setFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('Error analyzing file:', error);
      setUploadError(error.response?.data?.error || 'Failed to analyze file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return null;
    
    const fileType = file.type;
    
    if (fileType.startsWith('image/')) {
      return <FiImage className="text-cyber-blue h-5 w-5 mr-2" />;
    }
    
    if (fileType === 'application/pdf') {
      return <FiFileText className="text-cyber-red h-5 w-5 mr-2" />;
    }
    
    if (fileType.startsWith('text/')) {
      if (['text/html', 'text/css', 'text/javascript', 'text/x-python', 'text/x-java'].includes(fileType)) {
        return <FiCode className="text-cyber-purple h-5 w-5 mr-2" />;
      }
      return <FiFileText className="text-cyber-teal h-5 w-5 mr-2" />;
    }
    
    return <FiFile className="text-cyber-yellow h-5 w-5 mr-2" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileTypeDescription = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType === 'application/pdf') return 'PDF Document';
    if (mimeType.includes('word')) return 'Word Document';
    if (['text/html', 'text/css', 'text/javascript', 'text/x-python', 'text/x-java'].includes(mimeType)) return 'Code File';
    if (mimeType === 'text/plain') return 'Text File';
    if (mimeType === 'text/csv') return 'CSV Data';
    if (mimeType === 'application/json') return 'JSON Data';
    if (mimeType.includes('xml')) return 'XML Data';
    return 'Document';
  };

  return (
    <div className="w-full">
      {/* File drop area */}
      {!file && (
        <div
          className="border-2 border-dashed border-secondary-700 rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-cyber-blue/50 hover:bg-secondary-800/50"
          onClick={() => document.getElementById('file-input').click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.txt,.log,.doc,.docx,.js,.py,.html,.css,.json,.xml,.csv"
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-secondary-700 flex items-center justify-center">
              <FiUpload className="h-6 w-6 text-cyber-blue" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-300">
                Drag & drop a file here, or <span className="text-cyber-blue">browse</span>
              </p>
              <p className="text-xs text-secondary-500 mt-1">
                Upload a file for cybersecurity analysis (Images, PDFs, Text, Code)
              </p>
              <div className="flex items-center justify-center mt-3">
                <FiLock className="text-cyber-teal mr-1 h-3 w-3" />
                <span className="text-xs text-cyber-teal">Files are analyzed securely and then deleted</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected file */}
      {file && (
        <div className="border border-secondary-700 rounded-lg overflow-hidden">
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center overflow-hidden">
              {getFileIcon()}
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <div className="flex items-center">
                  <span className="text-xs text-secondary-500">{formatFileSize(file.size)}</span>
                  <span className="mx-1.5 text-secondary-600">•</span>
                  <span className="text-xs text-cyber-blue">{getFileTypeDescription(file.type)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {!uploading && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded-full text-secondary-400 hover:bg-secondary-700 hover:text-cyber-red"
                >
                  <FiX className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="relative h-1 bg-secondary-700">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyber-blue to-cyber-purple"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
          
          {uploadError && (
            <div className="p-2 bg-cyber-red/10 border-t border-cyber-red/20 text-xs text-cyber-red flex items-center">
              <FiAlertTriangle className="h-4 w-4 mr-1.5" />
              {uploadError}
            </div>
          )}
          
          <div className="p-3 bg-secondary-800 border-t border-secondary-700 flex justify-end">
            <button
              className={`px-4 py-1.5 text-sm rounded-md flex items-center justify-center transition-colors ${
                uploading
                  ? 'bg-secondary-700 text-secondary-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyber-blue to-cyber-purple text-white hover:shadow-cyber'
              }`}
              onClick={handleAnalysis}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <FiLock className="h-4 w-4 mr-2" />
                  Analyze for Threats
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
