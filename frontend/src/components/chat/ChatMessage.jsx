import React from 'react';
import { FiShield, FiUser } from 'react-icons/fi';
import ThreatIndicator from './ThreatIndicator';

// Function to convert markdown-style formatting to HTML
const formatMessage = (text) => {
  if (!text) return '';
  
  try {
    // First, clean the text of any problematic characters
    let cleanedText = text
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes
      .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
      .replace(/[\u2013\u2014]/g, '-') // Replace en/em dashes
      .replace(/[\u2026]/g, '...'); // Replace ellipsis
    
    // Replace code blocks
    let formatted = cleanedText.replace(/```([^`]+)```/gs, '<pre><code>$1</code></pre>');
    
    // Replace inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Replace bold text
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Replace italic text
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Replace links (only if they look like proper URLs)
    formatted = formatted.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/g, 
      (match, text, url) => {
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:underline">${text}</a>`;
      }
    );
    
    // Replace line breaks with <br> but not inside code blocks
    const parts = formatted.split(/(<pre><code>.*?<\/code><\/pre>)/gs);
    formatted = parts.map((part, i) => {
      if (i % 2 === 0) {
        // Not inside a code block
        return part.replace(/\n/g, '<br>');
      }
      return part; // Leave code blocks as-is
    }).join('');
    
    return formatted;
  } catch (error) {
    console.error('Error formatting message:', error);
    return text; // Return original text if formatting fails
  }
};

const ChatMessage = ({ 
  role, 
  content, 
  threatLevel, 
  isTyping = false,
  isStreaming = false,
  shouldAnimate = false,
  onAnimationComplete 
}) => {
  const isUser = role === 'user';
  const [displayedContent, setDisplayedContent] = React.useState('');
  const [isAnimating, setIsAnimating] = React.useState(shouldAnimate);
  const animationRef = React.useRef(null);
  const contentRef = React.useRef('');
  
  // Handle content updates for streaming with improved performance
  React.useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      contentRef.current = '';
      return;
    }
    
    // If not streaming, update immediately
    if (!isStreaming) {
      setDisplayedContent(content);
      contentRef.current = content;
      return;
    }
    
    // For streaming, calculate the new content to add
    const currentContent = contentRef.current || '';
    let contentToAdd = '';
    
    // Find the first position where content differs
    let diffIndex = 0;
    while (diffIndex < content.length && diffIndex < currentContent.length && 
           content[diffIndex] === currentContent[diffIndex]) {
      diffIndex++;
    }
    
    // Get the new content to add
    contentToAdd = content.slice(diffIndex);
    
    if (!contentToAdd) return;
    
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // For very small updates, just show them immediately
    if (contentToAdd.length <= 3) {
      setDisplayedContent(content);
      contentRef.current = content;
      return;
    }
    
    // For larger updates, animate them
    let currentIndex = 0;
    const chunkSize = Math.max(1, Math.floor(contentToAdd.length / 50)); // Adjust chunk size based on content length
    
    const animate = () => {
      if (currentIndex < contentToAdd.length) {
        const endIndex = Math.min(currentIndex + chunkSize, contentToAdd.length);
        const chunk = contentToAdd.slice(currentIndex, endIndex);
        
        setDisplayedContent(prev => {
          const newContent = prev + chunk;
          contentRef.current = newContent;
          return newContent;
        });
        
        currentIndex = endIndex;
        
        // Adjust speed based on content length - faster for longer content
        const speed = contentToAdd.length > 100 ? 5 : 10;
        animationRef.current = requestAnimationFrame(() => {
          setTimeout(animate, speed);
        });
      } else {
        animationRef.current = null;
      }
    };
    
    // Start the animation on the next tick to avoid blocking the main thread
    setTimeout(animate, 0);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, isStreaming]);
  
  // Handle animation end
  const handleAnimationEnd = () => {
    if (isAnimating && onAnimationComplete) {
      onAnimationComplete();
      setIsAnimating(false);
    }
  };

  // Show typing indicator if message is empty and we're still typing
  const showTypingIndicator = (isTyping || isStreaming) && (!content || content.length === 0);
  const showContent = !showTypingIndicator && content && content.length > 0;
  
  return (
    <div 
      className={`mb-4 ${isUser ? 'flex justify-end' : 'flex justify-start'} ${
        isAnimating ? 'animate-fade-in' : ''
      }`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 flex items-start ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-lg ${
            isUser 
              ? 'bg-primary-500/20 border border-primary-500/30' 
              : 'bg-secondary-200/20 dark:bg-secondary-800/20 border border-white/10 dark:border-white/5'
          } shadow-lg`}>
            {isUser ? (
              <FiUser className="text-white" />
            ) : (
              <FiShield className="text-white" />
            )}
          </div>
        </div>
        
        <div 
          className={`rounded-2xl py-3 px-4 backdrop-blur-lg shadow-xl transition-all duration-200 ${
            isUser 
              ? 'bg-gradient-to-r from-primary-500/80 to-primary-600/80 text-white rounded-br-none border border-white/10' 
              : 'bg-white/10 dark:bg-black/30 backdrop-blur-lg rounded-bl-none border border-white/5 dark:border-white/5'
          }`}
          style={{
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
          }}
        >
          {showTypingIndicator ? (
            <div className="flex items-center py-1 px-2">
              <div className="flex items-center space-x-1">
                <div className="relative w-2 h-2 bg-white/70 rounded-full">
                  <div className="absolute inset-0 bg-white/90 rounded-full animate-ping" style={{
                    animation: 'typingPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: '0ms'
                  }}></div>
                </div>
                <div className="relative w-2 h-2 bg-white/70 rounded-full">
                  <div className="absolute inset-0 bg-white/90 rounded-full animate-ping" style={{
                    animation: 'typingPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: '200ms'
                  }}></div>
                </div>
                <div className="relative w-2 h-2 bg-white/70 rounded-full">
                  <div className="absolute inset-0 bg-white/90 rounded-full animate-ping" style={{
                    animation: 'typingPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: '400ms'
                  }}></div>
                </div>
              </div>
              <span className="text-xs text-white/80 ml-2 font-medium">
                {isStreaming ? 'AI is thinking...' : 'typing...'}
              </span>
            </div>
          ) : showContent && (
            <>
              <div 
                className="prose dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: formatMessage(displayedContent) }}
              />
              
              {!isUser && threatLevel && (
                <div className="mt-2">
                  <ThreatIndicator 
                    level={threatLevel.level} 
                    details={threatLevel.details} 
                  />
                </div>
              )}
              
              {isStreaming && (
                <div className="mt-1">
                  <div className="w-3 h-3 rounded-full bg-primary-500 dark:bg-primary-400 opacity-75 animate-pulse"></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
