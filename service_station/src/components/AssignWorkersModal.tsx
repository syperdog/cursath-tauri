import React, { useState } from 'react';
import './AssignWorkersModal.css';

interface Worker {
  id: number;
  full_name: string;
  role: string; // e.g., 'Mechanic', 'Electrician', etc.
  status: string; // 'Available', 'Busy', etc.
}

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

interface Work {
  id: number;
  order_id: number;
  description: string;
  category: string; // e.g., 'Mechanical', 'Electrical'
  estimated_hours: number;
  assigned_worker_id?: number;
}

interface AssignWorkersModalProps {
  isOpen: boolean;
  order: Order;
  works: Work[];
  workers: Worker[];
  onClose: () => void;
  onAssignmentSaved: () => void;
}

const AssignWorkersModal: React.FC<AssignWorkersModalProps> = ({ 
  isOpen, 
  order, 
  works, 
  workers, 
  onClose, 
  onAssignmentSaved 
}) => {
  const [workAssignments, setWorkAssignments] = useState<Record<number, number | null>>(
    works.reduce((acc, work) => {
      acc[work.id] = work.assigned_worker_id || null;
      return acc;
    }, {} as Record<number, number | null>)
  );

  if (!isOpen) return null;

  const handleWorkerChange = (workId: number, workerId: number | null) => {
    setWorkAssignments(prev => ({
      ...prev,
      [workId]: workerId
    }));
  };

  const getAvailableWorkers = (workCategory: string) => {
    // Filter workers based on category (specialization)
    return workers.filter(worker => {
      // For now, we'll just filter by role - in a real app this would be more sophisticated
      if (workCategory.toLowerCase().includes('electr')) {
        return worker.role.toLowerCase().includes('electrician') || worker.role.toLowerCase().includes('all');
      } else if (workCategory.toLowerCase().includes('mech')) {
        return worker.role.toLowerCase().includes('mechanic') || worker.role.toLowerCase().includes('all');
      } else {
        return worker.role.toLowerCase().includes('all');
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real application, we would send this data to the backend
    console.log('Work assignments:', workAssignments);
    
    onAssignmentSaved();
    onClose();
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
            <p><strong>Клиент:</strong> {order.client_id}</p>
            <p><strong>Автомобиль:</strong> {order.car_id}</p>
            <p><strong>Статус заказа:</strong> {order.status}</p>
          </div>
          
          <div className="works-section">
            <h3>СПИСОК СОГЛАСОВАННЫХ РАБОТ:</h3>
            <table className="works-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Работа</th>
                  <th>Категория</th>
                  <th>Исполнитель</th>
                </tr>
              </thead>
              <tbody>
                {works.map(work => (
                  <tr key={work.id}>
                    <td>{work.id}</td>
                    <td>{work.description}</td>
                    <td>{work.category}</td>
                    <td>
                      <select 
                        value={workAssignments[work.id] || ''}
                        onChange={(e) => handleWorkerChange(work.id, e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">Выберите исполнителя</option>
                        {getAvailableWorkers(work.category).map(worker => (
                          <option key={worker.id} value={worker.id}>
                            {worker.full_name} ({worker.role})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="modal-actions">
            <button type="submit" className="save-btn">💾 СОХРАНИТЬ И ПЕРЕДАТЬ В ЦЕХ</button>
            <button type="button" onClick={onClose} className="cancel-btn">ОТМЕНА</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignWorkersModal;