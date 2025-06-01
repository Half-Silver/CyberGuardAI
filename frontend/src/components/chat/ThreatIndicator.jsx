import { useState } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiX } from 'react-icons/fi';

const ThreatIndicator = ({ level, details, onClose, isModal = false }) => {
  const [isDetailsVisible, setIsDetailsVisible] = useState(isModal);
  
  // Set threat level styling
  const getStyles = () => {
    switch (level) {
      case 'high':
        return {
          bgColor: 'bg-threat-high/20',
          textColor: 'text-threat-high',
          borderColor: 'border-threat-high/30',
          icon: <FiAlertCircle className="text-threat-high" size={isModal ? 36 : 16} />,
          label: 'High Threat Detected'
        };
      case 'medium':
        return {
          bgColor: 'bg-threat-medium/20',
          textColor: 'text-threat-medium',
          borderColor: 'border-threat-medium/30',
          icon: <FiAlertTriangle className="text-threat-medium" size={isModal ? 36 : 16} />,
          label: 'Medium Threat Detected'
        };
      case 'low':
        return {
          bgColor: 'bg-threat-low/20',
          textColor: 'text-threat-low',
          borderColor: 'border-threat-low/30',
          icon: <FiAlertTriangle className="text-threat-low" size={isModal ? 36 : 16} />,
          label: 'Low Threat Detected'
        };
      default:
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: <FiCheckCircle className="text-green-600" size={isModal ? 36 : 16} />,
          label: 'No Threats Detected'
        };
    }
  };
  
  const { bgColor, textColor, borderColor, icon, label } = getStyles();
  
  // Handle toggling details visibility
  const toggleDetails = () => {
    if (!isModal) {
      setIsDetailsVisible(!isDetailsVisible);
    }
  };
  
  // For small inline indicator
  if (!isModal) {
    return (
      <div className="inline-block">
        <div 
          className={`threat-indicator ${bgColor} ${textColor} ${borderColor} cursor-pointer`}
          onClick={toggleDetails}
        >
          <span className="mr-1">{icon}</span>
          <span>{label}</span>
        </div>
        
        {isDetailsVisible && details && (
          <div className={`mt-2 p-3 rounded-md border text-sm ${bgColor} ${borderColor}`}>
            <div className="font-medium mb-1">Threat Details:</div>
            <ul className="list-disc list-inside">
              {Array.isArray(details) ? (
                details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))
              ) : (
                <li>{details}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }
  
  // For modal version (high threats)
  return (
    <div className={`max-w-md p-6 rounded-lg shadow-lg ${bgColor} border ${borderColor}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          {icon}
          <h3 className={`text-xl font-bold ml-2 ${textColor}`}>{label}</h3>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            <FiX size={20} className="text-red-600 dark:text-red-400" />
          </button>
        )}
      </div>
      
      <div className="mt-4">
        <p className="font-medium mb-2">Security Alert Details:</p>
        <div className="p-3 bg-white/50 dark:bg-secondary-800/50 rounded-md border border-red-200 dark:border-red-800/50">
          <ul className="list-disc list-inside">
            {Array.isArray(details) ? (
              details.map((detail, index) => (
                <li key={index} className="mb-1">{detail}</li>
              ))
            ) : (
              <li>{details}</li>
            )}
          </ul>
        </div>
        
        <div className="mt-4 text-sm">
          <p className="mb-1">Recommended actions:</p>
          <ul className="list-disc list-inside">
            <li>Do not share sensitive information</li>
            <li>Verify the source's authenticity</li>
            <li>Use caution when following any links</li>
            <li>Consider consulting a cybersecurity professional</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ThreatIndicator;
