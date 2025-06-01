import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import { useAuth } from './context/AuthContext';

// Hidden watermark - not visible but present in source
const HiddenWatermark = () => (
  <div 
    style={{
      position: 'absolute',
      opacity: 0,
      height: 0,
      width: 0,
      overflow: 'hidden',
      pointerEvents: 'none'
    }}
    data-watermark="HalfSilver"
    data-created="2025-06-01"
    data-license="Proprietary"
  >
    {/* Additional hidden metadata */}
    <meta name="application-name" content="HalfSilver" />
    <meta name="author" content="HalfSilver" />
    <meta name="copyright" content="Copyright © 2025 HalfSilver. All rights reserved." />
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <>
      <HiddenWatermark />
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route 
                path="/chat" 
                element={<ProtectedRoute><Chat /></ProtectedRoute>} 
              />
              <Route path="/chat/:sessionId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/chat" replace />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </>
  );
}

export default App;
