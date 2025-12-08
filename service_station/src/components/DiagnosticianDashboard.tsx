import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './DiagnosticianDashboard.css';
import DiagnosticsModal from './DiagnosticsModal';

// Типы данных для заказа и автомобиля
type Order = {
  id: number;
  carModel: string;
  licensePlate: string;
  issueDescription: string;
};

// Тип для пользователя
interface User {
  id: number;
  full_name: string;
  role: string;
  login: string;
  status: string;
  pin_code: string;
}

const DiagnosticianDashboard: React.FC = () => {
  // Состояние для списка заказов, ожидающих диагностики
  const [orders, setOrders] = useState<Order[]>([
    { id: 105, carModel: 'BMW X5', licensePlate: '1234 AB-7', issueDescription: 'Стук в подвеске' },
    { id: 108, carModel: 'Audi A6', licensePlate: '5678 CD-7', issueDescription: 'Горит Check Engine' }
  ]);

  // Состояние для пользователя
  const [user, setUser] = useState<User | null>(null);

  // Состояние для выбранного заказа
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  // Состояние для отображения модального окна диагностики
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

  // Функция для обработки выбора заказа
  const handleSelectOrder = (orderId: number) => {
    setSelectedOrder(orderId);
  };

  // Функция для начала диагностики
  const handleStartDiagnosis = () => {
    if (selectedOrder !== null) {
      setShowDiagnosticsModal(true);
    }
  };

  // Функция для завершения диагностики
  const handleDiagnosisComplete = (faults: any[]) => {
    console.log(`Диагностика для заказа #${selectedOrder} завершена. Неисправности:`, faults);
    // Здесь будет логика сохранения результатов диагностики
    setShowDiagnosticsModal(false);
  };

  // Функция для закрытия модального окна
  const handleCloseModal = () => {
    setShowDiagnosticsModal(false);
  };

  // Проверка сессии при загрузке компонента
  React.useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Получить токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');

      if (sessionToken) {
        const userData: User | null = await invoke('get_user_session', { sessionToken });

        if (userData && (userData.role === 'Diagnostician' || userData.role === 'Admin')) {
          setUser(userData);
        } else {
          // Перенаправить на форму входа, если сессия неактивна или роль не та
          window.location.hash = '#login';
        }
      } else {
        // Если нет токена сессии, перенаправить на вход
        window.location.hash = '#login';
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Перенаправить на форму входа в случае ошибки
      window.location.hash = '#login';
    }
  };

  const handleLogout = () => {
    // Сбросить данные сессии
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');

    // Перенаправить на страницу входа
    window.location.hash = '#login';
  };

  return (
    <div className="dashboard diagnostician-dashboard">
      <div className="dashboard-header">
        <h1>🔍 ДИАГНОСТ: {user?.full_name || 'Иванов И.И.'}</h1>
        <div className="header-buttons">
          {user?.role === 'Admin' && (
            <button
              className="admin-return-btn"
              onClick={() => window.location.hash = '#admin'}
              title="Вернуться в меню администратора"
            >
              🏠 Админ-панель
            </button>
          )}
          <button className="exit-button" onClick={handleLogout}>✖ ВЫХОД</button>
        </div>
      </div>

      <div className="dashboard-content">
        <h2>ОЖИДАЮТ ДИАГНОСТИКИ:</h2>

        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Автомобиль</th>
                <th>Гос. Номер</th>
                <th>Причина обращения</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr
                  key={order.id}
                  className={selectedOrder === order.id ? 'selected' : ''}
                  onClick={() => handleSelectOrder(order.id)}
                >
                  <td>{order.id}</td>
                  <td>{order.carModel}</td>
                  <td>{order.licensePlate}</td>
                  <td>{order.issueDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dashboard-actions">
          <button
            className="start-diagnosis-button"
            onClick={handleStartDiagnosis}
            disabled={selectedOrder === null}
          >
            📋 ПРОВЕСТИ ДИАГНОСТИКУ
          </button>
        </div>
      </div>

      {/* Модальное окно диагностики */}
      {showDiagnosticsModal && selectedOrder && (
        <DiagnosticsModal
          orderId={selectedOrder}
          clientComplaint={orders.find(o => o.id === selectedOrder)?.issueDescription || ''}
          onClose={handleCloseModal}
          onDiagnosisComplete={handleDiagnosisComplete}
        />
      )}
    </div>
  );
};

export default DiagnosticianDashboard;