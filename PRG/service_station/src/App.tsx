import { useState, useEffect } from 'react';
import "./App.css";
import LoginForm from "./components/LoginForm";
import MasterDashboard from "./components/MasterDashboard";
import AdminDashboard from "./components/AdminDashboard";
import WorkerDashboard from "./components/WorkerDashboard";
import DiagnosticianDashboard from "./components/DiagnosticianDashboard";
import StorekeeperDashboard from "./components/StorekeeperDashboard";
import { User } from "./types/user";

function App() {
  const [currentView, setCurrentView] = useState<'login' | 'master' | 'admin' | 'diagnostician' | 'storekeeper' | 'worker'>('login');
  const [user, ] = useState<User | null>(null); // Используем деструктуризацию, чтобы показать, что setUser не используется

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
        return <AdminDashboard user={user!} onLogout={() => {
          // Логика выхода пользователя
          localStorage.removeItem('sessionToken');
          setCurrentView('login');
        }} />;
      case 'diagnostician':
        return <DiagnosticianDashboard />;
      case 'storekeeper':
        return <StorekeeperDashboard />;
      case 'worker':
        return <WorkerDashboard />;
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
