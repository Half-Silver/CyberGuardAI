#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - Threat Detector
This module handles detection of cybersecurity threats in user inputs.
"""

import re
import logging
from typing import Dict, List, Optional, Union
import requests
from urllib.parse import urlparse
import os
import sys
import json

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

# Configure logging
logger = logging.getLogger(__name__)

class ThreatDetector:
    """
    Detects potential cybersecurity threats in user inputs.
    Identifies phishing attempts, malware indicators, suspicious URLs,
    and other security concerns.
    """
    
    def __init__(self, virustotal_api_key: Optional[str] = None):
        """
        Initialize the threat detector.
        
        Args:
            virustotal_api_key: API key for VirusTotal (optional)
        """
        self.virustotal_api_key = virustotal_api_key or settings.VIRUSTOTAL_API_KEY
        
        # Define patterns for threat detection
        self.patterns = {
            # URLs and domains
            'url': r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+',
            'ip_address': r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
            'suspicious_domain': r'(?:verify|secure|account|login|banking|update)[-.](?:com|net|org|online)',
            
            # Credential and sensitive information patterns
            'password': r'(?i)password\s*[=:]\s*\S+',
            'credit_card': r'\b(?:\d{4}[- ]?){3}\d{4}\b',
            'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
            
            # Malware and phishing indicators
            'executable': r'(?:\.exe|\.bat|\.cmd|\.ps1|\.sh|\.dll|\.scr)$',
            'double_extension': r'\.(?:doc|pdf|txt|jpg|png)\.(?:exe|bat|cmd|ps1|sh|dll|scr)$',
            'suspicious_command': r'(?:powershell|cmd)(?:.exe)?\s+(?:-w|/c|/e|/encoded)',
            
            # Common phishing phrases
            'urgency': r'(?i)(?:urgent|immediate|alert|attention required|important update|verify now)',
            'threat': r'(?i)(?:account (?:suspended|blocked|locked)|unauthorized access|unusual activity)',
        }
        
        # Initialize VirusTotal integration if API key is provided
        self.virustotal_enabled = bool(self.virustotal_api_key)
        if self.virustotal_enabled:
            logger.info("Threat detector initialized successfully")
        else:
            logger.warning("VirusTotal API key not provided, URL scanning disabled")
    
    def scan_url(self, url: str) -> Dict:
        """
        Scan a URL using VirusTotal API.
        
        Args:
            url: URL to scan
            
        Returns:
            Dictionary with scan results
        """
        if not self.virustotal_enabled:
            return {"error": "VirusTotal API key not configured"}
        
        try:
            # Strip any leading/trailing whitespace
            url = url.strip()
            
            # Check if URL is properly formatted
            parsed_url = urlparse(url)
            if not all([parsed_url.scheme, parsed_url.netloc]):
                return {"error": "Invalid URL format"}
            
            # Prepare the API request
            headers = {
                "x-apikey": self.virustotal_api_key,
                "Content-Type": "application/json"
            }
            
            # First, check if URL has been analyzed before
            url_id = requests.utils.quote(url, safe='')
            response = requests.get(f"https://www.virustotal.com/api/v3/urls/{url_id}", headers=headers)
            
            # If not found, submit for analysis
            if response.status_code == 404:
                logger.info(f"URL {url} not found in VirusTotal, submitting for analysis")
                payload = {"url": url}
                response = requests.post("https://www.virustotal.com/api/v3/urls", headers=headers, data=payload)
                
                if response.status_code == 200:
                    analysis_id = response.json().get("data", {}).get("id")
                    
                    # Wait for analysis to complete (with timeout)
                    max_attempts = 5
                    for attempt in range(max_attempts):
                        logger.info(f"Analysis for {url} is queued, waiting...")
                        
                        # Wait before checking again
                        import time
                        time.sleep(5)
                        
                        # Check analysis status
                        response = requests.get(f"https://www.virustotal.com/api/v3/analyses/{analysis_id}", headers=headers)
                        
                        if response.status_code == 200:
                            data = response.json().get("data", {})
                            status = data.get("attributes", {}).get("status")
                            
                            if status == "completed":
                                break
                        
                        # Last attempt, return what we have
                        if attempt == max_attempts - 1:
                            logger.warning(f"Analysis for {url} timed out")
                            return {"status": "timeout", "message": "Analysis taking too long"}
                else:
                    logger.error(f"Error submitting URL to VirusTotal: {response.status_code}")
                    return {"error": f"API error: {response.status_code}"}
            
            # Process the result
            if response.status_code == 200:
                result = response.json()
                
                # For completed analysis, extract the stats
                try:
                    # Extract relevant threat information
                    stats = result.get("data", {}).get("attributes", {}).get("stats", {})
                    malicious = stats.get("malicious", 0)
                    suspicious = stats.get("suspicious", 0)
                    total = sum(stats.values())
                    
                    return {
                        "status": "complete",
                        "malicious": malicious,
                        "suspicious": suspicious,
                        "total": total,
                        "score": (malicious + suspicious) / total if total > 0 else 0,
                        "url": url
                    }
                except Exception as e:
                    logger.error(f"Error processing VirusTotal results: {e}")
                    return {"error": f"Error processing results: {str(e)}"}
            else:
                logger.error(f"VirusTotal API error: {response.status_code}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error in VirusTotal scan: {e}")
            return {"error": str(e)}
    
    def analyze_message(self, message: str) -> Dict:
        """
        Analyze a message for potential cybersecurity threats.
        
        Args:
            message: User message to analyze
            
        Returns:
            Dictionary with threat analysis results
        """
        # Initialize the result
        result = {
            "risk_level": "none",
            "threat_categories": [],
            "indicators": [],
            "recommendations": []
        }
        
        # Skip empty messages
        if not message or message.strip() == "":
            return result
        
        # Find pattern matches
        matches = {}
        for pattern_name, pattern in self.patterns.items():
            found = re.findall(pattern, message, re.MULTILINE)
            if found:
                matches[pattern_name] = found
        
        # Check for URLs
        urls = matches.get('url', [])
        
        # If we have VirusTotal API key and found URLs, check them
        virustotal_results = []
        if self.virustotal_enabled and urls:
            for url in urls[:3]:  # Limit to first 3 URLs to avoid rate limits
                scan_result = self.scan_url(url)
                if "error" not in scan_result:
                    virustotal_results.append(scan_result)
        
        # Analyze the pattern matches to determine threats
        self._evaluate_threats(message, matches, virustotal_results, result)
        
        return result
    
    def _evaluate_threats(self, message: str, matches: Dict, virustotal_results: List, result: Dict) -> None:
        """
        Evaluate pattern matches to determine security threats.
        Updates the result dictionary in place.
        
        Args:
            message: Original message
            matches: Dictionary of pattern matches
            virustotal_results: Results from VirusTotal scans
            result: Result dictionary to update
        """
        threat_indicators = []
        recommendations = []
        threat_categories = set()
        risk_score = 0
        
        # Check for URLs and domains
        if matches.get('url') or matches.get('ip_address'):
            # Add suspicious domains to threats
            if matches.get('suspicious_domain'):
                threat_indicators.append("Suspicious domain detected that may be used for phishing")
                threat_categories.add("phishing")
                risk_score += 2
                
            # Add VirusTotal results
            for result in virustotal_results:
                if result.get("score", 0) > 0.1:
                    threat_indicators.append(
                        f"URL {result['url']} flagged by {result.get('malicious', 0)} security vendors as malicious"
                    )
                    threat_categories.add("malicious url")
                    risk_score += 3
        
        # Check for credential exposure
        if matches.get('password'):
            threat_indicators.append("Password exposed in plaintext")
            threat_categories.add("credential exposure")
            recommendations.append("Never share passwords in plaintext messages")
            risk_score += 4
        
        if matches.get('credit_card'):
            threat_indicators.append("Credit card number potentially exposed")
            threat_categories.add("data exposure")
            recommendations.append("Avoid sharing financial information over unsecured channels")
            risk_score += 4
            
        if matches.get('ssn'):
            threat_indicators.append("Social Security Number potentially exposed")
            threat_categories.add("data exposure")
            recommendations.append("Never share Social Security Numbers via messaging")
            risk_score += 4
        
        # Check for malware indicators
        if matches.get('executable') or matches.get('double_extension'):
            threat_indicators.append("Suspicious file attachment with executable extension")
            threat_categories.add("malware")
            recommendations.append("Do not open unexpected executable files")
            risk_score += 3
        
        if matches.get('suspicious_command'):
            threat_indicators.append("Suspicious command that may execute malicious code")
            threat_categories.add("malware")
            threat_categories.add("command execution")
            recommendations.append("Do not run commands from untrusted sources")
            risk_score += 4
        
        # Check for phishing indicators
        phishing_score = 0
        
        if matches.get('urgency'):
            phishing_score += 1
            threat_indicators.append("Message creates a false sense of urgency")
        
        if matches.get('threat'):
            phishing_score += 1
            threat_indicators.append("Message contains threatening language about accounts or security")
        
        if phishing_score >= 1:
            threat_categories.add("phishing")
            risk_score += phishing_score
            
            if 'url' in matches and phishing_score >= 1:
                threat_categories.add("credential harvesting")
                recommendations.append("Verify suspicious links before clicking")
                recommendations.append("Contact organizations directly through official channels")
        
        # Set the overall risk level
        if risk_score >= 4:
            result["risk_level"] = "high"
        elif risk_score >= 2:
            result["risk_level"] = "medium"
        elif risk_score >= 1:
            result["risk_level"] = "low"
        
        # Update the result
        result["indicators"] = threat_indicators
        result["recommendations"] = recommendations
        result["threat_categories"] = list(threat_categories)
        result["risk_score"] = risk_score
    
    def get_security_recommendations(self, threat_analysis: Dict) -> List[str]:
        """
        Get a list of security recommendations based on the threat analysis.
        
        Args:
            threat_analysis: The threat analysis result
            
        Returns:
            List of security recommendations
        """
        if threat_analysis["risk_level"] == "none":
            return []
            
        recommendations = []
        
        # Add the detected security recommendations
        if threat_analysis["recommendations"]:
            recommendations.extend(threat_analysis["recommendations"])
        
        # Add recommendations based on threat categories
        threat_categories = set(threat_analysis["threat_categories"])
        
        if "phishing" in threat_categories:
            recommendations.append("Be cautious of messages creating urgency or requesting sensitive information")
            recommendations.append("Verify the authenticity of links before clicking them")
            
        if "malware" in threat_categories:
            recommendations.append("Do not download or open unexpected file attachments")
            recommendations.append("Keep your antivirus software up to date")
            
        if "credential exposure" in threat_categories or "data exposure" in threat_categories:
            recommendations.append("Never share sensitive information in unsecured communications")
            recommendations.append("Check for secure connections (https://) before entering credentials")
            
        if "suspicious network" in threat_categories or "command and control" in threat_categories:
            recommendations.append("Monitor your network for unusual connections")
            recommendations.append("Use a firewall to block suspicious traffic")
        
        # Return unique recommendations
        return list(set(recommendations))
