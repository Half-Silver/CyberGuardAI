import React from 'react';
import { FiShield, FiLock, FiMail, FiDatabase, FiAlertTriangle } from 'react-icons/fi';

const WelcomeScreen = ({ onSuggestionClick }) => {
  // Suggestions for common cybersecurity questions
  const suggestions = [
    {
      icon: <FiShield />,
      title: "Security Check",
      question: "Can you check if this URL is safe to visit?"
    },
    {
      icon: <FiMail />,
      title: "Phishing Detection",
      question: "Is this email legitimate or a phishing attempt?"
    },
    {
      icon: <FiLock />,
      title: "Security Tips",
      question: "What are best practices for creating strong passwords?"
    },
    {
      icon: <FiDatabase />,
      title: "Malware Help",
      question: "I think my computer might be infected. What should I do?"
    },
    {
      icon: <FiAlertTriangle />,
      title: "Threat Intelligence",
      question: "What are the latest cybersecurity threats I should be aware of?"
    },
    {
      icon: <FiLock />,
      title: "Network Security",
      question: "How can I secure my home Wi-Fi network?"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-10">
        <div className="inline-block p-4 bg-primary-100 dark:bg-primary-900 rounded-full mb-4">
          <FiShield className="text-primary-600 dark:text-primary-400 text-4xl" />
        </div>
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-50 mb-2">
          CyberGuard AI
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400 text-lg">
          Your Advanced Cybersecurity Assistant
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="card hover:bg-secondary-100 dark:hover:bg-secondary-700 cursor-pointer transition-colors group"
            onClick={() => onSuggestionClick(suggestion.question)}
          >
            <div className="flex items-start">
              <div className="p-2 mr-3 bg-primary-100 dark:bg-primary-900 rounded-md text-primary-600 dark:text-primary-400">
                {suggestion.icon}
              </div>
              <div>
                <h3 className="font-medium text-secondary-900 dark:text-secondary-50">
                  {suggestion.title}
                </h3>
                <p className="text-sm text-secondary-600 dark:text-secondary-400 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  "{suggestion.question}"
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-secondary-100 dark:bg-secondary-800 rounded-lg p-4 text-sm text-secondary-700 dark:text-secondary-300">
        <p className="mb-2 font-medium">CyberGuard AI is designed to provide cybersecurity assistance. Always verify critical security recommendations with professionals.</p>
        <p className="mb-2">You can ask questions about:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Analyzing potential threats</li>
          <li>Best security practices</li>
          <li>Malware and phishing detection</li>
          <li>Password and authentication security</li>
          <li>Network and device protection</li>
        </ul>
      </div>
    </div>
  );
};

export default WelcomeScreen;
