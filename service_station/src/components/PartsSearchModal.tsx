import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PartsSearchModal.css';

interface Part {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  part_number: string;
  price: number;
  availability: string; // срок поставки
  selected: boolean;
}

interface PartsSearchModalProps {
  isOpen: boolean;
  vin: string;
  onClose: () => void;
  onPartsSelected: (parts: Part[]) => void;
}

const PartsSearchModal: React.FC<PartsSearchModalProps> = ({ 
  isOpen, 
  vin, 
  onClose, 
  onPartsSelected 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [brandFilter, setBrandFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    try {
      setLoading(true);
      // В реальном приложении это будет вызовом API для поиска запчастей
      // Временно возвращаем заглушку
      const mockParts: Part[] = [
        {
          id: 1,
          name: "Рычаг передний левый",
          brand: "Lemforder",
          supplier: "Склад СТО",
          part_number: "30333 01",
          price: 250.00,
          availability: "0 дн.",
          selected: false
        },
        {
          id: 2,
          name: "Рычаг передний левый",
          brand: "TRW",
          supplier: "Армтек",
          part_number: "JTC1001",
          price: 240.00,
          availability: "1 дн.",
          selected: false
        },
        {
          id: 3,
          name: "Рычаг передний левый",
          brand: "Patron",
          supplier: "Шате-М",
          part_number: "PS5005",
          price: 120.00,
          availability: "1 дн.",
          selected: false
        },
        {
          id: 4,
          name: "Рычаг передний левый",
          brand: "Stellox",
          supplier: "Мотекс",
          part_number: "57-0001",
          price: 110.00,
          availability: "2 дн.",
          selected: false
        }
      ];
      setParts(mockParts);
    } catch (error) {
      console.error('Error searching parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePartToggle = (id: number) => {
    setParts(prev => 
      prev.map(part => 
        part.id === id ? { ...part, selected: !part.selected } : part
      )
    );
  };

  const handleAddSelected = () => {
    const selectedParts = parts.filter(part => part.selected);
    onPartsSelected(selectedParts);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 ПОИСК ЗАПЧАСТЕЙ (VIN: {vin})</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          <div className="search-controls">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Поиск запчастей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-btn" onClick={handleSearch}>🔍 НАЙТИ</button>
            </div>

            <div className="filters">
              <div className="filter-group">
                <label>Бренд:</label>
                <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                  <option value="All">Все</option>
                  <option value="Lemforder">Lemforder</option>
                  <option value="TRW">TRW</option>
                  <option value="Patron">Patron</option>
                  <option value="Stellox">Stellox</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Поставщик:</label>
                <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="All">Все</option>
                  <option value="Склад СТО">Склад СТО</option>
                  <option value="Армтек">Армтек</option>
                  <option value="Шате-М">Шате-М</option>
                  <option value="Мотекс">Мотекс</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Срок:</label>
                <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                  <option value="All">Все</option>
                  <option value="0">В наличии</option>
                  <option value="1">1 день</option>
                  <option value="2">2 дня</option>
                  <option value="3+">3+ дня</option>
                </select>
              </div>
            </div>
          </div>

          <div className="search-results">
            <h3>РЕЗУЛЬТАТЫ ПОИСКА:</h3>
            {loading ? (
              <p>Поиск запчастей...</p>
            ) : parts.length > 0 ? (
              <table className="parts-search-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Деталь / Бренд</th>
                    <th>Поставщик</th>
                    <th>Артикул</th>
                    <th>Цена</th>
                    <th>Срок</th>
                    <th>Выбрать</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part, index) => (
                    <tr key={part.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={part.selected}
                          onChange={() => handlePartToggle(part.id)}
                        />
                      </td>
                      <td>
                        <div>{part.name}</div>
                        <div className="part-brand">{part.brand}</div>
                      </td>
                      <td>{part.supplier}</td>
                      <td>{part.part_number}</td>
                      <td>{part.price.toFixed(2)}</td>
                      <td>{part.availability}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={part.selected}
                          onChange={() => handlePartToggle(part.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Запчасти не найдены. Попробуйте изменить параметры поиска.</p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="primary-btn" 
            onClick={handleAddSelected}
            disabled={!parts.some(p => p.selected)}
          >
            📥 ДОБАВИТЬ ВЫБРАННОЕ В ПРЕДЛОЖЕНИЕ ({parts.filter(p => p.selected).length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsSearchModal;