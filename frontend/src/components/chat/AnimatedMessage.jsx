import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <SyntaxHighlighter
      style={atomDark}
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const AnimatedMessage = ({ content, isTyping = false, shouldAnimate = true }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const animationRef = useRef(null);
  const isMounted = useRef(true);

  // Reset animation when content changes
  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedContent(content || '');
      return;
    }
    
    setDisplayedContent('');
    setCurrentIndex(0);
    
    return () => {
      isMounted.current = false;
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [content, shouldAnimate]);

  // Animate text word by word
  useEffect(() => {
    if (!shouldAnimate || !content || currentIndex >= content.length) return;
    
    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setDisplayedContent(prev => prev + content[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }
    }, 10); // Adjust speed here (lower = faster)
    
    return () => clearTimeout(timeout);
  }, [content, currentIndex, shouldAnimate]);

  return (
    <div className={`message-content ${isTyping ? 'typing' : ''}`}>
      <ReactMarkdown
        components={{
          code: CodeBlock,
          a({ node, ...props }) {
            return <a {...props} className="text-cyber-blue hover:underline" target="_blank" rel="noopener noreferrer" />;
          },
          p({ node, ...props }) {
            return <p {...props} className="mb-4" />;
          },
          ul({ node, ...props }) {
            return <ul {...props} className="list-disc pl-6 mb-4" />;
          },
          ol({ node, ...props }) {
            return <ol {...props} className="list-decimal pl-6 mb-4" />;
          },
          li({ node, ...props }) {
            return <li {...props} className="mb-1" />;
          },
          h1({ node, ...props }) {
            return <h1 {...props} className="text-2xl font-bold mb-4 mt-6" />;
          },
          h2({ node, ...props }) {
            return <h2 {...props} className="text-xl font-bold mb-3 mt-5" />;
          },
          h3({ node, ...props }) {
            return <h3 {...props} className="text-lg font-bold mb-2 mt-4" />;
          },
          table({ node, ...props }) {
            return <table {...props} className="border-collapse border border-secondary-700 mb-4" />;
          },
          th({ node, ...props }) {
            return <th {...props} className="border border-secondary-700 px-4 py-2 bg-secondary-800" />;
          },
          td({ node, ...props }) {
            return <td {...props} className="border border-secondary-700 px-4 py-2" />;
          },
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {isTyping && (
        <span className="typing-cursor">
          ▋
        </span>
      )}
    </div>
  );
};

export default AnimatedMessage;
