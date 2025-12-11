import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './DiagnosticsModal.css';
import AddFaultModal from './AddFaultModal';
import { DefectNode, DefectType } from '../types/defect';

type Fault = {
  id: number; // Это будет ID типа неисправности
  node_id: number;
  type_id: number;
  node_name: string;
  type_name: string;
  comment: string;
};

type Props = {
  orderId: number;
  clientComplaint: string;
  diagnosticianId: number;
  onClose: () => void;
  onDiagnosisComplete: () => void; // Обновляем пропс - теперь он не принимает список неисправностей
};

const DiagnosticsModal: React.FC<Props> = ({
  orderId,
  clientComplaint,
  diagnosticianId,
  onClose,
  onDiagnosisComplete
}) => {
  // Состояния для списка неисправностей
  const [faults, setFaults] = useState<Fault[]>([]);
  const [allDefectTypes, setAllDefectTypes] = useState<Record<number, DefectType>>({});

  // Состояние для управления видимостью модального окна добавления неисправности
  const [showAddFaultModal, setShowAddFaultModal] = useState(false);

  // Загрузка справочника типов неисправностей при монтировании
  useEffect(() => {
    const loadDefectTypes = async () => {
      try {
        const defectTypes = await invoke<DefectType[]>('get_all_defect_types');
        const typesMap: Record<number, DefectType> = {};
        defectTypes.forEach(type => {
          typesMap[type.id] = type;
        });
        setAllDefectTypes(typesMap);
      } catch (error) {
        console.error('Error loading defect types:', error);
        alert('Ошибка загрузки справочника неисправностей: ' + error);
      }
    };

    loadDefectTypes();
  }, []);

  // Функция для добавления новой неисправности
  const handleAddFault = (fault: { node_id: number; type_id: number; comment: string }) => {
    const defectType = allDefectTypes[fault.type_id];
    if (!defectType) {
      console.error(`Defect type with ID ${fault.type_id} not found in cache`);
      return;
    }

    const newFault: Fault = {
      id: fault.type_id,
      node_id: fault.node_id,
      type_id: fault.type_id,
      node_name: defectType.node_name,
      type_name: defectType.name,
      comment: fault.comment
    };
    setFaults([...faults, newFault]);
  };

  // Функция для удаления неисправности
  const handleRemoveFault = (id: number) => {
    setFaults(faults.filter(fault => fault.id !== id));
  };

  // Функция для завершения диагностики
  const handleCompleteDiagnosis = async () => {
    // Получаем ID типов неисправностей для передачи в бэкенд
    const defectTypeIds = faults.map(fault => fault.type_id);

    try {
      // Вызываем команду сохранения результатов диагностики
      const result = await invoke('save_diagnostic_results', {
        orderId: orderId,
        diagnosticianId: diagnosticianId,
        defectTypeIds: defectTypeIds
      });

      console.log(`Завершаем диагностику для заказа #${orderId}`);
      console.log('Результат:', result);

      // Затем обновляем статус заказа на 'Parts_Selection', чтобы передать заказ кладовщику
      const statusUpdateResult = await invoke('update_order_status', {
        orderId: orderId,
        newStatus: 'Parts_Selection'
      });
      console.log(`Статус заказа #${orderId} обновлён на 'Parts_Selection'. Результат:`, statusUpdateResult);

      onDiagnosisComplete();
      onClose();
    } catch (error) {
      console.error('Error saving diagnostic results or updating order status:', error);
      alert('Ошибка при сохранении результатов диагностики или обновлении статуса заказа: ' + error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>📋 ДИАГНОСТИКА (#{orderId})</h2>
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
                    <td>{fault.node_name} / {fault.type_name}</td>
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