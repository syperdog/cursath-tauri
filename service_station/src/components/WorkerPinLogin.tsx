import React, { useState } from 'react';
import './WorkerPinLogin.css';

interface WorkerPinLoginProps {
  onLoginSuccess: (workerId: string) => void;
}

const WorkerPinLogin: React.FC<WorkerPinLoginProps> = ({ onLoginSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === 4) {
        // In a real implementation, we would validate the PIN against the backend
        // For now, we'll simulate successful login with any 4-digit PIN
        simulateLogin(newPin);
      }
    }
  };

  const simulateLogin = (enteredPin: string) => {
    // Simulate checking PIN against database
    // In a real app, this would be an API call
    if (enteredPin.length === 4) {
      // Store session token or user info
      localStorage.setItem('sessionToken', 'worker_session_token');
      localStorage.setItem('currentUserRole', 'worker');
      
      // Call the success callback
      onLoginSuccess(enteredPin);
    } else {
      setError('PIN должен содержать 4 цифры');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div className="worker-pin-login">
      <div className="login-container">
        <h1>🔧 ВХОД ДЛЯ СОТРУДНИКОВ (ТЕРМИНАЛ ЦЕХА)</h1>
        
        <div className="pin-display">
          <div className="pin-input">
            {Array.from({ length: 4 }).map((_, index) => (
              <span 
                key={index} 
                className={`pin-digit ${index < pin.length ? 'filled' : ''}`}
              >
                {index < pin.length ? '*' : '_'}
              </span>
            ))}
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="keypad">
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => handleDigitPress('1')}>1</button>
            <button className="keypad-button" onClick={() => handleDigitPress('2')}>2</button>
            <button className="keypad-button" onClick={() => handleDigitPress('3')}>3</button>
            <button className="keypad-button" onClick={() => handleDigitPress('4')}>4</button>
          </div>
          
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => handleDigitPress('5')}>5</button>
            <button className="keypad-button" onClick={() => handleDigitPress('6')}>6</button>
            <button className="keypad-button" onClick={() => handleDigitPress('7')}>7</button>
            <button className="keypad-button" onClick={() => handleDigitPress('8')}>8</button>
          </div>
          
          <div className="keypad-row">
            <button className="keypad-button" onClick={() => handleDigitPress('9')}>9</button>
            <button className="keypad-button" onClick={() => handleDigitPress('0')}>0</button>
            <button className="keypad-button special-button" onClick={handleBackspace}>⌫</button>
            <button className="keypad-button special-button" onClick={handleClear}>C</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerPinLogin;