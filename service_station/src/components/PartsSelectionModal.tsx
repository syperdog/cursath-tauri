import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PartsSelectionModal.css';
import PartsSearchModal from './PartsSearchModal';

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

interface Car {
  id: number;
  client_id: number;
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  production_year: number | null;
  mileage: number;
  last_visit_date: string | null;
  created_at: string;
}

interface OrderDefect {
  id: number;
  order_id: number;
  diagnostician_id: number;
  defect_description: string;
  diagnostician_comment: string | null;
  is_confirmed: boolean;
}

interface PartSuggestion {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  price: number;
  availability: string;
  part_number: string;
  selected?: boolean;
}

interface PartsSelectionModalProps {
  isOpen: boolean;
  order: Order;
  car: Car | null;
  diagnostics: OrderDefect[];
  onClose: () => void;
  onSave: (partSuggestions: PartSuggestion[]) => void;
}

const PartsSelectionModal: React.FC<PartsSelectionModalProps> = ({
  isOpen,
  order,
  car,
  diagnostics,
  onClose,
  onSave
}) => {
  const [partSuggestions, setPartSuggestions] = useState<PartSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPartsSearchModal, setShowPartsSearchModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPartSuggestions();
    }
  }, [isOpen]);

  const loadPartSuggestions = async () => {
    try {
      setLoading(true);
      // В реальном приложении это будет вызовом API для получения предложений по запчастям
      // При первом открытии список будет пустым
      const suggestions: PartSuggestion[] = [];
      setPartSuggestions(suggestions);
    } catch (error) {
      console.error('Error loading part suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePartToggle = (id: number) => {
    setPartSuggestions(prev =>
      prev.map(part =>
        part.id === id ? { ...part, selected: !part.selected } : part
      )
    );
  };

  const handleAddSelectedParts = (parts: any[]) => {
    const newParts = parts.map(part => ({
      id: part.id,
      name: part.name,
      brand: part.brand,
      supplier: part.supplier,
      price: part.price,
      availability: part.availability,
      part_number: part.article,
      selected: true
    }));

    setPartSuggestions(prev => [...prev, ...newParts]);
  };

  const handleSave = () => {
    const selectedParts = partSuggestions.filter(part => part.selected);
    onSave(selectedParts);
  };

  const handleRemovePart = (id: number) => {
    setPartSuggestions(prev => prev.filter(part => part.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 ПОДБОР: {car?.make} {car?.model} (VIN: {car?.vin || 'не указан'})</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="diagnostics-section">
            <h3>НЕИСПРАВНОСТИ (От Диагноста):</h3>
            <ul>
              {diagnostics.map(diag => (
                <li key={diag.id}>{diag.defect_description}</li>
              ))}
            </ul>
          </div>

          <div className="parts-suggestions-section">
            <h3>ПРЕДЛОЖЕНИЕ ПО ЗАПЧАСТЯМ (Для согласования):</h3>
            {loading ? (
              <p>Загрузка предложений по запчастям...</p>
            ) : partSuggestions.length > 0 ? (
              <table className="parts-suggestions-table">
                <thead>
                  <tr>
                    <th>Наименование / Бренд</th>
                    <th>Поставщик</th>
                    <th>Цена</th>
                    <th>Срок</th>
                    <th>Артикул</th>
                    <th>Выбрать</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {partSuggestions.map(part => (
                    <tr key={part.id}>
                      <td>
                        <div>{part.name}</div>
                        <div className="part-brand">{part.brand}</div>
                      </td>
                      <td>{part.supplier}</td>
                      <td>{part.price.toFixed(2)}</td>
                      <td>{part.availability}</td>
                      <td>{part.part_number}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!part.selected}
                          onChange={() => handlePartToggle(part.id)}
                        />
                      </td>
                      <td>
                        <button
                          className="remove-part-btn"
                          onClick={() => handleRemovePart(part.id)}
                        >
                          УДАЛИТЬ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Нет добавленных запчастей. Нажмите "ПОИСК И ДОБАВЛЕНИЕ" для поиска запчастей.</p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-btn"
            onClick={() => setShowPartsSearchModal(true)}
          >
            ➕ ПОИСК И ДОБАВЛЕНИЕ
          </button>
          <button className="primary-btn" onClick={handleSave}>
            💾 ОТПРАВИТЬ МАСТЕРУ
          </button>
        </div>

        {showPartsSearchModal && car && (
          <PartsSearchModal
            isOpen={showPartsSearchModal}
            vin={car.vin || ''}
            onClose={() => setShowPartsSearchModal(false)}
            onAddSelectedParts={handleAddSelectedParts}
          />
        )}
      </div>
    </div>
  );
};

export default PartsSelectionModal;