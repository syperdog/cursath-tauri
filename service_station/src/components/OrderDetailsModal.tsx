import React from 'react';
import './OrderDetailsModal.css';

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  prepayment: string | null;
  total_amount: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Client {
  id: number;
  full_name: string;
  phone: string;
  address: string | null;
  created_at: string;
}

interface Car {
  id: number;
  client_id: number;
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  production_year: number | null;
  mileage: number;
  last_visit_date: string | null;
  created_at: string;
}

interface OrderDetailsModalProps {
  order: Order | null;
  client: Client | null;
  car: Car | null;
  isOpen: boolean;
  onClose: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  client,
  car,
  isOpen,
  onClose
}) => {
  if (!isOpen || !order) return null;

  // Статусы заказов с эмодзи
  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'New': return '🆕';
      case 'Diagnostics': return '🔍';
      case 'Parts_Selection': return '📦';
      case 'Approval': return '📋';
      case 'In_Work': return '🔧';
      case 'Quality_Control': return '✅';
      case 'Ready': return '🏁';
      case 'Closed': return '🔒';
      case 'Cancelled': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Заказ-наряд #{order.id}</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>
        
        <div className="modal-body">
          <div className="order-details">
            <div className="client-info">
              <h3>👤 КЛИЕНТ:</h3>
              <p>{client ? `${client.full_name}` : `Клиент #${order.client_id}`}</p>
              <p>{client?.phone || ''}</p>
            </div>
            
            <div className="car-info">
              <h3>🚗 АВТО:</h3>
              <p>
                {car 
                  ? `${car.make} ${car.model} (${car.license_plate || 'Нет номера'})` 
                  : `Авто #${order.car_id}`
                }
              </p>
              <p>VIN: {car?.vin || 'Не указан'}</p>
            </div>
            
            <div className="status-info">
              <h3>🔧 СТАТУС ЗАКАЗА:</h3>
              <p className="status-badge">
                {getStatusEmoji(order.status)} {order.status}
              </p>
            </div>
          </div>
          
          <div className="order-complaint">
            <h3>📝 ПРИЧИНА ОБРАЩЕНИЯ:</h3>
            <p>{order.complaint || 'Не указана'}</p>
          </div>
          
          <div className="order-mileage">
            <h3>🔢 ПРОБЕГ:</h3>
            <p>{order.current_mileage !== null ? `${order.current_mileage} км` : 'Не указан'}</p>
          </div>
          
          <div className="order-payment">
            <h3>💰 ФИНАНСОВАЯ ИНФОРМАЦИЯ:</h3>
            <div className="payment-details">
              <p>Предоплата: {order.prepayment || '0 $'}</p>
              <p>Итоговая сумма: {order.total_amount || '---- $'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;