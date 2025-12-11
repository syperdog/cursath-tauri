import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './WorkerDashboard.css';
import OrderExecutionModal from './OrderExecutionModal';

// Define TypeScript interfaces
interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  worker_id: number | null; // Main worker assigned to the entire order
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  prepayment: string | null;
  total_amount: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Part {
  id: number;
  name: string;
  brand?: string;
  status: 'Received' | 'Ordered' | 'InStock';
}

interface WorkItem {
  id: number;
  description: string;
  estimatedHours: number;
  status: 'Completed' | 'In Progress' | 'Pending';
  checked: boolean;
}

interface User {
  id: number;
  full_name: string;
  role: string;
  login: string;
  status: string;
  pin_code: string;
}

const WorkerDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [workerName, setWorkerName] = useState<string>('Worker Name');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderExecutionModal, setShowOrderExecutionModal] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cars, setCars] = useState<Record<number, { make: string; model: string; license_plate: string }>>({});
  const [currentTime, setCurrentTime] = useState<string>('');

  // Update the current time every minute
  useEffect(() => {
    // Update time immediately
    updateTime();

    // Set up interval to update time every minute
    const interval = setInterval(updateTime, 60000);

    // Clean up interval
    return () => clearInterval(interval);
  }, []);

  // Load worker dashboard data
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Получить токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');

      if (sessionToken) {
        const userData: User | null = await invoke('get_user_session', { sessionToken });

        if (userData && (userData.role === 'Worker' || userData.role === 'Admin')) {
          setUser(userData);
          // Установим имя работника из данных пользователя
          setWorkerName(userData.full_name);

          // Загрузим заказы, назначенные на этого работника
          if (userData.role === 'Worker') {
            await loadWorkerOrders(userData.id);
          }
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

  const loadWorkerOrders = async (workerId: number) => {
    try {
      const ordersData = await invoke<Order[]>('get_orders_for_worker', { workerId });
      setOrders(ordersData);

      // Загрузим информацию об автомобилях для отображения
      const uniqueCarIds = [...new Set(ordersData.map(order => order.car_id))];
      for (const carId of uniqueCarIds) {
        if (!cars[carId]) {
          try {
            const carData = await invoke<any>('get_car_by_id', { carId });
            if (carData) {
              setCars(prev => ({ ...prev, [carId]: {
                make: carData.make,
                model: carData.model,
                license_plate: carData.license_plate || 'Нет номера'
              }}));
            }
          } catch (error) {
            console.error(`Error loading car ${carId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading worker orders:', error);
    }
  };

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleOpenOrder = () => {
    if (selectedOrder) {
      setShowOrderExecutionModal(true);
    }
  };

  const handleLogout = () => {
    // Reset the session and redirect to login
    localStorage.removeItem('sessionToken');
    window.location.hash = '#login';
  };

  return (
    <div className="worker-dashboard">
      <header className="dashboard-header">
        <div className="header-info">
          <h1>🔧 РАБОТНИК: {user?.full_name || workerName}</h1>
          <div className="header-time">{currentTime}</div>
        </div>
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
          <button className="logout-button" onClick={handleLogout}>✖ ВЫХОД</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="my-tasks">
          <h2>МОИ ЗАДАЧИ (В РАБОТЕ):</h2>
          <div className="orders-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Автомобиль</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const carInfo = cars[order.car_id];
                  const carDisplay = carInfo ? `${carInfo.make} ${carInfo.model} (${carInfo.license_plate})` : `Авто #${order.car_id}`;
                  return (
                    <tr
                      key={order.id}
                      className={selectedOrder?.id === order.id ? 'selected' : ''}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td>{order.id}</td>
                      <td>{carDisplay}</td>
                      <td>{order.status}</td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="no-orders">Нет назначенных задач</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="action-buttons">
          <button 
            className="open-order-button" 
            onClick={handleOpenOrder}
            disabled={!selectedOrder}
          >
            🔧 ОТКРЫТЬ ЗАКАЗ-НАРЯД
          </button>
        </div>
      </main>

      {showOrderExecutionModal && selectedOrder && (
        <OrderExecutionModal
          orderId={selectedOrder.id}
          onClose={() => setShowOrderExecutionModal(false)}
          onOrderComplete={async () => {
            // Обновляем список заказов после завершения заказа
            if (user) {
              await loadWorkerOrders(user.id);
            }
          }}
        />
      )}
    </div>
  );
};

export default WorkerDashboard;