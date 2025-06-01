#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - Command Line Interface
This module provides a command-line interface for interacting with the CyberGuard chatbot.
"""

import os
import sys
import logging
import argparse
from typing import Optional
import time

# Add project root to path
parent_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(parent_dir)

# Import chatbot implementation
from models.openrouter import OpenRouterCyberGuardBot
from config import settings
from config.settings import validate_environment

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def print_banner():
    """Print the CyberGuard AI banner"""
    print("\n" + "=" * 60)
    print(" 🛡️  CyberGuard AI - Cybersecurity Assistant  🛡️")
    print("=" * 60)
    print("\nInitializing...\n")

def print_security_analysis(threat_analysis):
    """Print the security analysis results in a readable format"""
    if threat_analysis["risk_level"] != "none":
        risk_level = threat_analysis["risk_level"].upper()
        
        # Set the color based on risk level
        if risk_level == "HIGH":
            risk_color = "\033[91m"  # Red
        elif risk_level == "MEDIUM":
            risk_color = "\033[93m"  # Yellow
        else:
            risk_color = "\033[94m"  # Blue
            
        reset_color = "\033[0m"
        
        print(f"\n{risk_color}🛡️ Risk level: {risk_level}{reset_color}")
        
        if threat_analysis["threat_categories"]:
            threats = ", ".join(threat_analysis["threat_categories"])
            print(f"🔍 Detected threats: {threats}")
            
        if threat_analysis["indicators"]:
            print("\n🚩 Threat indicators:")
            for indicator in threat_analysis["indicators"]:
                print(f"  - {indicator}")
                
        if threat_analysis["recommendations"]:
            print("\n✅ Security recommendations:")
            for recommendation in threat_analysis["recommendations"]:
                print(f"  - {recommendation}")
        
        print()  # Add a blank line

def interactive_mode(model_name: Optional[str] = None, max_tokens: int = 512, temperature: float = 0.7):
    """Run the chatbot in interactive mode"""
    try:
        # Validate environment variables
        validate_environment()
        
        # Initialize the OpenRouter chatbot
        print(f"Initializing CyberGuard AI with model: {model_name or settings.OPENROUTER_MODEL_NAME}")
        chatbot = OpenRouterCyberGuardBot(
            model_name=model_name,
            enable_threat_detection=True,
            verbose=True
        )
        
        print("\n✅ CyberGuard AI initialized successfully!")
        print("\nEnter your cybersecurity questions or concerns below.")
        print("Type 'exit', 'quit', or 'q' to end the session.\n")
        
        while True:
            # Get user input
            user_input = input("\n🔍 You: ")
            
            # Check for exit command
            if user_input.lower() in ['exit', 'quit', 'q']:
                print("\nExiting CyberGuard AI. Stay secure! 🛡️\n")
                break
                
            if not user_input.strip():
                continue
            
            # Analyze for security threats
            print("\n⏳ Analyzing for security threats...")
            start_time = time.time()
            threat_analysis = chatbot.analyze_security_threats(user_input)
            
            # Display security analysis
            print_security_analysis(threat_analysis)
            
            # Get response from the chatbot
            print("⏳ Getting CyberGuard AI response...")
            response = chatbot.chat(
                user_input=user_input,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            # Calculate and show response time
            response_time = time.time() - start_time
            print(f"⏱️ Response time: {response_time:.2f} seconds\n")
            
            # Display the response
            print("🤖 CyberGuard AI:")
            print(response)
            
    except KeyboardInterrupt:
        print("\n\nProgram interrupted. Exiting...")
    except Exception as e:
        logger.error(f"Error in interactive mode: {e}")
        print(f"\nError: {str(e)}")
        
def main():
    """Main entry point for the CLI"""
    parser = argparse.ArgumentParser(description="CyberGuard AI - Cybersecurity Assistant")
    parser.add_argument("--model", "-m", help="Model name to use", default=None)
    parser.add_argument("--max-tokens", type=int, help="Maximum tokens to generate", default=512)
    parser.add_argument("--temperature", "-t", type=float, help="Temperature for response generation", default=0.7)
    
    args = parser.parse_args()
    
    print_banner()
    interactive_mode(
        model_name=args.model,
        max_tokens=args.max_tokens,
        temperature=args.temperature
    )

if __name__ == "__main__":
    main()
