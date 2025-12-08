import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PartsSelectionModal.css';

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

interface DiagnosticResult {
  id: number;
  order_id: number;
  diagnostician_id: number;
  description: string;
  created_at: string;
}

interface PartSuggestion {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  price: number;
  availability: string;
  part_number: string;
}

interface PartsSelectionModalProps {
  isOpen: boolean;
  order: Order;
  car: Car | null;
  diagnostics: DiagnosticResult[];
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

  useEffect(() => {
    if (isOpen) {
      loadPartSuggestions();
    }
  }, [isOpen]);

  const loadPartSuggestions = async () => {
    try {
      setLoading(true);
      // В реальном приложении это будет вызовом API для получения предложений по запчастям
      // Временно возвращаем заглушку
      const suggestions: PartSuggestion[] = [
        {
          id: 1,
          name: "Рычаг передний левый",
          brand: "Lemforder",
          supplier: "Склад СТО",
          price: 250.00,
          availability: "В наличии",
          part_number: "30333 01"
        },
        {
          id: 2,
          name: "Рычаг передний левый",
          brand: "Patron",
          supplier: "Шате-М",
          price: 120.00,
          availability: "Завтра",
          part_number: "PS5005"
        },
        {
          id: 3,
          name: "Тормозные колодки",
          brand: "Bosch",
          supplier: "Склад СТО",
          price: 180.00,
          availability: "В наличии",
          part_number: "0986489524"
        }
      ];
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

  const handleSave = () => {
    const selectedParts = partSuggestions.filter(part => part.selected);
    onSave(selectedParts);
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
                <li key={diag.id}>{diag.description}</li>
              ))}
            </ul>
          </div>

          <div className="parts-suggestions-section">
            <h3>ПРЕДЛОЖЕНИЕ ПО ЗАПЧАСТЯМ (Для согласования):</h3>
            {loading ? (
              <p>Загрузка предложений по запчастям...</p>
            ) : (
              <table className="parts-suggestions-table">
                <thead>
                  <tr>
                    <th>Наименование / Бренд</th>
                    <th>Поставщик</th>
                    <th>Цена</th>
                    <th>Срок</th>
                    <th>Артикул</th>
                    <th>Выбрать</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary-btn" onClick={() => {}}>
            ➕ ПОИСК И ДОБАВЛЕНИЕ
          </button>
          <button className="primary-btn" onClick={handleSave}>
            💾 ОТПРАВИТЬ МАСТЕРУ
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsSelectionModal;