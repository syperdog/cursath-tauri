import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './LoginForm.css';

// Define User interface (should match the Rust struct)
interface User {
  id: number;
  full_name: string;
  role: string;
  login: string | null;
  password_hash: string | null;
  pin_code: string | null;
  status: string;
}

interface LoginFormData {
  username: string;
  password: string;
}

interface PinFormData {
  pin: string;
}

const LoginForm: React.FC = () => {
  const [isPinMode, setIsPinMode] = useState(false);
  const [loginData, setLoginData] = useState<LoginFormData>({ username: '', password: '' });
  const [pinData, setPinData] = useState<PinFormData>({ pin: '' });
  const [message, setMessage] = useState<string>('');

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPinData({ pin: e.target.value });
  };

  const handlePinButtonClick = (digit: string) => {
    if (pinData.pin.length < 4) {
      setPinData({ pin: pinData.pin + digit });
    }
  };

  const handleBackspace = () => {
    if (pinData.pin.length > 0) {
      setPinData({ pin: pinData.pin.slice(0, -1) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      let result: [User, string];
      if (isPinMode) {
        result = await invoke<[User, string]>('login_worker', { pin: pinData.pin });
      } else {
        result = await invoke<[User, string]>('login_user', {
          username: loginData.username,
          password: loginData.password
        });
      }

      const [user, sessionToken] = result;

      // Store user data and session token in localStorage
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userId', user.id.toString());
      localStorage.setItem('userName', user.full_name);
      localStorage.setItem('sessionToken', sessionToken);

      // Redirect based on role
      window.location.hash = `#${user.role.toLowerCase()}`;
    } catch (error) {
      setMessage(`Ошибка: ${(error as Error).message}`);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-wrapper">
        <h1 className="app-title">🛠️ AutoService Pro v2.0</h1>

        {isPinMode ? (
          <div className="login-form pin-mode">
            <h2>🔧 ВХОД ДЛЯ СОТРУДНИКОВ (ТЕРМИНАЛ ЦЕХА)</h2>
            
            <div className="pin-input-container">
              <div className="pin-display">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={`pin-dot ${i < pinData.pin.length ? 'filled' : ''}`}
                  />
                ))}
              </div>
            </div>

            <input
              type="password"
              value={pinData.pin}
              onChange={handlePinChange}
              className="hidden-pin-input"
              maxLength={4}
            />

            <div className="pin-keypad">
              <div className="keypad-row">
                <button onClick={() => handlePinButtonClick('1')}>1</button>
                <button onClick={() => handlePinButtonClick('2')}>2</button>
                <button onClick={() => handlePinButtonClick('3')}>3</button>
                <button onClick={() => handlePinButtonClick('4')}>4</button>
              </div>
              <div className="keypad-row">
                <button onClick={() => handlePinButtonClick('5')}>5</button>
                <button onClick={() => handlePinButtonClick('6')}>6</button>
                <button onClick={() => handlePinButtonClick('7')}>7</button>
                <button onClick={() => handlePinButtonClick('8')}>8</button>
              </div>
              <div className="keypad-row">
                <button onClick={() => handlePinButtonClick('9')}>9</button>
                <button onClick={() => handlePinButtonClick('0')}>0</button>
                <button onClick={handleBackspace}>⌫</button>
                <button onClick={handleSubmit} className="submit-btn">✓</button>
              </div>
            </div>

            <button 
              className="switch-mode-btn"
              onClick={() => setIsPinMode(false)}
            >
              Переключиться на обычный вход
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>ВХОД В СИСТЕМУ</h2>
            
            <div className="input-group">
              <label htmlFor="username">👤 ЛОГИН</label>
              <input
                type="text"
                id="username"
                name="username"
                value={loginData.username}
                onChange={handleLoginChange}
                placeholder="Введите логин"
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="password">🔑 ПАРОЛЬ</label>
              <input
                type="password"
                id="password"
                name="password"
                value={loginData.password}
                onChange={handleLoginChange}
                placeholder="Введите пароль"
                required
              />
            </div>
            
            <button type="submit" className="submit-btn">🚀 ВОЙТИ В СИСТЕМУ</button>
            
            <button 
              type="button" 
              className="switch-mode-btn"
              onClick={() => setIsPinMode(true)}
            >
              Вход для работника (PIN-код)
            </button>
          </form>
        )}
        
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
};

export default LoginForm;