import React, { useState, useEffect } from 'react';
import { FiWifi, FiWifiOff, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';

const ConnectionStatus = ({ isConnected, error, onRetry }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  
  // Auto-hide error details after 15 seconds
  useEffect(() => {
    if (showDetails) {
      const timer = setTimeout(() => {
        setShowDetails(false);
      }, 15000);
      
      return () => clearTimeout(timer);
    }
  }, [showDetails]);

  // Display reconnecting status temporarily when retry is clicked
  const handleRetry = () => {
    setReconnecting(true);
    onRetry();
    setTimeout(() => setReconnecting(false), 3000);
  };
  
  if (isConnected) {
    return (
      <div className="flex items-center px-2 py-1 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 rounded-md">
        <FiWifi className="mr-1" /> Connected to server
      </div>
    );
  }

  if (reconnecting) {
    return (
      <div className="flex items-center px-2 py-1 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-md">
        <FiRefreshCw className="mr-1 animate-spin" /> Attempting to connect...
      </div>
    );
  }
  
  return (
    <div className="px-2 py-1">
      <div className="flex items-center text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded-md">
        <FiWifiOff className="mr-1" />
        <span className="mr-2">Not connected to server. Please wait or refresh the page.</span>
        <button 
          onClick={handleRetry}
          className="flex items-center text-primary-600 dark:text-primary-400 hover:underline"
        >
          <FiRefreshCw className="mr-1" size={14} /> Retry Connection
        </button>
        <button 
          onClick={() => setShowDetails(!showDetails)} 
          className="ml-2 text-xs text-secondary-500 hover:underline"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-1 p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded">
          <div className="font-medium flex items-center">
            <FiAlertTriangle className="mr-1" /> Connection troubleshooting:
          </div>
          {error && (
            <div className="mt-1 font-mono break-all text-red-700 dark:text-red-300">{error}</div>
          )}
          <div className="mt-2 text-xs">
            <strong>Try these steps:</strong>
            <ul className="mt-1 list-disc list-inside">
              <li>Make sure the backend server is running on port 8002</li>
              <li>Click the "Retry Connection" button above</li>
              <li>Check your browser console for detailed error messages</li>
              <li>Try refreshing the page</li>
              <li>Ensure both the backend and frontend servers are running</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
