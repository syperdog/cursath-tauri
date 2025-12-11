import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './OrderExecutionModal.css';

// Define TypeScript interfaces
interface WorkItem {
  id: number;
  order_id: number;
  service_id?: number;
  service_name_snapshot: string;
  price: string; // Changed to string for DECIMAL compatibility
  worker_id?: number | null;
  status: string;
  is_confirmed: boolean;
}

interface Part {
  id: number;
  order_id: number;
  warehouse_item_id?: number | null;
  part_name_snapshot: string;
  brand: string;
  price_per_unit: string; // Changed to string for DECIMAL compatibility
  quantity: number;
  is_confirmed: boolean;
}

interface Defect {
  id: number;
  order_id: number;
  diagnostician_id: number;
  defect_description: string;
  diagnostician_comment: string | null;
  is_confirmed: boolean;
}

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  worker_id: number | null;
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  prepayment: string | null;
  total_amount: string | null;
  created_at: string;
  completed_at: string | null;
}

interface OrderExecutionModalProps {
  orderId: number;
  onClose: () => void;
}

const OrderExecutionModal: React.FC<OrderExecutionModalProps> = ({ orderId, onClose }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState<number | null>(null);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        // Получаем ID текущего пользователя из сессии
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
          throw new Error('Session token not found');
        }

        const userData = await invoke('get_user_session', { sessionToken });
        if (!userData) {
          throw new Error('User data not found');
        }

        const workerId = userData.id;

        // Получаем детали заказа для работника
        const [orderData, worksData, partsData, defectsData] =
          await invoke<[Order, WorkItem[], Part[], Defect[]]>('get_order_details_for_worker', {
            orderId,
            workerId
          });

        setOrder(orderData);
        setWorks(worksData);
        setParts(partsData);
        setDefects(defectsData);
      } catch (error) {
        console.error('Error fetching order details:', error);
        alert('Ошибка при загрузке данных заказа: ' + error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  const getStatusIcon = (status: string) => {
    const statusMap: Record<string, string> = {
      'Completed': '✅',
      'In Progress': '🔄',
      'Pending': '⏳',
      'Received': '✅',
      'Ordered': '⏳',
      'InStock': '📦',
      'In_Work': '🔧',
      'Done': '✅'
    };
    return statusMap[status] || '❓';
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'Completed': 'Готово',
      'In Progress': 'В работе',
      'Pending': 'Ожидание',
      'Received': 'Получено',
      'Ordered': 'Заказано',
      'InStock': 'На складе',
      'In_Work': 'В работе',
      'Done': 'Выполнено'
    };
    return statusMap[status] || status;
  };

  const toggleWorkStatus = (id: number) => {
    setWorks(works.map(work =>
      work.id === id
        ? {
            ...work,
            status: work.status === 'Done' ? 'Pending' : 'Done'
          }
        : work
    ));
  };

  const handleStartWork = () => {
    if (selectedWork !== null) {
      setWorks(works.map(work =>
        work.id === selectedWork
          ? { ...work, status: 'In Progress' }
          : work
      ));
    }
  };

  const handleMarkCompleted = () => {
    if (selectedWork !== null) {
      setWorks(works.map(work =>
        work.id === selectedWork
          ? { ...work, status: 'Done' }
          : work
      ));
    }
  };

  const handleFinishOrder = async () => {
    // Check if all works are completed
    const allCompleted = works.every(work => work.status === 'Done' || work.status === 'Completed');

    if (allCompleted) {
      try {
        // Обновляем статус заказа
        await invoke('update_order_status', {
          orderId: order!.id,
          newStatus: 'Ready' // заказ готов к выдаче
        });
        alert(`Заказ ${orderId} завершен и готов к выдаче!`);
        onClose();
      } catch (error) {
        console.error('Error updating order status:', error);
        alert('Ошибка при завершении заказа: ' + error);
      }
    } else {
      alert('Не все работы выполнены. Завершите все работы перед сдачей заказа.');
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="order-execution-modal">
          <div className="modal-header">
            <h2>🔧 ЗАГРУЗКА ДАННЫХ: ЗАКАЗ #{orderId}</h2>
            <button className="close-button" onClick={onClose}>✖</button>
          </div>
          <div className="loading">Загрузка данных заказа...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="order-execution-modal">
        <div className="modal-header">
          <h2>🔧 ЗАКАЗ #{order?.id}: ЗАГРУЗКА АВТОМОБИЛЯ</h2>
          <button className="close-button" onClick={onClose}>✖</button>
        </div>

        <div className="modal-content">
          <section className="works-section">
            <h3>НЕОБХОДИМЫЕ РАБОТЫ:</h3>
            <div className="works-table">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Наименование работ</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {works.map(work => (
                    <tr
                      key={work.id}
                      className={selectedWork === work.id ? 'selected-work' : ''}
                      onClick={() => setSelectedWork(work.id)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={work.status === 'Done' || work.status === 'Completed'}
                          onChange={() => toggleWorkStatus(work.id)}
                        />
                      </td>
                      <td>{work.service_name_snapshot}</td>
                      <td>
                        <span className="status-badge">
                          {getStatusIcon(work.status)} {getStatusText(work.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="parts-section">
            <h3>ИСПОЛЬЗУЕМЫЕ ЗАПЧАСТИ:</h3>
            <div className="parts-table">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>Деталь</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(part => (
                    <tr key={part.id}>
                      <td>{getStatusIcon(part.is_confirmed ? 'Received' : 'Ordered')}</td>
                      <td>
                        {part.part_name_snapshot} ({part.brand}) x{part.quantity}
                      </td>
                      <td>
                        <span className="status-badge">
                          {getStatusText(part.is_confirmed ? 'Received' : 'Ordered')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="modal-actions">
          <button className="action-button" onClick={handleStartWork} disabled={selectedWork === null}>
            ▶️ НАЧАТЬ РАБОТУ
          </button>
          <button className="action-button" onClick={handleMarkCompleted} disabled={selectedWork === null}>
            ✅ ОТМЕТИТЬ ВЫПОЛНЕННЫМ
          </button>
          <button className="action-button" onClick={() => setShowDiagnosticReport(true)}>
            📋 ОТЧЕТ ДИАГНОСТА
          </button>
          <button className="finish-order-button" onClick={handleFinishOrder}>
            🏁 ЗАВЕРШИТЬ ВЕСЬ ЗАКАЗ
          </button>
        </div>

        {showDiagnosticReport && (
          <div className="modal-overlay">
            <div className="diagnostic-report-modal">
              <div className="modal-header">
                <h3>📋 ОТЧЕТ ДИАГНОСТА: ЗАКАЗ #{orderId}</h3>
                <button
                  className="close-button"
                  onClick={() => setShowDiagnosticReport(false)}
                >
                  ✖
                </button>
              </div>

              <div className="modal-content">
                <div className="diagnostic-details">
                  <p><strong>ЖАЛОБА КЛИЕНТА:</strong> {order?.complaint || 'Не указана'}</p>

                  <h4>ВЫЯВЛЕННЫЕ НЕИСПРАВНОСТИ:</h4>
                  <table className="diagnostic-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Неисправность</th>
                        <th>Комментарий диагноста</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defects.map((defect, index) => (
                        <tr key={defect.id}>
                          <td>{index + 1}</td>
                          <td>{defect.defect_description}</td>
                          <td>{defect.diagnostician_comment || 'Нет комментария'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="action-button"
                  onClick={() => setShowDiagnosticReport(false)}
                >
                  ЗАКРЫТЬ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderExecutionModal;