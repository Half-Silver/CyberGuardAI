#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - Configuration Settings
This module handles configuration and environment variables for the CyberGuard AI application.
"""

import os
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(dotenv_path)

# API keys and tokens
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
VIRUSTOTAL_API_KEY = os.getenv('VIRUSTOTAL_API_KEY')
HUGGINGFACE_TOKEN = os.getenv('HUGGINGFACE_TOKEN')

# Model configuration
OPENROUTER_MODEL_NAME = os.getenv('OPENROUTER_MODEL_NAME', 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free')
LOCAL_MODEL_NAME = os.getenv('LOCAL_MODEL_NAME', 'meta-llama/Meta-Llama-3.1-8B-Instruct')

# API server settings
API_PORT = int(os.getenv('PORT', 8000))
API_HOST = os.getenv('HOST', '0.0.0.0')

# Email configuration
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USERNAME = os.getenv('SMTP_USERNAME')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
FROM_EMAIL = os.getenv('FROM_EMAIL')
SECURITY_EMAIL = os.getenv('SECURITY_EMAIL', 'Ibmproject208@gmail.com')

# Check if critical environment variables are set
def validate_environment():
    """Validate that essential environment variables are set"""
    warnings = []
    
    if not OPENROUTER_API_KEY:
        warnings.append("OPENROUTER_API_KEY is not set. OpenRouter integration will not work.")
    
    if not VIRUSTOTAL_API_KEY:
        warnings.append("VIRUSTOTAL_API_KEY is not set. VirusTotal integration will not work.")
    
    if not HUGGINGFACE_TOKEN and os.path.exists('src/models/local_model.py'):
        warnings.append("HUGGINGFACE_TOKEN is not set. Access to gated models will be limited.")
    
    for warning in warnings:
        logger.warning(warning)
    
    return len(warnings) == 0
