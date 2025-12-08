import React, { useState } from 'react';
import './DiagnosticsModal.css';
import AddFaultModal from './AddFaultModal';

type Fault = {
  id: string;
  category: string;
  type: string;
  comment: string;
};

type Props = {
  orderId: number;
  clientComplaint: string;
  onClose: () => void;
  onDiagnosisComplete: (faults: Fault[]) => void;
};

const DiagnosticsModal: React.FC<Props> = ({ 
  orderId, 
  clientComplaint, 
  onClose, 
  onDiagnosisComplete 
}) => {
  // Состояния для списка неисправностей
  const [faults, setFaults] = useState<Fault[]>([]);
  
  // Состояние для управления видимостью модального окна добавления неисправности
  const [showAddFaultModal, setShowAddFaultModal] = useState(false);

  // Функция для добавления новой неисправности
  const handleAddFault = (fault: { category: string; type: string; comment: string }) => {
    const newFault: Fault = {
      id: `${faults.length + 1}`,
      category: fault.category,
      type: fault.type,
      comment: fault.comment
    };
    setFaults([...faults, newFault]);
  };

  // Функция для удаления неисправности
  const handleRemoveFault = (id: string) => {
    setFaults(faults.filter(fault => fault.id !== id));
  };

  // Функция для завершения диагностики
  const handleCompleteDiagnosis = () => {
    // В реальном приложении здесь произошло бы сохранение данных в БД
    // и изменение статуса заказа
    console.log(`Завершаем диагностику для заказа #${orderId}`);
    onDiagnosisComplete(faults);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>📋 ДИАГНОСТИКА: BMW X5 (#{orderId})</h2>
          <button className="close-button" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="client-complaint">
            <strong>ЖАЛОБА КЛИЕНТА:</strong> {clientComplaint}
          </div>

          <div className="diagnostics-list">
            <h3>СПИСОК ВЫЯВЛЕННЫХ НЕИСПРАВНОСТЕЙ:</h3>
            <table className="faults-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Узел / Неисправность</th>
                  <th>Комментарий диагноста</th>
                </tr>
              </thead>
              <tbody>
                {faults.map((fault, index) => (
                  <tr key={fault.id}>
                    <td>{index + 1}</td>
                    <td>{fault.category} / {fault.type}</td>
                    <td>{fault.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions">
            <button 
              className="add-fault-button" 
              onClick={() => setShowAddFaultModal(true)}
            >
              ➕ ДОБАВИТЬ НЕИСПРАВНОСТЬ
            </button>
            <button 
              className="remove-fault-button"
              onClick={() => {
                if (faults.length > 0) {
                  handleRemoveFault(faults[faults.length - 1].id);
                }
              }}
              disabled={faults.length === 0}
            >
              ➖ УДАЛИТЬ
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="complete-diagnosis-button" onClick={handleCompleteDiagnosis}>
            💾 ЗАВЕРШИТЬ
          </button>
        </div>
      </div>

      {/* Модальное окно добавления неисправности */}
      {showAddFaultModal && (
        <AddFaultModal 
          onClose={() => setShowAddFaultModal(false)} 
          onAddFault={handleAddFault}
        />
      )}
    </div>
  );
};

export default DiagnosticsModal;