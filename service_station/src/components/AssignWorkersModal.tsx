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
  const [workAssignments, setWorkAssignments] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      console.log('AssignWorkersModal: Opening with works:', works);
      loadWorkers();
      // Initialize assignments with existing worker assignments
      const initialAssignments = works.reduce((acc, work) => {
        acc[work.id] = work.worker_id || null;
        return acc;
      }, {} as Record<number, number | null>);
      console.log('AssignWorkersModal: Initial assignments:', initialAssignments);
      setWorkAssignments(initialAssignments);
    }
  }, [isOpen, works]);

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

  const handleWorkerChange = (workId: number, workerId: number | null) => {
    setWorkAssignments(prev => ({
      ...prev,
      [workId]: workerId
    }));
  };

  const getAvailableWorkers = () => {
    // Return all available workers - in a real app this could be filtered by specialization
    return workers.filter(worker => worker.status === 'Active');
  };

  const [mainWorkerId, setMainWorkerId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that all confirmed works have assigned workers
    const confirmedWorks = works.filter(work => work.is_confirmed);
    const unassignedWorks = confirmedWorks.filter(work => !workAssignments[work.id]);
    if (unassignedWorks.length > 0) {
      alert('Пожалуйста, назначьте исполнителей для всех подтвержденных работ');
      return;
    }

    setIsProcessing(true);
    try {
      // Prepare work assignments for backend (only for confirmed works)
      const confirmedWorks = works.filter(work => work.is_confirmed);
      const assignments: [number, number][] = confirmedWorks
        .filter(work => workAssignments[work.id])
        .map(work => [work.id, workAssignments[work.id]!]);

      // Send assignments to backend with main worker
      await invoke('assign_workers_to_order', {
        orderId: order.id,
        workAssignments: assignments,
        mainWorkerId: mainWorkerId || null
      });

      console.log('Workers assigned successfully');
      onAssignmentSaved();
      onClose();
    } catch (error) {
      console.error('Error assigning workers:', error);
      alert('Ошибка при назначении работников: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👷 НАЗНАЧЕНИЕ ИСПОЛНИТЕЛЕЙ (Заказ #{order.id})</h2>
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
            <div className="works-section">
              <h3>СПИСОК СОГЛАСОВАННЫХ РАБОТ:</h3>

              {/* Поле для выбора основного исполнителя */}
              <div className="main-worker-section">
                <label htmlFor="main-worker-select">ОСНОВНОЙ ИСПОЛНИТЕЛЬ ЗАКАЗА:</label>
                <select
                  id="main-worker-select"
                  value={mainWorkerId || ''}
                  onChange={(e) => setMainWorkerId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Не выбран (опционально)</option>
                  {getAvailableWorkers().map(worker => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </option>
                  ))}
                </select>
                <p><small>Выберите основного исполнителя для всего заказа (опционально)</small></p>
              </div>

              {/* Отладочная информация */}
              <div style={{ backgroundColor: '#f0f0f0', padding: '10px', marginBottom: '10px', fontSize: '12px' }}>
                <strong>DEBUG INFO:</strong><br/>
                Всего работ: {works.length}<br/>
                Подтвержденных работ: {works.filter(work => work.is_confirmed).length}<br/>
                Работников загружено: {workers.length}<br/>
                Основной исполнитель: {mainWorkerId ? `ID ${mainWorkerId}` : 'не назначен'}<br/>
                {works.length > 0 && (
                  <>
                    Пример работы: ID={works[0].id}, confirmed={works[0].is_confirmed ? 'true' : 'false'}<br/>
                  </>
                )}
              </div>

              <table className="works-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Работа</th>
                    <th>Цена</th>
                    <th>Подтверждено</th>
                    <th>Исполнитель</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map(work => (
                    <tr key={work.id} style={work.is_confirmed ? {} : { opacity: 0.6, fontStyle: 'italic' }}>
                      <td>{work.id}</td>
                      <td>{work.service_name_snapshot}</td>
                      <td>{parseFloat(work.price || '0').toFixed(2)} $</td>
                      <td>{work.is_confirmed ? '✅' : '❌'}</td>
                      <td>
                        <select
                          value={workAssignments[work.id] || ''}
                          onChange={(e) => handleWorkerChange(work.id, e.target.value ? parseInt(e.target.value) : null)}
                          required
                        >
                          <option value="">Выберите исполнителя</option>
                          {getAvailableWorkers().map(worker => (
                            <option key={worker.id} value={worker.id}>
                              {worker.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {works.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7' }}>
                  <p><strong>Нет работ для назначения</strong></p>
                  <p>Возможные причины:</p>
                  <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                    <li>Работы не были добавлены через диагностику</li>
                    <li>Ошибка при сохранении работ в базу данных</li>
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <div className="modal-actions">
            <button 
              type="submit" 
              className="save-btn"
              disabled={isProcessing || loading}
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