import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ArchivedOrderModal.css';

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  worker_id: number | null; // Main worker assigned to the entire order
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  total_amount: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Client {
  id: number;
  full_name: string;
  phone: string;
}

interface Car {
  id: number;
  make: string;
  model: string;
  license_plate: string | null;
  vin: string | null;
}

interface Work {
  id: number;
  service_name_snapshot: string;
  price: string;
  status: string;
}

interface Part {
  id: number;
  part_name_snapshot: string;
  brand: string;
  quantity: number;
  price_per_unit: string;
}

interface ArchivedOrderModalProps {
  isOpen: boolean;
  orderId: number | null;
  onClose: () => void;
}

const ArchivedOrderModal: React.FC<ArchivedOrderModalProps> = ({
  isOpen,
  orderId,
  onClose
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      loadArchivedOrderData();
    }
  }, [isOpen, orderId]);

  const loadArchivedOrderData = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      // Загружаем данные заказа
      const orderData = await invoke<Order>('get_order_by_id', { orderId });
      setOrder(orderData);

      // Загружаем данные клиента
      const clientData = await invoke<Client>('get_client_by_id', { 
        clientId: orderData.client_id 
      });
      setClient(clientData);

      // Загружаем данные автомобиля
      const carData = await invoke<Car>('get_car_by_id', { 
        carId: orderData.car_id 
      });
      setCar(carData);

      // Загружаем выполненные работы
      const worksData = await invoke<Work[]>('get_order_works_by_order_id', { 
        orderId 
      });
      setWorks(worksData.filter(work => work.status === 'Done'));

      // Загружаем использованные запчасти
      const partsData = await invoke<Part[]>('get_order_parts_by_order_id', { 
        orderId 
      });
      setParts(partsData);

    } catch (error) {
      console.error('Error loading archived order data:', error);
      alert('Ошибка при загрузке данных заказа: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const calculateWorksTotal = () => {
    return works.reduce((sum, work) => sum + parseFloat(work.price), 0);
  };

  const calculatePartsTotal = () => {
    return parts.reduce((sum, part) => 
      sum + (parseFloat(part.price_per_unit) * part.quantity), 0
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            🗄️ АРХИВ: Заказ-наряд #{orderId} 
            {order && ` от ${formatDate(order.created_at)}`}
          </h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading">
              <p>Загрузка данных заказа...</p>
            </div>
          ) : order ? (
            <>
              <div className="order-header-info">
                <div className="info-row">
                  <span className="label">👤 КЛИЕНТ:</span>
                  <span className="value">{client?.full_name || 'Неизвестен'}</span>
                </div>
                <div className="info-row">
                  <span className="label">🚗 АВТО:</span>
                  <span className="value">
                    {car ? `${car.make} ${car.model}` : 'Неизвестен'}
                    {car?.license_plate && ` (${car.license_plate})`}
                    {order.current_mileage && ` | Пробег: ${order.current_mileage.toLocaleString()} км`}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">📝 ПРИЧИНА:</span>
                  <span className="value">{order.complaint || 'Не указана'}</span>
                </div>
              </div>

              <div className="works-and-parts-section">
                <h3>📋 ВЫПОЛНЕННЫЕ РАБОТЫ И ЗАПЧАСТИ:</h3>
                
                {works.length > 0 && (
                  <div className="works-section">
                    <h4>🔧 РАБОТЫ:</h4>
                    <div className="items-list">
                      {works.map((work) => (
                        <div key={work.id} className="item-row">
                          <span className="item-name">{work.service_name_snapshot}</span>
                          <span className="item-price">
                            {parseFloat(work.price).toFixed(2)} $
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parts.length > 0 && (
                  <div className="parts-section">
                    <h4>📦 ЗАПЧАСТИ:</h4>
                    <div className="items-list">
                      {parts.map((part) => (
                        <div key={part.id} className="item-row">
                          <span className="item-name">
                            {part.part_name_snapshot} ({part.brand}) x{part.quantity}
                          </span>
                          <span className="item-price">
                            {(parseFloat(part.price_per_unit) * part.quantity).toFixed(2)} $
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {works.length === 0 && parts.length === 0 && (
                  <div className="no-items">
                    <p>Нет данных о выполненных работах и запчастях.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="error">
              <p>Не удалось загрузить данные заказа.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {order && (
            <div className="total-amount">
              ИТОГО ОПЛАЧЕНО: {order.total_amount ? `${parseFloat(order.total_amount).toFixed(2)} $` : '0.00 $'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivedOrderModal;