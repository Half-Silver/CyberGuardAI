import { useState, useEffect, useRef } from 'react';
import './TypingEffect.css';

const TypingEffect = ({ fullMessage = '', isStreaming = false, onComplete }) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef(null);
  const cursorRef = useRef(null);
  
  // Get a random delay to simulate natural typing
  const getRandomDelay = (baseDelay = 0) => {
    // Add some randomness to the delay (between -10ms and +30ms)
    return Math.max(10, baseDelay + (Math.random() * 40 - 10));
  };

  // Get delay based on character type with natural variation
  const getCharDelay = (char) => {
    // Longer delay after punctuation and line breaks
    if (char === '\n') return getRandomDelay(150);
    if (/[.,!?;:]$/.test(char)) return getRandomDelay(80);
    if (char === ' ') return getRandomDelay(30);
    return getRandomDelay(20); // Base typing speed
  };

  // Typing effect
  useEffect(() => {
    if (!fullMessage) {
      setDisplayText('');
      return;
    }

    // If we've already displayed the full message, no need to retype
    if (displayText === fullMessage) {
      if (onComplete && isTyping) {
        setIsTyping(false);
        onComplete();
      }
      return;
    }

    setIsTyping(true);
    
    // Reset display text if the message has changed completely
    if (!fullMessage.startsWith(displayText)) {
      setDisplayText('');
      return;
    }

    // Start typing from current position
    let currentIndex = displayText.length;
    let isCancelled = false;

    const typeNextCharacter = () => {
      if (isCancelled || currentIndex >= fullMessage.length) {
        if (!isCancelled && onComplete) {
          setIsTyping(false);
          onComplete();
        }
        return;
      }

      // Get the next character and update display
      const nextChar = fullMessage[currentIndex];
      setDisplayText(prev => prev + nextChar);
      currentIndex++;

      // Schedule next character with variable delay
      const delay = getCharDelay(nextChar);
      timeoutRef.current = setTimeout(typeNextCharacter, delay);
    };

    // Start typing after a small delay
    timeoutRef.current = setTimeout(typeNextCharacter, 50);

    // Cleanup
    return () => {
      isCancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fullMessage]);

  // Cursor blinking effect
  useEffect(() => {
    if (!cursorRef.current) return;
    
    const cursor = cursorRef.current;
    let animationId = null;
    let isMounted = true;
    
    const animate = (timestamp) => {
      if (!cursor || !isMounted) return;
      
      // Smooth sine wave for natural blinking (1 second cycle)
      const opacity = Math.abs(Math.sin(timestamp / 500)) * 0.8 + 0.2;
      cursor.style.opacity = opacity.toString();
      
      if (isStreaming && isMounted) {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    if (isStreaming) {
      cursor.style.opacity = '0.2'; // Initial state
      animationId = requestAnimationFrame(animate);
    } else {
      cursor.style.opacity = '0';
    }
    
    return () => {
      isMounted = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isStreaming]);

  return (
    <span className="typing-effect">
      {displayText}
      <span 
        ref={cursorRef} 
        className={`typing-cursor ${isTyping ? 'typing' : ''}`}
      />
    </span>
  );
};

export default TypingEffect;
