import React, { useState } from 'react';
import './DiagnosticianDashboard.css';

// Типы данных для заказа и автомобиля
type Order = {
  id: number;
  carModel: string;
  licensePlate: string;
  issueDescription: string;
};

const DiagnosticianDashboard: React.FC = () => {
  // Состояние для списка заказов, ожидающих диагностики
  const [orders, setOrders] = useState<Order[]>([
    { id: 105, carModel: 'BMW X5', licensePlate: '1234 AB-7', issueDescription: 'Стук в подвеске' },
    { id: 108, carModel: 'Audi A6', licensePlate: '5678 CD-7', issueDescription: 'Горит Check Engine' }
  ]);

  // Состояние для выбранного заказа
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  // Функция для обработки выбора заказа
  const handleSelectOrder = (orderId: number) => {
    setSelectedOrder(orderId);
  };

  // Функция для начала диагностики
  const handleStartDiagnosis = () => {
    if (selectedOrder !== null) {
      // В реальном приложении здесь открылось бы окно диагностики
      alert(`Начинаем диагностику для заказа #${selectedOrder}`);
    }
  };

  return (
    <div className="dashboard diagnostician-dashboard">
      <div className="dashboard-header">
        <h1>🔍 ДИАГНОСТ: Иванов И.И.</h1>
        <button className="exit-button">✖ ВЫХОД</button>
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
    </div>
  );
};

export default DiagnosticianDashboard;