import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiEye, FiEyeOff, FiShield } from 'react-icons/fi';

const SignupForm = () => {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: 'Password strength', level: 'empty' });
  const [validationError, setValidationError] = useState('');
  
  const { signup, loading, error } = useAuth();
  const navigate = useNavigate();

  // Check password strength whenever password changes
  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(password));
  }, [password]);

  const checkPasswordStrength = (password) => {
    if (!password) {
      return { score: 0, level: 'empty', message: 'Password strength' };
    }
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Complexity checks
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Normalize score to 1-4 range
    score = Math.min(4, Math.max(1, Math.floor(score / 1.5)));
    
    // Return result based on score
    switch (score) {
      case 1:
        return { score, level: 'weak', message: 'Weak password' };
      case 2:
        return { score, level: 'fair', message: 'Fair password' };
      case 3:
        return { score, level: 'good', message: 'Good password' };
      case 4:
        return { score, level: 'strong', message: 'Strong password' };
      default:
        return { score: 0, level: 'empty', message: 'Password strength' };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    
    // Validate form
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long');
      return;
    }
    
    if (passwordStrength.score < 2) {
      setValidationError('Please choose a stronger password');
      return;
    }
    
    // Attempt signup
    const success = await signup(email, fullname, password);
    
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
              Create your account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="fullname" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                Full Name
              </label>
              <input
                id="fullname"
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="input w-full"
                placeholder="John Doe"
                required
              />
            </div>

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
                  minLength={8}
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
              
              {/* Password strength meter */}
              <div className="mt-1">
                <div className="h-1 w-full bg-secondary-200 dark:bg-secondary-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-1 transition-all duration-300 rounded-full ${
                      passwordStrength.level === 'weak' ? 'bg-red-500' : 
                      passwordStrength.level === 'fair' ? 'bg-yellow-500' : 
                      passwordStrength.level === 'good' ? 'bg-green-500' : 
                      passwordStrength.level === 'strong' ? 'bg-green-600' : ''
                    }`}
                    style={{ width: `${passwordStrength.score * 25}%` }}
                  ></div>
                </div>
                <p className="text-xs mt-1 text-secondary-500 dark:text-secondary-400">
                  {passwordStrength.message}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••"
                required
              />
            </div>

            {(validationError || error) && (
              <div className="mb-4 p-2 bg-red-100 border border-red-300 text-red-800 text-sm rounded">
                {validationError || error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full mb-4"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="text-center">
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Log in
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

export default SignupForm;
