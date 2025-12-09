import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PartsSearchModal.css';

interface Part {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  article: string;
  price: number;
  availability: string; // срок поставки
  selected: boolean;
}

interface PartsSearchModalProps {
  isOpen: boolean;
  vin: string;
  onClose: () => void;
  onAddSelectedParts: (parts: Part[]) => void;
}

const PartsSearchModal: React.FC<PartsSearchModalProps> = ({
  isOpen,
  vin,
  onClose,
  onAddSelectedParts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [filters, setFilters] = useState({
    brand: 'Все',
    supplier: 'Все',
    availability: 'Все'
  });

  // Функция поиска запчастей
  const searchParts = async () => {
    try {
      // Вызов команды из Rust для поиска запчастей
      const searchResults: any[] = await invoke('search_parts_by_vin', {
        vin: vin,
        query: searchQuery
      });

      // Преобразуем результаты для использования в компоненте
      const transformedParts = searchResults.map((part: any) => ({
        id: part.id,
        name: part.name,
        brand: part.brand,
        supplier: part.supplier,
        article: part.article,
        price: part.price,
        availability: part.availability,
        selected: false
      }));

      setParts(transformedParts);
    } catch (error) {
      console.error('Ошибка при поиске запчастей:', error);
    }
  };

  // Обработчик изменения чекбокса
  const handleCheckboxChange = (id: number) => {
    setParts(prevParts =>
      prevParts.map(part =>
        part.id === id ? { ...part, selected: !part.selected } : part
      )
    );
  };

  // Обработчик добавления выбранных запчастей
  const handleAddSelectedParts = () => {
    const selectedParts = parts.filter(part => part.selected);
    onAddSelectedParts(selectedParts);
    onClose();
  };

  // Обработчик поиска при нажатии Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchParts();
    }
  };

  // Автоматический поиск при открытии с VIN-кодом
  useEffect(() => {
    if (isOpen && vin) {
      // В реальной реализации сначала ищем по VIN
      searchParts();
    }
  }, [isOpen, vin]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 ПОИСК ЗАПЧАСТЕЙ (VIN: {vin})</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          <div className="search-inputs">
            <input
              type="text"
              placeholder="Рычаг передний левый"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button onClick={searchParts}>🔎 НАЙТИ</button>
          </div>

          <div className="filters">
            <select value={filters.brand} onChange={(e) => setFilters({...filters, brand: e.target.value})}>
              <option value="Все">Бренд (Все)</option>
              <option value="Lemforder">Lemforder</option>
              <option value="TRW">TRW</option>
              <option value="Patron">Patron</option>
              <option value="Stellox">Stellox</option>
            </select>

            <select value={filters.supplier} onChange={(e) => setFilters({...filters, supplier: e.target.value})}>
              <option value="Все">Поставщик (Все)</option>
              <option value="Склад СТО">Склад СТО</option>
              <option value="Армтек">Армтек</option>
              <option value="Шате-М">Шате-М</option>
              <option value="Мотекс">Мотекс</option>
            </select>

            <select value={filters.availability} onChange={(e) => setFilters({...filters, availability: e.target.value})}>
              <option value="Все">Срок (Все)</option>
              <option value="В наличии">В наличии</option>
              <option value="1 дн.">1 день</option>
              <option value="2 дн.">2 дня</option>
              <option value="Более 2 дн.">Более 2 дней</option>
            </select>
          </div>

          <div className="search-results">
            <h3>РЕЗУЛЬТАТЫ ПОИСКА:</h3>
            {parts.length > 0 ? (
              <table className="parts-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Деталь / Бренд</th>
                    <th>Поставщик</th>
                    <th>Артикул</th>
                    <th>Цена</th>
                    <th>Срок</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part, index) => (
                    <tr key={part.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={part.selected}
                          onChange={() => handleCheckboxChange(part.id)}
                        />
                      </td>
                      <td>
                        <div>{part.name}</div>
                        <div className="part-brand">{part.brand}</div>
                      </td>
                      <td>{part.supplier}</td>
                      <td>{part.article}</td>
                      <td>{part.price.toFixed(2)}</td>
                      <td>{part.availability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Введите запрос для поиска запчастей</p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="primary-btn"
            onClick={handleAddSelectedParts}
            disabled={!parts.some(part => part.selected)}
          >
            📥 ДОБАВИТЬ ВЫБРАННОЕ В ПРЕДЛОЖЕНИЕ ({parts.filter(p => p.selected).length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartsSearchModal;