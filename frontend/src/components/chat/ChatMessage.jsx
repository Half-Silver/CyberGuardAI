import React from 'react';
import { FiShield } from 'react-icons/fi';

// Simple loading dots with Tailwind animation
const LoadingDots = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const ChatMessage = ({ 
  role, 
  content = '', 
  threatLevel, 
  isTyping = false,
}) => {
  const isAI = role === 'assistant';
  const isUser = role === 'user';
  const isSystem = role === 'system';
  
  // Determine message type and styling
  const messageClasses = [
    'relative max-w-[85%] md:max-w-[75%] lg:max-w-[65%] xl:max-w-[55%]',
    'rounded-2xl px-4 py-2 text-sm md:text-base',
    isAI ? 'bg-blue-600 text-white rounded-tl-none' : '',
    isUser ? 'bg-gray-200 text-gray-900 rounded-tr-none ml-auto' : '',
    isSystem ? 'bg-yellow-100 text-yellow-900 rounded-lg mx-auto max-w-full text-center' : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {isAI && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <FiShield className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
      
      <div 
        className={messageClasses}
        style={{
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
        }}
      >
        {isTyping && !content ? (
          <div className="flex items-center py-1 px-2">
            <LoadingDots />
            <span className="ml-2 text-sm text-white/80">AI is thinking...</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">
            {content}
          </div>
        )}
        
        {threatLevel && (
          <div className="absolute -bottom-2 right-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 ml-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <FiShield className="w-4 h-4 text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
