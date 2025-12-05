import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './WorkerDashboard.css';
import OrderExecutionModal from './OrderExecutionModal';

// Define TypeScript interfaces
interface Order {
  id: number;
  car: string;
  status: string;
  estimatedTime?: string;
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

const WorkerDashboard: React.FC = () => {
  const [workerName, setWorkerName] = useState<string>('Worker Name');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderExecutionModal, setShowOrderExecutionModal] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
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
    loadWorkerData();
  }, []);

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const loadWorkerData = async () => {
    // In a real implementation, this would fetch data from the backend
    // For now, we'll use mock data based on the specifications in q.txt
    
    const mockOrders: Order[] = [
      {
        id: 105,
        car: 'BMW X5',
        status: 'Ожидает начала',
      },
      {
        id: 112,
        car: 'Audi Q7',
        status: 'В работе (01:15)',
      }
    ];
    
    setOrders(mockOrders);
    setWorkerName('Сидоров С.С.');
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
          <h1>🔧 РАБОТНИК: {workerName}</h1>
          <div className="header-time">{currentTime}</div>
        </div>
        <button className="logout-button" onClick={handleLogout}>✖ ВЫХОД</button>
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
                {orders.map(order => (
                  <tr 
                    key={order.id} 
                    className={selectedOrder?.id === order.id ? 'selected' : ''}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td>{order.id}</td>
                    <td>{order.car}</td>
                    <td>{order.status}</td>
                  </tr>
                ))}
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
        />
      )}
    </div>
  );
};

export default WorkerDashboard;