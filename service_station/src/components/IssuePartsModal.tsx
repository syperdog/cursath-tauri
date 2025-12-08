import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './IssuePartsModal.css';

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

interface Worker {
  id: number;
  full_name: string;
  role: string;
  login: string | null;
  status: string;
}

interface PartItem {
  id: number;
  name: string;
  brand: string;
  quantity: number;
  storage_location: string;
  status: string;
}

interface IssuePartsModalProps {
  isOpen: boolean;
  order: Order;
  onClose: () => void;
  onIssueConfirmed: () => void;
}

const IssuePartsModal: React.FC<IssuePartsModalProps> = ({ 
  isOpen, 
  order, 
  onClose, 
  onIssueConfirmed 
}) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [partItems, setPartItems] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadOrderDetails();
    }
  }, [isOpen]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      // В реальном приложении загружаем данные о назначенном работнике и запчастях к выдаче
      // Временно используем заглушку
      const mockWorker: Worker = {
        id: 1,
        full_name: "Сидоров С.С.",
        role: "Worker",
        login: "sidorov",
        status: "Active"
      };
      
      const mockParts: PartItem[] = [
        {
          id: 1,
          name: "Рычаг передний лев.",
          brand: "Lemforder",
          quantity: 1,
          storage_location: "A-12-05",
          status: "В наличии"
        },
        {
          id: 2,
          name: "Колодки торм.",
          brand: "Patron",
          quantity: 1,
          storage_location: "B-03-11",
          status: "В наличии"
        }
      ];
      
      setWorker(mockWorker);
      setPartItems(mockParts);
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmIssue = async () => {
    try {
      // В реальном приложении вызываем API для подтверждения выдачи запчастей
      // и списания их со склада
      console.log('Confirming part issuance for order:', order.id);
      onIssueConfirmed();
      onClose();
    } catch (error) {
      console.error('Error confirming part issuance:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 ВЫДАЧА В ЦЕХ: Заказ #{order.id} ({order.id})</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="recipient-section">
            <h3>ПОЛУЧАТЕЛЬ:</h3>
            {worker ? (
              <p>{worker.full_name} ({worker.role})</p>
            ) : (
              <p>Не назначен</p>
            )}
          </div>

          <div className="parts-to-issue-section">
            <h3>СПИСОК К ВЫДАЧЕ:</h3>
            {loading ? (
              <p>Загрузка списка запчастей...</p>
            ) : partItems.length > 0 ? (
              <table className="parts-issue-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Деталь / Бренд</th>
                    <th>Кол-во</th>
                    <th>Склад</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {partItems.map(part => (
                    <tr key={part.id}>
                      <td>{part.id}</td>
                      <td>
                        <div>{part.name}</div>
                        <div className="part-brand">{part.brand}</div>
                      </td>
                      <td>{part.quantity} шт.</td>
                      <td>{part.storage_location}</td>
                      <td>{part.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Нет запчастей к выдаче.</p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="primary-btn" onClick={handleConfirmIssue}>
            📤 ПОДТВЕРДИТЬ ВЫДАЧУ И СПИСАТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssuePartsModal;