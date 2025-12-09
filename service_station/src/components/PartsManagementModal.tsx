import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PartsManagementModal.css';

interface Order {
  id: number;
  // другие поля заказа
}

interface Car {
  id: number;
  vin: string | null;
  // другие поля автомобиля
}

interface DiagnosticResult {
  id: number;
  description: string;
  // другие поля результата диагностики
}

interface PartSuggestion {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  price: number;
  availability: string;
  part_number: string;
  selected: boolean;
}

interface PartsManagementModalProps {
  isOpen: boolean;
  order: Order;
  car: Car | null;
  diagnostics: DiagnosticResult[];
  onClose: () => void;
  onSave: (selectedParts: PartSuggestion[]) => void;
}

const PartsManagementModal: React.FC<PartsManagementModalProps> = ({
  isOpen,
  order,
  car,
  diagnostics,
  onClose,
  onSave
}) => {
  const [partsSuggestions, setPartsSuggestions] = useState<PartSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PartSuggestion[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filters, setFilters] = useState({
    brand: 'Все',
    supplier: 'Все',
    availability: 'Все'
  });

  useEffect(() => {
    if (isOpen) {
      // В реальной реализации загружаем предложения запчастей из API
      // Заглушка для демонстрации
      const mockPartsSuggestions: PartSuggestion[] = [
        { id: 1, name: 'Рычаг передний левый', brand: 'Lemforder', supplier: 'Склад СТО', price: 250.00, availability: 'В наличии', part_number: '30333 01', selected: false },
        { id: 2, name: 'Рычаг передний левый', brand: 'Patron', supplier: 'Шате-М', price: 120.00, availability: 'Завтра', part_number: 'PS5005', selected: false },
        { id: 3, name: 'Масло моторное', brand: 'Shell', supplier: 'Склад СТО', price: 15.99, availability: 'В наличии', part_number: 'SH-5W30-4L', selected: false },
        { id: 4, name: 'Тормозные колодки', brand: 'Bosch', supplier: 'Армтек', price: 45.50, availability: '3 дня', part_number: 'BR-0123', selected: false }
      ];
      
      setPartsSuggestions(mockPartsSuggestions);
    }
  }, [isOpen]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Фильтрация запчастей по запросу
    const filtered = partsSuggestions.filter(part => 
      part.name.toLowerCase().includes(query.toLowerCase()) ||
      part.brand.toLowerCase().includes(query.toLowerCase()) ||
      part.part_number.toLowerCase().includes(query.toLowerCase())
    );
    
    setSearchResults(filtered);
    setShowSearchResults(true);
  };

  const handleAddToProposal = (part: PartSuggestion) => {
    // Добавляем запчасть в предложение
    setPartsSuggestions(prev => 
      prev.map(p => 
        p.id === part.id ? { ...p, selected: !p.selected } : p
      )
    );
  };

  const handleSendToMaster = () => {
    const selectedParts = partsSuggestions.filter(part => part.selected);
    onSave(selectedParts);
  };

  const filteredSuggestions = partsSuggestions.filter(part => {
    return (
      (filters.brand === 'Все' || part.brand === filters.brand) &&
      (filters.supplier === 'Все' || part.supplier === filters.supplier) &&
      (filters.availability === 'Все' || part.availability === filters.availability)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 ПОДБОР: BMW X5 (VIN: {car?.vin || 'N/A'})</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="diagnostics-section">
            <h3>НЕИСПРАВНОСТИ (От Диагноста):</h3>
            <ul>
              {diagnostics.map((diag, index) => (
                <li key={index}>{diag.description}</li>
              ))}
            </ul>
          </div>

          <div className="search-section">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Поиск запчастей (VIN: ...)"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
              />
              <button className="search-btn">🔍 НАЙТИ</button>
            </div>

            {showSearchResults && searchResults.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">
                  <div className="filter-controls">
                    <select 
                      value={filters.brand} 
                      onChange={(e) => setFilters({...filters, brand: e.target.value})}
                    >
                      <option value="Все">Бренд (Все)</option>
                      <option value="Lemforder">Lemforder</option>
                      <option value="Patron">Patron</option>
                      <option value="Shell">Shell</option>
                      <option value="Bosch">Bosch</option>
                    </select>
                    
                    <select 
                      value={filters.supplier} 
                      onChange={(e) => setFilters({...filters, supplier: e.target.value})}
                    >
                      <option value="Все">Поставщик (Все)</option>
                      <option value="Склад СТО">Склад СТО</option>
                      <option value="Шате-М">Шате-М</option>
                      <option value="Армтек">Армтек</option>
                      <option value="Мотекс">Мотекс</option>
                    </select>
                    
                    <select 
                      value={filters.availability} 
                      onChange={(e) => setFilters({...filters, availability: e.target.value})}
                    >
                      <option value="Все">Срок (Все)</option>
                      <option value="В наличии">В наличии</option>
                      <option value="Завтра">Завтра</option>
                      <option value="3 дня">3 дня</option>
                      <option value="Нет в наличии">Нет в наличии</option>
                    </select>
                  </div>
                </div>

                <table className="search-results-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Деталь / Бренд</th>
                      <th>Поставщик</th>
                      <th>Артикул</th>
                      <th>Цена</th>
                      <th>Срок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((part) => (
                      <tr key={part.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={part.selected}
                            onChange={() => {}}
                          />
                        </td>
                        <td>{part.name} / {part.brand}</td>
                        <td>{part.supplier}</td>
                        <td>{part.part_number}</td>
                        <td>{part.price.toFixed(2)}</td>
                        <td>{part.availability}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button 
                  className="add-selected-btn"
                  onClick={() => {
                    // Добавляем все выбранные результаты в основной список
                    const newSelected = [...searchResults];
                    setSearchResults([]);
                    setShowSearchResults(false);
                    setSearchQuery('');
                  }}
                >
                  📥 ДОБАВИТЬ ВЫБРАННОЕ В ПРЕДЛОЖЕНИЕ ({searchResults.filter(p => p.selected).length})
                </button>
              </div>
            )}
          </div>

          <div className="proposal-section">
            <h3>ПРЕДЛОЖЕНИЕ ПО ЗАПЧАСТЯМ (Для согласования):</h3>
            <table className="proposal-table">
              <thead>
                <tr>
                  <th>Наименование / Бренд</th>
                  <th>Поставщик</th>
                  <th>Цена</th>
                  <th>Срок</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuggestions.filter(p => p.selected).map((part) => (
                  <tr key={part.id}>
                    <td>{part.name} / {part.brand}</td>
                    <td>{part.supplier}</td>
                    <td>{part.price.toFixed(2)}</td>
                    <td>{part.availability}</td>
                    <td>
                      <button 
                        className="remove-btn"
                        onClick={() => handleAddToProposal(part)}
                      >
                        ➖ УДАЛИТЬ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button className="send-btn" onClick={handleSendToMaster}>
            💾 ОТПРАВИТЬ МАСТЕРУ
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsManagementModal;