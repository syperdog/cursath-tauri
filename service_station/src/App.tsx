import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import "./App.css";
import LoginForm from "./components/LoginForm";
import MasterDashboard from "./components/MasterDashboard";

interface User {
  id: number;
  full_name: string;
  role: string;
  login: string | null;
  password_hash: string | null;
  pin_code: string | null;
  status: string;
}

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'master' | 'admin' | 'diagnostician' | 'storekeeper' | 'worker'>('login');
  const [user, setUser] = useState<User | null>(null);

  // Handle routing based on hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove the '#'

      switch(hash) {
        case 'master':
        case 'admin':
        case 'diagnostician':
        case 'storekeeper':
        case 'worker':
          setCurrentView(hash as any);
          break;
        case 'login':
        default:
          setCurrentView('login');
          break;
      }
    };

    // Initial check
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const renderCurrentView = () => {
    switch(currentView) {
      case 'master':
        return <MasterDashboard />;
      case 'admin':
        return <div>Admin Dashboard (Coming Soon)</div>;
      case 'diagnostician':
        return <div>Diagnostician Dashboard (Coming Soon)</div>;
      case 'storekeeper':
        return <div>Storekeeper Dashboard (Coming Soon)</div>;
      case 'worker':
        return <div>Worker Dashboard (Coming Soon)</div>;
      case 'login':
      default:
        return <LoginForm />;
    }
  };

  return (
    <div className="App">
      {renderCurrentView()}
    </div>
  );
}

export default App;
