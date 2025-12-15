import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CarHistoryModal.css';

interface Car {
  id: number;
  make: string;
  model: string;
  license_plate: string | null;
  vin: string | null;
}

interface HistoryOrder {
  id: number;
  created_at: string;
  completed_at: string | null;
  current_mileage: number | null;
  complaint: string | null;
  total_amount: string | null;
  status: string;
}

interface CarHistoryModalProps {
  isOpen: boolean;
  car: Car | null;
  onClose: () => void;
  onOrderSelect?: (orderId: number) => void;
}

const CarHistoryModal: React.FC<CarHistoryModalProps> = ({
  isOpen,
  car,
  onClose,
  onOrderSelect
}) => {
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && car) {
      loadCarHistory();
    }
  }, [isOpen, car]);

  const loadCarHistory = async () => {
    if (!car) return;

    setLoading(true);
    try {
      const history = await invoke<HistoryOrder[]>('get_car_service_history', {
        carId: car.id
      });
      setHistoryOrders(history);
    } catch (error) {
      console.error('Error loading car history:', error);
      setHistoryOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'Closed': return '✅';
      case 'Cancelled': return '❌';
      case 'In_Work': return '🔧';
      case 'Ready': return '🏁';
      default: return '📋';
    }
  };

  if (!isOpen || !car) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            🕒 ИСТОРИЯ ОБСЛУЖИВАНИЯ: {car.make} {car.model}
            {car.license_plate && ` (${car.license_plate})`}
          </h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          {car.vin && (
            <div className="car-info">
              <p><strong>VIN:</strong> {car.vin}</p>
            </div>
          )}

          {loading ? (
            <div className="loading">
              <p>Загрузка истории обслуживания...</p>
            </div>
          ) : historyOrders.length > 0 ? (
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Дата</th>
                    <th>Пробег</th>
                    <th>Причина обращения</th>
                    <th>Статус</th>
                    <th>Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="history-row"
                      onClick={() => onOrderSelect && onOrderSelect(order.id)}
                    >
                      <td>{order.id}</td>
                      <td>{formatDate(order.created_at)}</td>
                      <td>
                        {order.current_mileage 
                          ? `${order.current_mileage.toLocaleString()} км`
                          : '—'
                        }
                      </td>
                      <td className="complaint-cell">
                        {order.complaint || 'Не указана'}
                      </td>
                      <td>
                        <span className="status-badge">
                          {getStatusEmoji(order.status)} {order.status}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {order.total_amount 
                          ? `${parseFloat(order.total_amount).toFixed(2)} $`
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-history">
              <p>История обслуживания для данного автомобиля отсутствует.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-footer-btn" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarHistoryModal;