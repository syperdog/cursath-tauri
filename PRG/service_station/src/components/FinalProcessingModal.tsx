import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './FinalProcessingModal.css';

interface Order {
  id: number;
  total_amount: string | null;
  prepayment: string | null;
  client_id: number;
  car_id: number;
  worker_id: number | null; // Main worker assigned to the entire order
  master_id: number | null;
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  created_at: string;
  completed_at: string | null;
  // другие поля заказа
}

interface Client {
  id: number;
  full_name: string;
  // другие поля клиента
}

interface Car {
  id: number;
  make: string;
  model: string;
  license_plate: string | null;
  // другие поля автомобиля
}

interface FinalProcessingModalProps {
  isOpen: boolean;
  order: Order;
  client: Client | null;
  car: Car | null;
  onClose: () => void;
  onCompletion: () => void;
}

const FinalProcessingModal: React.FC<FinalProcessingModalProps> = ({
  isOpen,
  order,
  client,
  car,
  onClose,
  onCompletion
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('card');
  const [prepaymentAmount, setPrepaymentAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (order && order.total_amount) {
      const total = parseFloat(order.total_amount);
      const prepayment = order.prepayment ? parseFloat(order.prepayment) : 0;
      setPrepaymentAmount(prepayment);
      setFinalAmount(total - prepayment);
    }
  }, [order]);

  const handlePrintReceipt = () => {
    // В реальной реализации отправляем запрос на печать чека
    console.log('Печать чека/акта выполненных работ');
  };

  const handleConfirmDelivery = async () => {
    setIsProcessing(true);
    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      // Обновляем статус заказа на "Closed" (окончательно закрыт)
      await invoke('update_order_status', {
        sessionToken,
        orderId: order.id,
        newStatus: 'Closed'
      });

      console.log('Заказ подтвержден к выдаче');
      onCompletion();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Ошибка при завершении заказа: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏁 ОКОНЧАТЕЛЬНОЕ ЗАВЕРШЕНИЕ: Заказ #{order.id}</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="client-car-info">
            <p><strong>👤 КЛИЕНТ:</strong> {client?.full_name || 'N/A'}</p>
            <p><strong>🚗 АВТО:</strong> {car ? `${car.make} ${car.model} (${car.license_plate || 'No plate'})` : 'N/A'}</p>
            <p><strong>📅 ДАТА ПРИЕМКИ:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
            <p><strong>📅 ДАТА ЗАВЕРШЕНИЯ:</strong> {new Date().toLocaleDateString()}</p>
          </div>

          <div className="payment-breakdown">
            <h3>💰 ИТОГОВАЯ СУММА:</h3>
            <div className="payment-details">
              <div className="payment-line total">
                <span>ВСЕГО:</span>
                <span>{order.total_amount || '0'} $</span>
              </div>
              <div className="payment-line discount">
                <span>Оплачено ранее (аванс):</span>
                <span>- {prepaymentAmount} $</span>
              </div>
              <div className="payment-line final total">
                <span>К ДОПЛАТЕ:</span>
                <span>{finalAmount} $</span>
              </div>
            </div>
          </div>

          <div className="payment-method">
            <h3>ОПЛАТА:</h3>
            <div className="payment-options">
              <label>
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                Наличные
              </label>
              <label>
                <input
                  type="radio"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                Карта
              </label>
              <label>
                <input
                  type="radio"
                  value="bank_transfer"
                  checked={paymentMethod === 'bank_transfer'}
                  onChange={() => setPaymentMethod('bank_transfer')}
                />
                Безналичный (Р/С)
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="print-btn" onClick={handlePrintReceipt}>
            🖨️ ПЕЧАТЬ ЧЕКА
          </button>
          <button
            className="confirm-delivery-btn"
            onClick={handleConfirmDelivery}
            disabled={isProcessing}
          >
            {isProcessing ? 'Обработка...' : '✅ ОКОНЧАТЕЛЬНО ЗАВЕРШИТЬ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalProcessingModal;