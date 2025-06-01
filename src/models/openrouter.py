#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - OpenRouter Integration
This module provides integration with the OpenRouter API for accessing advanced AI models.
"""

import logging
import requests
import json
import os
import sys
import uuid
from typing import Dict, List, Optional, Any

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.chatbot import BaseChatbot
from config import settings

# Configure logging
logger = logging.getLogger(__name__)

class OpenRouterCyberGuardBot(BaseChatbot):
    """
    CyberGuard AI implementation that uses the OpenRouter API
    to access advanced language models like Llama 3.1.
    """
    
    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        enable_threat_detection: bool = True,
        virustotal_api_key: Optional[str] = None,
        verbose: bool = False
    ):
        """
        Initialize the OpenRouter chatbot.
        
        Args:
            model_name: Name of the OpenRouter model to use
            api_key: OpenRouter API key
            enable_threat_detection: Whether to enable threat detection
            virustotal_api_key: VirusTotal API key (default: from env)
            verbose: Whether to enable verbose logging
        """
        # Initialize the base chatbot
        super().__init__(
            enable_threat_detection=enable_threat_detection,
            virustotal_api_key=virustotal_api_key,
            verbose=verbose
        )
        
        # Set up OpenRouter integration
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        if not self.api_key:
            logger.error("OpenRouter API key not provided")
            raise ValueError("OpenRouter API key is required")
            
        self.model_name = model_name or settings.OPENROUTER_MODEL_NAME
        logger.info(f"Using OpenRouter model: {self.model_name}")
        
        # Generate a unique ID for this chatbot instance
        self.session_id = str(uuid.uuid4())
    
    def chat(
        self, 
        user_input: str,
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> str:
        """
        Process a user message and generate a response using OpenRouter.
        
        Args:
            user_input: The user's input message
            max_tokens: Maximum number of tokens to generate
            temperature: Temperature for response generation
            
        Returns:
            The chatbot's response
        """
        try:
            # Analyze for security threats
            threat_analysis = self.analyze_security_threats(user_input)
            security_recommendations = []
            
            # Extract security recommendations if threats were found
            if threat_analysis["risk_level"] != "none" and self.threat_detector:
                security_recommendations = self.threat_detector.get_security_recommendations(threat_analysis)
            
            # Create the chat messages
            messages = self._create_chat_messages(user_input, security_recommendations)
            
            # Prepare the OpenRouter API request
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": self.model_name,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            # Make the API request
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                data=json.dumps(data)
            )
            
            # Check for successful response
            if response.status_code == 200:
                result = response.json()
                
                # Extract the assistant's response
                if "choices" in result and len(result["choices"]) > 0:
                    content = result["choices"][0]["message"]["content"]
                    
                    # Add to conversation history
                    self.history.append({"role": "user", "content": user_input})
                    self.history.append({"role": "assistant", "content": content})
                    
                    return content
                else:
                    logger.error(f"Unexpected response format: {result}")
                    return "Error: Unexpected response from the AI service."
            else:
                error_info = response.json() if response.content else {"error": f"Status code: {response.status_code}"}
                logger.error(f"OpenRouter API error: {error_info}")
                return f"Error: Unable to process your request. {error_info.get('error', {}).get('message', 'Unknown error')}"
                
        except Exception as e:
            logger.error(f"Error in OpenRouter chat: {e}")
            return f"Error: An unexpected error occurred: {str(e)}"
