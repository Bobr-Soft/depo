import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import Dashboard from './pages/Dashboard';
import { setAuthToken } from './services/api';


function App() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string; image?: string } | null>(null);

  // Load token from localStorage on app start
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      console.log('🔄 Restoring session...');
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setAuthToken(savedToken);
      } catch (e) {
        console.error('Failed to restore session');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const handleLogin = (token: string, user: { name: string; email: string; image?: string }) => {
    console.log('✅ Login successful, redirecting to dashboard');
    setToken(token);
    setUser(user);
    setAuthToken(token);
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const handleLogout = () => {
    console.log('👋 Logging out');
    setToken(null);
    setUser(null);
    setAuthToken('');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <Router>
        <Routes>
          <Route
            path="/"
            element={token ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin}  />}
          />
          
          <Route
            path="/dashboard"
            element={token && user ? <Dashboard onLogout={handleLogout} user={user} /> : <Navigate to="/" />}
          />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
