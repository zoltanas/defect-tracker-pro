import { useGoogleLogin } from '@react-oauth/google';
import { useStore } from '../store/useStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Login() {
  const { setUser, setDemoMode } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam === 'auth_expired') {
      setError('Your session has expired. Please log in again.');
    } else if (errParam === 'missing_scopes') {
      setError('You must grant Google Drive and Google Sheets permissions to use this app. Please log in again and check all the boxes.');
    }
  }, [searchParams]);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const hasClientId = !!clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID';

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setError(null);

        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        }).then(res => res.json());

        setUser({
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          accessToken: tokenResponse.access_token,
        });
        setDemoMode(false);
        navigate('/');
      } catch (error) {
        console.error('Failed to fetch user info', error);
        setError('Failed to fetch user info. Please try again.');
      }
    },
    onError: () => {
      setError('Login failed. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
  });

  const handleDemoLogin = () => {
    setUser({
      id: 'demo-user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      picture: '',
      accessToken: 'demo-token',
    });
    setDemoMode(true);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 flex items-center justify-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg" alt="Lidl Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900">
          DefectTracker Pro
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          Construction defect management with Google Drive sync
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-zinc-200/50 sm:rounded-2xl sm:px-10 border border-zinc-100">
          {!hasClientId && (
            <div className="mb-6 rounded-xl bg-amber-50 p-4 border border-amber-200/50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">Google Client ID Missing</h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>
                      To enable Google Drive & Sheets sync, add your Client ID to the environment variables.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200/50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Login Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => login()}
              disabled={!hasClientId}
              className="w-full flex justify-center py-3 px-4 border border-zinc-300 rounded-xl shadow-sm bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lidl-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-zinc-500">Or</span>
              </div>
            </div>

            <button
              onClick={handleDemoLogin}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-all"
            >
              Continue in Demo Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
