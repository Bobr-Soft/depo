import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';
import { api, setAuthToken } from '../services/api';
import Plasma from '../components/Plasma';
import styles from '../assets/styles/Login.module.css';



interface LoginProps {
  onLogin: (token: string, user: { name: string; email: string; image?: string; role?: string }) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const { instance } = useMsal();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      if (isLoading) {
        return;
      }

      setIsLoading(true);
      setError(null);
      console.log('🔄 Starting Entra ID login...');


      const loginResponse = await instance.loginPopup({
        ...loginRequest,
        prompt: 'login'
      });
      console.log('Entra ID returned username:', loginResponse.account?.username);
      console.log('Entra ID returned name:', loginResponse.account?.name);

      const email = loginResponse.account?.username;
      if (!email) {
        throw new Error('Email not found in Entra ID response');
      }
      const name = loginResponse.account?.name || email.split('@')[0];
      const image = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0078D4&color=fff`;

      console.log('✅ Entra ID login successful for:', email);
      console.log('🔄 Validating with backend...');

      const res = await api.post('/login', { email });
      console.log('📥 Backend response:', res.data);
      const { token, user: userData } = res.data;
      console.log('📥 User data:', userData);
      const role = userData?.role || 'Teacher';

      console.log('✅ Backend validation successful');
      console.log('👤 User role:', role);
      setAuthToken(token);

      onLogin(token, { name, email, image, role });

    } catch (err: unknown) {
      const error = err as { response?: { status: number; data?: { message: string } }; code?: string; message: string };
      console.error('❌ Login error:', error);

      if (error.response?.status === 403) {
        setError('Access denied: Your account is not authorized to access this system. Please contact your administrator.');
      } else if (error.response?.status === 503) {
        setError('System temporarily unavailable. Please try again later.');
      } else if (error.code === 'ECONNABORTED' || String(error.message || '').toLowerCase().includes('timeout')) {
        setError('Backend timeout. The server may be waking up. Please try again in a few seconds.');
      } else if (!error.response) {
        setError('Network error while contacting backend. Check API URL and CORS settings.');
      } else {
        setError(error.response?.data?.message || error.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div style={{ position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0 }}>
        <Plasma
          color="#42a4f5"
          speed={1.7}
          direction="forward"
          scale={0.7}
          opacity={1}
          mouseInteractive={false}
        />
      </div>

      <div className={styles.loginBox}>
        <h1>Leltár alkalmazás</h1>
        <p>Bejelentkezés iskolai e-mail címmel</p>

        <button onClick={handleLogin} disabled={isLoading}>
          {isLoading ? 'Bejelentkezés...' : 'Bejelentkezés'}
        </button>
        <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>Secure Azure AD Authentication</p>

        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    </div>
  );
};
