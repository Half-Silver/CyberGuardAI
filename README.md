# CyberGuard AI - Your Personal Security Assistant

<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
</div>

Welcome to CyberGuard AI! An intelligent chatbot that helps you with cybersecurity questions, threat detection, and security best practices.

## 🌟 Features

- 🔍 **AI-Powered Security Analysis**
- 🛡️ **Real-time Threat Detection**
- 💬 **Interactive Chat Interface**
- 🔒 **Secure Authentication**
- 📱 **Responsive Design**

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or later)
- Python (v3.8 or later)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Half-Silver/CyberGuardAI.git
   cd CyberGuardAI
   ```

2. **Set up the Backend**
   ```bash
   # Navigate to backend directory
   cd backend-node
   
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the Frontend**
   ```bash
   # Navigate to frontend directory
   cd ../frontend
   
   # Install Node.js dependencies
   npm install
   # or
   yarn install
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   # From the backend-node directory
   node src/server.js
   ```
   The backend will run on `http://localhost:5000`

2. **Start the Frontend Development Server**
   ```bash
   # From the frontend directory
   npm run dev
   # or
   yarn dev
   ```
   The frontend will be available at `http://localhost:3000`

3. **Access the Application**
   - Open your browser and go to `http://localhost:3000`
   - Sign up for a new account or log in if you already have one
   - Start chatting with CyberGuard AI!

## 📂 Project Structure

```
CyberGuardAI/
├── backend-node/         # Node.js backend server
│   ├── src/
│   │   ├── config/     # Configuration files
│   │   ├── controllers/  # Request handlers
│   │   ├── models/      # Database models
│   │   └── server.js    # Main server file
│   └── .env.example     # Example environment variables
│
├── frontend/            # React frontend
│   ├── public/          # Static files
│   └── src/
│       ├── components/  # React components
│       ├── context/     # React context providers
│       └── pages/       # Page components
│
└── docs/               # Documentation
```

## 🔧 Configuration

1. **Backend Configuration**
   - Copy `.env.example` to `.env` in the `backend-node` directory
   - Update the following variables:
     ```
     PORT=5000
     MONGODB_URI=your_mongodb_connection_string
     JWT_SECRET=your_jwt_secret
     OPENROUTER_API_KEY=your_openrouter_api_key
     ```

2. **Frontend Configuration**
   - Update API endpoints in `frontend/src/config.js` if needed

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

- Email: projectx.jslab@gmail.com
- GitHub: [@Half-Silver](https://github.com/Half-Silver)
- Project Link: [https://github.com/Half-Silver/CyberGuardAI](https://github.com/Half-Silver/CyberGuardAI)

---

<div align="center">
  Made with ❤️ by the CyberGuard AI Team
</div>
