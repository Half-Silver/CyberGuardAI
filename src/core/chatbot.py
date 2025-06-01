#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - Core Chatbot
Base implementation for the cybersecurity chatbot.
"""

import logging
from typing import Dict, List, Optional, Union
import os
import sys

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.threat_detector import ThreatDetector

# Configure logging
logger = logging.getLogger(__name__)

class BaseChatbot:
    """
    Base class for the CyberGuard AI chatbot.
    Provides common functionality for all chatbot implementations.
    """
    
    def __init__(
        self,
        enable_threat_detection: bool = True,
        virustotal_api_key: Optional[str] = None,
        verbose: bool = False
    ):
        """
        Initialize the base chatbot.
        
        Args:
            enable_threat_detection: Whether to enable threat detection
            virustotal_api_key: VirusTotal API key (default: from env)
            verbose: Whether to enable verbose logging
        """
        self.verbose = verbose
        self.enable_threat_detection = enable_threat_detection
        self.history = []
        
        # Initialize the threat detector if enabled
        self.threat_detector = None
        if self.enable_threat_detection:
            try:
                self.threat_detector = ThreatDetector(virustotal_api_key=virustotal_api_key)
                logger.info("Threat detector initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing threat detector: {e}")
                self.enable_threat_detection = False
    
    def analyze_security_threats(self, message: str) -> Dict:
        """
        Analyze a message for security threats.
        
        Args:
            message: The message to analyze
            
        Returns:
            Dictionary with threat analysis results
        """
        if not self.enable_threat_detection or not self.threat_detector:
            return {"risk_level": "none", "threat_categories": []}
            
        try:
            return self.threat_detector.analyze_message(message)
        except Exception as e:
            logger.error(f"Error analyzing security threats: {e}")
            return {"risk_level": "none", "threat_categories": []}
    
    def clear_history(self) -> None:
        """Clear the conversation history."""
        self.history = []
        logger.info("Conversation history cleared")
    
    def _create_cybersecurity_prompt(self, user_input: str, security_recommendations: List[str] = None) -> str:
        """
        Create a cybersecurity-focused prompt for the model.
        
        Args:
            user_input: The user's input message
            security_recommendations: Optional security recommendations from threat analysis
            
        Returns:
            A formatted prompt with cybersecurity context
        """
        system_prompt = """You are CyberGuard AI, a specialized cybersecurity assistant. Your purpose is to:
1. Detect potential cybersecurity threats in user inputs
2. Educate users about scams, phishing, malware, and best security practices
3. Provide accurate, actionable advice for cybersecurity incidents
4. Be vigilant about potential security risks in user scenarios

Always prioritize user security and privacy in your responses. Be detailed and factual when providing cybersecurity information. If there's a potential security threat, clearly explain why it's concerning and what steps the user should take."""

        # Add security recommendations if available
        if security_recommendations:
            security_info = "\n".join(security_recommendations)
            system_prompt += f"\n\nIMPORTANT SECURITY ALERT: The user's message contains potential security threats:\n{security_info}\n\nMake sure to address these concerns in your response."

        return system_prompt
    
    def _create_chat_messages(self, user_input: str, security_recommendations: List[str] = None) -> List[Dict[str, str]]:
        """
        Create a list of chat messages for the model.
        
        Args:
            user_input: The user's input message
            security_recommendations: Optional security recommendations from threat analysis
            
        Returns:
            List of chat messages in the format [{"role": "...", "content": "..."}]
        """
        # Get the system prompt
        system_prompt = self._create_cybersecurity_prompt(user_input, security_recommendations)
        
        # Create the chat messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ]
        
        # Add conversation history if available (limiting to last 5 exchanges)
        if self.history:
            # Extract the most recent history (limited to 5 exchanges)
            recent_history = self.history[-5:]
            
            # Insert history before the user's current message
            messages = [{"role": "system", "content": system_prompt}] + recent_history + [{"role": "user", "content": user_input}]
        
        return messages
    
    def chat(self, user_input: str) -> str:
        """
        Process a user message and generate a response.
        This is a placeholder that should be implemented by subclasses.
        
        Args:
            user_input: The user's input message
            
        Returns:
            The chatbot's response
        """
        raise NotImplementedError("Subclasses must implement this method")
