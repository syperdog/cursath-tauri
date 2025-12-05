import React, { useState, useEffect } from 'react';
import './OrderExecutionModal.css';

// Define TypeScript interfaces
interface WorkItem {
  id: number;
  description: string;
  estimatedHours: number;
  status: 'Completed' | 'In Progress' | 'Pending';
  checked: boolean;
}

interface Part {
  id: number;
  name: string;
  brand?: string;
  status: 'Received' | 'Ordered' | 'InStock';
}

interface OrderExecutionModalProps {
  orderId: number;
  onClose: () => void;
}

const OrderExecutionModal: React.FC<OrderExecutionModalProps> = ({ orderId, onClose }) => {
  const [works, setWorks] = useState<WorkItem[]>([
    {
      id: 1,
      description: 'Замена переднего левого рычага',
      estimatedHours: 1.5,
      status: 'Completed',
      checked: true
    },
    {
      id: 2,
      description: 'Замена передних тормозных колодок',
      estimatedHours: 0.8,
      status: 'In Progress',
      checked: false
    },
    {
      id: 3,
      description: 'Проверка уровня тормозной жидкости',
      estimatedHours: 0.2,
      status: 'Pending',
      checked: false
    }
  ]);

  const [parts, setParts] = useState<Part[]>([
    {
      id: 1,
      name: 'Рычаг передний левый',
      brand: 'Lemforder',
      status: 'Received'
    },
    {
      id: 2,
      name: 'Колодки тормозные',
      brand: 'Patron',
      status: 'Ordered'
    }
  ]);

  const [selectedWork, setSelectedWork] = useState<number | null>(null);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState<boolean>(false);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Completed': return '✅';
      case 'In Progress': return '🔄';
      case 'Pending': return '⏳';
      case 'Received': return '✅';
      case 'Ordered': return '⏳';
      case 'InStock': return '📦';
      default: return '';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'Completed': return 'Готово';
      case 'In Progress': return 'В работе';
      case 'Pending': return 'Ожидание';
      case 'Received': return 'Получено';
      case 'Ordered': return 'Заказано';
      case 'InStock': return 'На складе';
      default: return status;
    }
  };

  const toggleWorkStatus = (id: number) => {
    setWorks(works.map(work => 
      work.id === id 
        ? { 
            ...work, 
            checked: !work.checked,
            status: !work.checked ? 'In Progress' : 'Pending'
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
          ? { ...work, status: 'Completed', checked: true } 
          : work
      ));
    }
  };

  const handleFinishOrder = () => {
    // Check if all works are completed
    const allCompleted = works.every(work => work.status === 'Completed');
    
    if (allCompleted) {
      alert(`Заказ ${orderId} завершен!`);
      onClose();
    } else {
      alert('Не все работы выполнены. Завершите все работы перед сдачей заказа.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="order-execution-modal">
        <div className="modal-header">
          <h2>🔧 ЗАКАЗ #{orderId}: BMW X5</h2>
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
                    <th>Норма (ч)</th>
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
                          checked={work.checked}
                          onChange={() => toggleWorkStatus(work.id)}
                        />
                      </td>
                      <td>{work.description}</td>
                      <td>{work.estimatedHours}</td>
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
                      <td>{getStatusIcon(part.status)}</td>
                      <td>
                        {part.name} {part.brand && `(${part.brand})`}
                      </td>
                      <td>
                        <span className="status-badge">
                          {getStatusText(part.status)}
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
                <h3>📋 ОТЧЕТ ДИАГНОСТА: BMW X5 (105)</h3>
                <button 
                  className="close-button" 
                  onClick={() => setShowDiagnosticReport(false)}
                >
                  ✖
                </button>
              </div>
              
              <div className="modal-content">
                <div className="diagnostic-details">
                  <p><strong>ЖАЛОБА КЛИЕНТА:</strong> Стук в подвеске</p>
                  
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
                      <tr>
                        <td>1</td>
                        <td>Люфт шаровой опоры</td>
                        <td>Передний левый рычаг, сильный люфт, пыльник порван.</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>Износ тормозных колодок</td>
                        <td>Передние, остаток &lt; 20%.</td>
                      </tr>
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