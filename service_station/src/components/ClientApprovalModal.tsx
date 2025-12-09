import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ClientApprovalModal.css';

interface Work {
  id: number;
  service_id?: number;
  service_name_snapshot: string;
  price: number;
  worker_id?: number | null;
  status: string;
  is_confirmed: boolean;
}

interface Part {
  id: number;
  warehouse_item_id?: number | null;
  part_name_snapshot: string;
  brand: string;
  price_per_unit: number;
  quantity: number;
  is_confirmed: boolean;
}

interface Defect {
  id: number;
  defect_description: string;
  diagnostician_comment: string | null;
  is_confirmed: boolean;
}

interface Order {
  id: number;
  complaint: string | null;
  total_amount: string | null;
}

interface ClientApprovalModalProps {
  isOpen: boolean;
  order: Order;
  clientName: string;
  defects: Defect[];
  works: Work[];
  parts: Part[];
  onClose: () => void;
  onApprovalComplete: (confirmedWorks: Work[], confirmedParts: Part[]) => void;
  onRejectAll: () => void;
}

const ClientApprovalModal: React.FC<ClientApprovalModalProps> = ({
  isOpen,
  order,
  clientName,
  defects,
  works,
  parts,
  onClose,
  onApprovalComplete,
  onRejectAll
}) => {
  const [localWorks, setLocalWorks] = useState<Work[]>([]);
  const [localParts, setLocalParts] = useState<Part[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initialize local state with the incoming data
    setLocalWorks(works.map(work => ({ ...work })));
    setLocalParts(parts.map(part => ({ ...part })));
  }, [works, parts]);

  useEffect(() => {
    // Calculate the total amount when works or parts change
    const total = localWorks
      .filter(work => work.is_confirmed)
      .reduce((sum, work) => sum + work.price, 0) +
      localParts
        .filter(part => part.is_confirmed)
        .reduce((sum, part) => sum + (part.price_per_unit * part.quantity), 0);

    setTotalAmount(total);
  }, [localWorks, localParts]);

  const toggleWorkConfirmed = (id: number) => {
    setLocalWorks(prevWorks =>
      prevWorks.map(work =>
        work.id === id ? { ...work, is_confirmed: !work.is_confirmed } : work
      )
    );
  };

  const togglePartConfirmed = (id: number) => {
    setLocalParts(prevParts =>
      prevParts.map(part =>
        part.id === id ? { ...part, is_confirmed: !part.is_confirmed } : part
      )
    );
  };

  const handleApproveSelected = async () => {
    setIsProcessing(true);
    try {
      // Подтверждаем выбранные работы и запчасти
      const confirmedWorkIds = localWorks.filter(work => work.is_confirmed).map(work => work.id);
      const confirmedPartIds = localParts.filter(part => part.is_confirmed).map(part => part.id);

      // Вызываем команду подтверждения в Rust
      await invoke('confirm_order_parts_and_works', {
        orderId: order.id,
        confirmedWorks: confirmedWorkIds,
        confirmedParts: confirmedPartIds
      });

      // Передаем подтвержденные работы и запчасти наверх
      const confirmedWorks = localWorks.filter(work => work.is_confirmed);
      const confirmedParts = localParts.filter(part => part.is_confirmed);
      onApprovalComplete(confirmedWorks, confirmedParts);
    } catch (error) {
      console.error('Error confirming order:', error);
      alert('Ошибка при подтверждении заказа: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 ЗАКАЗ-НАРЯД #{order.id}</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="client-info">
            <strong>👤 КЛИЕНТ:</strong> {clientName}
          </div>

          <div className="status-badge">
            ⚠️ СТАТУС: [ ⏳ СОГЛАСОВАНИЕ ]
          </div>

          <div className="approval-section">
            <h3>📋 СОГЛАСОВАНИЕ РАБОТ И ЗАПЧАСТЕЙ:</h3>

            {defects.length > 0 && (
              <div className="defect-group">
                {defects.map(defect => (
                  <div key={defect.id} className="defect-item">
                    <div>
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        title="Диагностика обязательна"
                      />
                      {defect.defect_description}
                    </div>
                    {defect.diagnostician_comment && (
                      <div className="defect-comment">
                        <small>💬 Комментарий диагноста: {defect.diagnostician_comment}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {localWorks.length > 0 && (
              <div className="works-group">
                <h4>🔧 РАБОТЫ:</h4>
                {localWorks.map(work => (
                  <div key={work.id} className="work-item">
                    <div>
                      <input
                        type="checkbox"
                        checked={work.is_confirmed}
                        onChange={() => toggleWorkConfirmed(work.id)}
                      />
                      {work.service_name_snapshot}
                    </div>
                    <div className="work-price">
                      {work.price.toFixed(2)} $
                    </div>
                  </div>
                ))}
              </div>
            )}

            {localParts.length > 0 && (
              <div className="parts-group">
                <h4>📦 ЗАПЧАСТИ:</h4>
                {localParts.map(part => (
                  <div key={part.id} className="part-item">
                    <div>
                      <input
                        type="checkbox"
                        checked={part.is_confirmed}
                        onChange={() => togglePartConfirmed(part.id)}
                      />
                      {part.part_name_snapshot} ({part.brand}) x{part.quantity}
                    </div>
                    <div className="part-price">
                      {(part.price_per_unit * part.quantity).toFixed(2)} $
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="total-amount">
            ИТОГО К ОПЛАТЕ: {totalAmount.toFixed(2)} $ (Всего: {(totalAmount + 10000).toFixed(2)} $.)
          </div>
          <div className="modal-actions">
            <button
              className="approve-btn"
              onClick={handleApproveSelected}
              disabled={isProcessing}
            >
              {isProcessing ? 'обработка...' : '✅ ПОДТВЕРДИТЬ ВЫБРАННОЕ'}
            </button>
            <button
              className="reject-btn"
              onClick={onRejectAll}
              disabled={isProcessing}
            >
              ❌ ОТКЛОНИТЬ ВСЁ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientApprovalModal;