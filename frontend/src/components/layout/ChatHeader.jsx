import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiMenu, 
  FiShield, 
  FiUser, 
  FiLogOut, 
  FiWifi, 
  FiWifiOff,
  FiChevronDown,
  FiLock,
  FiSettings,
  FiHelpCircle
} from 'react-icons/fi';

const ChatHeader = ({ 
  selectedModel, 
  onModelChange, 
  threatLevel,
  isConnected,
  onToggleSidebar,
  availableModels
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  // Get current model display name
  const getCurrentModelName = () => {
    const model = availableModels?.find(m => m.id === selectedModel);
    return model ? model.name : 'AI Model';
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get threat level class
  const getThreatLevelClass = () => {
    if (!threatLevel) return '';
    
    switch(threatLevel.toUpperCase()) {
      case 'HIGH':
        return 'bg-threat-high';
      case 'MEDIUM':
        return 'bg-threat-medium';
      case 'LOW':
        return 'bg-threat-low';
      default:
        return '';
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-cyber-darker border-b border-secondary-800 shadow-cyber">
      <div className="px-4 py-2 flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center">
          <button 
            onClick={onToggleSidebar}
            className="mr-3 p-1 rounded-full hover:bg-secondary-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <FiMenu size={20} className="text-secondary-400" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-cyber-blue to-cyber-purple p-1.5 rounded-lg shadow-cyber">
              <FiShield size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyber-blue to-cyber-purple">
              CyberGuard AI
            </span>
          </div>
        </div>
        
        {/* Center section - Removed connection status */}
        
        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Threat level indicator */}
          {threatLevel && (
            <div className="flex items-center">
              <div className={`h-2.5 w-2.5 rounded-full ${getThreatLevelClass()} mr-1.5`}></div>
              <span className="text-xs text-secondary-400 font-medium">
                {threatLevel.charAt(0).toUpperCase() + threatLevel.slice(1).toLowerCase()} Threat
              </span>
            </div>
          )}
          

          
          {/* User account */}
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-cyber-purple/20 text-cyber-purple hover:bg-cyber-purple/30 transition-colors"
            >
              <span className="font-medium">{user?.fullname?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
            </button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1 py-1 bg-secondary-800 border border-secondary-700 rounded-md shadow-cyber z-10 min-w-[200px]">
                <div className="px-4 py-2 border-b border-secondary-700">
                  <p className="text-sm font-medium text-white">{user?.fullname}</p>
                  <p className="text-xs text-secondary-400">{user?.email}</p>
                </div>
                
                <button className="w-full flex items-center px-4 py-2 text-sm text-secondary-300 hover:bg-secondary-700 transition-colors">
                  <FiUser size={14} className="mr-2" />
                  <span>Profile</span>
                </button>
                
                <button className="w-full flex items-center px-4 py-2 text-sm text-secondary-300 hover:bg-secondary-700 transition-colors">
                  <FiSettings size={14} className="mr-2" />
                  <span>Settings</span>
                </button>
                
                <button className="w-full flex items-center px-4 py-2 text-sm text-secondary-300 hover:bg-secondary-700 transition-colors">
                  <FiHelpCircle size={14} className="mr-2" />
                  <span>Help & Support</span>
                </button>
                
                <div className="border-t border-secondary-700 mt-1"></div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-cyber-red hover:bg-secondary-700 transition-colors"
                >
                  <FiLogOut size={14} className="mr-2" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
