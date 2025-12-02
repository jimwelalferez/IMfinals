import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/login', {
        email,
        password
      });

      const { token, user } = response.data;
      login(user, token);

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
    } catch (error) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-icon">H</div>
            <span className="logo-text">HAULPAY</span>
          </div>
          <h1 className="login-title">Sign In</h1>
          <p className="login-subtitle">Enter your credentials to access your account</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <div className="password-label-container">
              <label htmlFor="password">Password</label>
              {/* <a href="#" className="forgot-password">Forgot password?</a> */}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <div className="button-loading">
                <div className="spinner"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* <div className="login-footer">
          <p className="signup-link">
            Don't have an account? <a href="#">Contact administrator</a>
          </p>
        </div> */}
      </div>

      <div className="login-footer-note">
        <p>© 2024 Haulpay Payroll System. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Login;