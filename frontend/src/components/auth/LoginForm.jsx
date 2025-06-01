import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiEye, FiEyeOff, FiShield } from 'react-icons/fi';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/chat');
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-secondary-900 dark:to-primary-900">
      <div className="m-auto w-full max-w-md p-6">
        <div className="card border border-secondary-200 dark:border-secondary-700">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2">
              <div className="bg-primary-100 dark:bg-primary-900 p-3 rounded-full">
                <FiShield className="text-primary-600 dark:text-primary-400 text-3xl" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-50">
              CyberGuard AI
            </h1>
            <p className="text-secondary-600 dark:text-secondary-400">
              Log in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-secondary-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-300 text-red-800 text-sm rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full mb-4"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <div className="text-center">
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Sign up
                </Link>
              </p>
              <p className="text-xs mt-4 text-secondary-500 dark:text-secondary-500">
                🔒 Your information is encrypted and securely stored
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
