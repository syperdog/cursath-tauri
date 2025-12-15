import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CancelOrderModal.css';

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
}

interface CancelOrderModalProps {
  isOpen: boolean;
  order: Order | null;
  client: Client | null;
  car: Car | null;
  onClose: () => void;
  onCancelled: () => void;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  order,
  client,
  car,
  onClose,
  onCancelled
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !order) return null;

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Пожалуйста, укажите причину отмены');
      return;
    }

    setIsProcessing(true);
    try {
      await invoke('cancel_order', {
        orderId: order.id,
        reason: cancelReason.trim()
      });

      alert('Заказ успешно отменен');
      onCancelled();
      onClose();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Ошибка при отмене заказа: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚠️ ОТМЕНА ЗАКАЗА #{order.id}</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="warning-message">
            <p>Вы уверены, что хотите отменить этот заказ?</p>
          </div>

          <div className="order-info">
            <div className="info-row">
              <span className="label">👤 Клиент:</span>
              <span className="value">{client?.full_name || `Клиент #${order.client_id}`}</span>
            </div>
            <div className="info-row">
              <span className="label">🚗 Авто:</span>
              <span className="value">
                {car ? `${car.make} ${car.model}` : `Авто #${order.car_id}`}
                {car?.license_plate && ` (${car.license_plate})`}
              </span>
            </div>
            <div className="info-row">
              <span className="label">📅 Статус:</span>
              <span className="value status-badge">{order.status}</span>
            </div>
          </div>

          <div className="cancel-reason-section">
            <label htmlFor="cancelReason">ПРИЧИНА ОТМЕНЫ:</label>
            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Укажите причину отмены заказа..."
              rows={4}
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
            disabled={isProcessing}
          >
            ОТМЕНА
          </button>
          <button
            className="confirm-cancel-btn"
            onClick={handleConfirmCancel}
            disabled={isProcessing || !cancelReason.trim()}
          >
            {isProcessing ? 'ОБРАБОТКА...' : '❌ ПОДТВЕРДИТЬ ОТМЕНУ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;