import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './NewOrderModal.css';

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

interface NewOrderModalProps {
  isOpen: boolean;
  client: Client | null;
  car: Car | null;
  onClose: () => void;
  onOrderCreated: () => void;
}

const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  client,
  car,
  onClose,
  onOrderCreated
}) => {
  const [mileage, setMileage] = useState(car?.mileage.toString() || '');
  const [complaint, setComplaint] = useState('');
  const [previousMileage, setPreviousMileage] = useState(car?.mileage || 0);
  const [dateError, setDateError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newMileage = parseInt(mileage);
    if (isNaN(newMileage) || newMileage < previousMileage) {
      setDateError(`Пробег не может быть меньше предыдущего (${previousMileage} км)`);
      setLoading(false);
      return;
    }

    try {
      // Send the data to the backend to create the order
      const result = await invoke<string>('create_order', {
        clientId: client?.id,
        carId: car?.id,
        complaint,
        currentMileage: newMileage
      });

      console.log('Order creation result:', result);
      onOrderCreated();
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      setDateError(`Ошибка при создании заказа: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ НОВЫЙ ЗАКАЗ-НАРЯД</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="order-client-car">
            <div className="client-info">
              <h3>👤 КЛИЕНТ:</h3>
              {client ? (
                <>
                  <p><strong>{client.full_name}</strong></p>
                  <p>📞 {client.phone}</p>
                  <p>📍 {client.address || 'Адрес не указан'}</p>
                </>
              ) : (
                <p><em>Клиент не выбран</em></p>
              )}
            </div>

            <div className="car-info">
              <h3>🚗 АВТО:</h3>
              {car ? (
                <>
                  <p><strong>{car.make} {car.model}</strong></p>
                  <p>🏷️ {car.license_plate || 'Не указан'}</p>
                  <p>VIN: {car.vin || 'Не указан'}</p>
                </>
              ) : (
                <p><em>Автомобиль не выбран</em></p>
              )}
            </div>
          </div>

          <div className="order-mileage">
            <label htmlFor="mileage">🔢 ТЕКУЩИЙ ПРОБЕГ (км):</label>
            <input
              id="mileage"
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Введите пробег"
              min={previousMileage}
              required
            />
            {car && previousMileage && (
              <p className="previous-mileage">
                ℹ️ Предыдущий пробег: {previousMileage} км ({car.last_visit_date ? new Date(car.last_visit_date).toLocaleDateString() : 'не указан'})
              </p>
            )}
            {dateError && <p className="error-message">{dateError}</p>}
          </div>

          <div className="order-complaint">
            <label htmlFor="complaint">📝 ПРИЧИНА ОБРАЩЕНИЯ:</label>
            <textarea
              id="complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Опишите жалобы клиента..."
              required
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="create-btn" disabled={loading}>
              {loading ? 'СОЗДАНИЕ...' : '🚀 СОЗДАТЬ ЗАКАЗ'}
            </button>
            <button type="button" onClick={() => onClose()} className="cancel-btn" disabled={loading}>
              ОТМЕНА
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewOrderModal;