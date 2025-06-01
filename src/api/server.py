#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CyberGuard AI - API Server
This module provides a FastAPI server for the CyberGuard AI chatbot.
"""

import os
import logging
import sys
import uuid
from typing import Dict, List, Optional, Union
from fastapi import FastAPI, HTTPException, Request, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timedelta
from src.utils.database import db

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.openrouter import OpenRouterCyberGuardBot
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import the local model (if available)
try:
    from models.local_model import LocalCyberGuardBot
    has_local_model = True
except ImportError:
    has_local_model = False
    logger.warning("Local model support not available")

# Create FastAPI app
app = FastAPI(
    title="CyberGuard AI API",
    description="API for interacting with the CyberGuard cybersecurity chatbot",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files are now served by the separate frontend
# static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
# app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Request models
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to process")
    session_id: Optional[str] = Field(None, description="Unique session ID for conversation tracking")
    max_tokens: Optional[int] = Field(512, description="Maximum number of tokens to generate")
    temperature: Optional[float] = Field(0.7, ge=0.1, le=1.0, description="Temperature for response generation")
    model_type: Optional[str] = Field("openrouter", description="Model type to use: 'local' or 'openrouter'")
    model_name: Optional[str] = Field(None, description="Specific model name to use")

# Response models
class ChatResponse(BaseModel):
    response: str = Field(..., description="Assistant response")
    session_id: str = Field(..., description="Session ID for conversation tracking")
    detected_threats: Optional[List[str]] = Field(None, description="Detected potential threats")
    model_used: str = Field(..., description="Model used for generating the response")

# Auth models
class SignupRequest(BaseModel):
    email: EmailStr = Field(..., title="Email address")
    fullname: str = Field(..., title="Full name")
    password: str = Field(..., title="Password", min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., title="Email address")
    password: str = Field(..., title="Password")

class AuthResponse(BaseModel):
    token: str = Field(..., title="Authentication token")
    expires: str = Field(..., title="Expiry timestamp in ISO format")
    email: str = Field(..., title="User email")
    fullname: Optional[str] = Field(None, title="User full name")

# Create dictionaries to store chat sessions
local_chat_sessions = {}
openrouter_chat_sessions = {}

# Helper function to get or create local chatbot instance
def get_local_chatbot(session_id: str) -> 'LocalCyberGuardBot':
    if not has_local_model:
        raise HTTPException(status_code=501, detail="Local model support not available")
        
    if session_id not in local_chat_sessions:
        # Create a new chatbot instance
        try:
            logger.info(f"Creating new local chatbot instance for session {session_id}")
            local_chat_sessions[session_id] = LocalCyberGuardBot(
                model_name=settings.LOCAL_MODEL_NAME
            )
        except Exception as e:
            logger.error(f"Failed to initialize local chatbot: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize local chatbot: {str(e)}")
            
    return local_chat_sessions[session_id]

# Helper function to get or create OpenRouter chatbot instance
def get_openrouter_chatbot(session_id: str, model_name: Optional[str] = None) -> OpenRouterCyberGuardBot:
    if session_id not in openrouter_chat_sessions:
        # Create a new chatbot instance
        try:
            logger.info(f"Creating new OpenRouter chatbot instance for session {session_id}")
            default_model = model_name or settings.OPENROUTER_MODEL_NAME
            openrouter_chat_sessions[session_id] = OpenRouterCyberGuardBot(
                model_name=default_model
            )
        except Exception as e:
            logger.error(f"Failed to initialize OpenRouter chatbot: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize OpenRouter chatbot: {str(e)}")
            
    return openrouter_chat_sessions[session_id]

# Security utilities
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify the authentication token and return the user info"""
    token = credentials.credentials
    user_data = db.verify_session(token)
    
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user_data

# Routes
@app.get("/")
async def root():
    """Return API status information"""
    return {
        "status": "online",
        "version": "1.0.0",
        "message": "API server running - Frontend is served separately",
        "available_backends": {
            "local": has_local_model,
            "openrouter": True
        }
    }

@app.get("/api/status")
async def api_status():
    """Get API status and available models"""
    return {
        "status": "online",
        "version": "1.0.0",
        "available_backends": {
            "local": has_local_model,
            "openrouter": True
        }
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a chat message and get a response"""
    try:
        # Use provided session ID or generate a new one
        session_id = request.session_id or str(uuid.uuid4())
        
        # Determine which model to use
        model_type = request.model_type.lower() if request.model_type else "openrouter"
        
        # Get or create the appropriate chatbot
        if model_type == "local" and has_local_model:
            chatbot = get_local_chatbot(session_id)
            model_used = f"local:{request.model_name or settings.LOCAL_MODEL_NAME}"
        else:
            chatbot = get_openrouter_chatbot(session_id, request.model_name)
            model_used = f"openrouter:{request.model_name or settings.OPENROUTER_MODEL_NAME}"
        
        # Process the user message
        response = chatbot.chat(
            user_input=request.message,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        # Extract detected threats if available
        detected_threats = None
        if chatbot.enable_threat_detection and chatbot.threat_detector:
            try:
                threat_analysis = chatbot.analyze_security_threats(request.message)
                if threat_analysis["risk_level"] != "none":
                    detected_threats = threat_analysis["threat_categories"]
            except Exception as e:
                logger.error(f"Error extracting threat information: {e}")
        
        return ChatResponse(
            response=response,
            session_id=session_id,
            detected_threats=detected_threats,
            model_used=model_used
        )
        
    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/clear-session/{session_id}")
async def clear_session(
    session_id: str, 
    model_type: str = Query("openrouter", description="Model type: 'local' or 'openrouter'")
):
    """Clear the chat history for a specific session"""
    if model_type.lower() == "local":
        if session_id in local_chat_sessions:
            local_chat_sessions[session_id].clear_history()
            del local_chat_sessions[session_id]
            return {"status": "success", "message": f"Local session {session_id} cleared"}
        return {"status": "error", "message": f"Session {session_id} not found"}
    else:
        if session_id in openrouter_chat_sessions:
            openrouter_chat_sessions[session_id].clear_history()
            del openrouter_chat_sessions[session_id]
            return {"status": "success", "message": f"OpenRouter session {session_id} cleared"}
        return {"status": "error", "message": f"Session {session_id} not found"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/models")
async def list_models():
    """List available models"""
    models = {
        "local": [],
        "openrouter": [
            "meta-llama/meta-llama-3.1-8b-instruct",
            "meta-llama/meta-llama-3.1-70b-instruct",
            "anthropic/claude-3-opus-20240229",
            "anthropic/claude-3-sonnet-20240229",
            "google/gemini-pro",
            "mistralai/mistral-medium",
            "nvidia/llama-3.1-nemotron-ultra-253b-v1:free"
        ]
    }
    
    return {
        "available_backends": {
            "local": has_local_model,
            "openrouter": True
        },
        "models": models
    }

# Authentication endpoints
@app.post("/api/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """Create a new user account"""
    # Create the user
    success = db.create_user(
        email=request.email,
        fullname=request.fullname,
        password=request.password
    )
    
    if not success:
        raise HTTPException(status_code=400, detail="User already exists or registration failed")
    
    # Verify to get user id
    user = db.verify_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=500, detail="User created but verification failed")
    
    # Create session
    session = db.create_session(user["id"])
    if not session:
        raise HTTPException(status_code=500, detail="Failed to create session")
    
    return {
        "token": session["token"],
        "expires": session["expires"],
        "email": user["email"],
        "fullname": user["fullname"]
    }

@app.post("/api/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Log in an existing user"""
    user = db.verify_user(request.email, request.password)
    
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Create session
    session = db.create_session(user["id"])
    if not session:
        raise HTTPException(status_code=500, detail="Failed to create session")
    
    return {
        "token": session["token"],
        "expires": session["expires"],
        "email": user["email"],
        "fullname": user["fullname"]
    }

@app.post("/api/logout")
async def logout(user_data: dict = Depends(verify_token)):
    """Log out a user"""
    db.logout(user_data["token"])
    return {"success": True}

@app.get("/api/me")
async def get_current_user(user_data: dict = Depends(verify_token)):
    """Get current user info"""
    return {
        "email": user_data["email"],
        "fullname": user_data["fullname"]
    }

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client connected: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client disconnected: {client_id}")

    async def send_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

# Create connection manager
manager = ConnectionManager()

# WebSocket endpoint for real-time chat
@app.websocket("/api/chat")
async def websocket_chat(websocket: WebSocket):
    # Get token from query params for authentication
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Not authenticated")
        return

    # Verify token
    user_data = db.verify_session(token)
    if not user_data:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    # Generate client ID using user ID and a unique identifier
    client_id = f"{user_data['id']}_{str(uuid.uuid4())}"
    session_id = str(uuid.uuid4())  # Create a new session for this connection
    
    # Get chatbot instance for this session
    chatbot = get_openrouter_chatbot(session_id)
    
    try:
        # Accept connection
        await manager.connect(websocket, client_id)
        
        # Send welcome message
        await manager.send_message({
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to CyberGuard AI"
        }, client_id)
        
        # Handle incoming messages
        while True:
            # Wait for a message from the client
            data = await websocket.receive_json()

            # Handle ping-pong for connection keepalive
            if data.get("event") == "ping":
                try:
                    logger.info(f"Received ping from {client_id}, sending pong...")
                    await manager.send_message({
                        "type": "pong"
                    }, client_id)
                    logger.info(f"Pong sent to {client_id}")
                except Exception as e:
                    logger.error(f"Failed to send pong: {e}")
                continue

            # Extract message and parameters
            message = data.get("message", "")
            model = data.get("model", settings.OPENROUTER_MODEL_NAME)

            if not message.strip():
                continue

            # Send typing indicator
            await manager.send_message({
                "type": "thinking",
                "session_id": session_id
            }, client_id)

            try:
                # Process the message with the chatbot
                response = chatbot.chat(
                    user_input=message,
                    max_tokens=1024
                )

                # Send the response back to the client
                await manager.send_message({
                    "type": "message",
                    "session_id": session_id,
                    "response": response,
                    "model_used": f"openrouter:{model}",
                    "timestamp": datetime.now().isoformat()
                }, client_id)

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await manager.send_message({
                    "type": "error",
                    "message": f"Error processing your message: {str(e)}"
                }, client_id)
                
    except WebSocketDisconnect:
        # Clean up on disconnect
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(client_id)

# Run the API server
if __name__ == "__main__":
    import uvicorn
    
    # Check if running in Google Colab
    is_colab = 'COLAB_GPU' in os.environ
    
    if is_colab:
        from google.colab import output
        output.serve_kernel_port_as_window(settings.API_PORT)
        logger.info(f"Running in Google Colab, serving on port {settings.API_PORT}")
    
    # Run the server
    uvicorn.run(
        "api.server:app", 
        host=settings.API_HOST, 
        port=settings.API_PORT, 
        reload=not is_colab
    )
