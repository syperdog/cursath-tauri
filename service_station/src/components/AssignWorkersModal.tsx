import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './AssignWorkersModal.css';

interface Worker {
  id: number;
  full_name: string;
  role: string;
  status: string;
}

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

interface Work {
  id: number;
  order_id: number;
  service_id?: number;
  service_name_snapshot: string;
  price: string; // Changed to string for DECIMAL compatibility
  worker_id?: number | null;
  status: string;
  is_confirmed: boolean;
}

interface AssignWorkersModalProps {
  isOpen: boolean;
  order: Order;
  works: Work[];
  onClose: () => void;
  onAssignmentSaved: () => void;
}

const AssignWorkersModal: React.FC<AssignWorkersModalProps> = ({
  isOpen,
  order,
  works,
  onClose,
  onAssignmentSaved
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      console.log('AssignWorkersModal: Opening for order:', order);
      loadWorkers();
      
      // Устанавливаем выбранного работника, если он уже назначен
      if (order.worker_id) {
        setSelectedWorkerId(order.worker_id);
      }
    }
  }, [isOpen, order]);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const workersData = await invoke<Worker[]>('get_available_workers');
      setWorkers(workersData);
    } catch (error) {
      console.error('Error loading workers:', error);
      alert('Ошибка загрузки списка работников: ' + error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getAvailableWorkers = () => {
    // Return all available workers - in a real app this could be filtered by specialization
    return workers.filter(worker => worker.status === 'Active');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkerId) {
      alert('Пожалуйста, выберите исполнителя для выполнения работ');
      return;
    }

    setIsProcessing(true);
    try {
      // Send assignment to backend with main worker
      // We'll pass an empty array for work assignments since we're only assigning the main worker
      await invoke('assign_workers_to_order', {
        orderId: order.id,
        workAssignments: [], // Не назначаем индивидуальные работы, только основного исполнителя
        mainWorkerId: selectedWorkerId
      });

      console.log('Main worker assigned successfully');
      onAssignmentSaved();
      onClose();
    } catch (error) {
      console.error('Error assigning main worker:', error);
      alert('Ошибка при назначении исполнителя: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👷 НАЗНАЧЕНИЕ ИСПОЛНИТЕЛЯ (Заказ #{order.id})</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="order-info">
            <p><strong>Заказ:</strong> #{order.id}</p>
            <p><strong>Статус заказа:</strong> {order.status}</p>
            <p><strong>Жалоба клиента:</strong> {order.complaint || 'Не указана'}</p>
          </div>

          {loading ? (
            <div className="loading">Загрузка списка работников...</div>
          ) : (
            <div className="worker-selection-section">
              <h3>ВЫБОР ИСПОЛНИТЕЛЯ:</h3>
              
              <div className="worker-selection-form">
                <label htmlFor="worker-select">ИСПОЛНИТЕЛЬ:</label>
                <select
                  id="worker-select"
                  value={selectedWorkerId || ''}
                  onChange={(e) => setSelectedWorkerId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Выберите исполнителя</option>
                  {getAvailableWorkers().map(worker => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Отладочная информация */}
              <div style={{ backgroundColor: '#f0f0f0', padding: '10px', marginBottom: '10px', fontSize: '12px' }}>
                <strong>ИНФОРМАЦИЯ:</strong><br/>
                Всего работ в заказе: {works.length}<br/>
                Подтвержденных работ: {works.filter(work => work.is_confirmed).length}<br/>
                Доступных работников: {workers.length}<br/>
                Выбранный исполнитель: {selectedWorkerId ? `ID ${selectedWorkerId}` : 'не выбран'}
              </div>

              {/* Список подтвержденных работ для информации */}
              <div className="confirmed-works-info">
                <h4>ПОДТВЕРЖДЕННЫЕ РАБОТЫ:</h4>
                {works.filter(work => work.is_confirmed).length > 0 ? (
                  <ul>
                    {works.filter(work => work.is_confirmed).map(work => (
                      <li key={work.id}>
                        {work.service_name_snapshot} - {parseFloat(work.price || '0').toFixed(2)} $
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Нет подтвержденных работ</p>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="submit"
              className="save-btn"
              disabled={isProcessing || loading || !selectedWorkerId}
            >
              {isProcessing ? 'Обработка...' : '💾 СОХРАНИТЬ И ПЕРЕДАТЬ В ЦЕХ'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
              disabled={isProcessing}
            >
              ОТМЕНА
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignWorkersModal;