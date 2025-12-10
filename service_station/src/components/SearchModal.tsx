import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './SearchModal.css';

interface Client {
  id: number;
  full_name: string;
  phone: string;
  address: string | null;
  created_at: string;
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

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  worker_id: number | null; // Main worker assigned to the entire order
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  prepayment: string | null;
  total_amount: string | null;
  created_at: string;
  completed_at: string | null;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResultSelect: (item: Client | Car | Order) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onResultSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Client | Car | Order)[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const [orders, clients, cars] = await invoke<[Order[], Client[], Car[]]>(
        'search_orders_clients_cars',
        { query: searchQuery }
      );

      // Combine all results
      const results: (Client | Car | Order)[] = [...clients, ...cars, ...orders];
      setSearchResults(results);
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: Client | Car | Order) => {
    onResultSelect(item);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 ПОИСК КЛИЕНТА ИЛИ АВТО</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>
        
        <div className="modal-body">
          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени клиента, гос. номеру или VIN..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="search-btn" onClick={handleSearch}>🔍</button>
          </div>
          
          {loading ? (
            <p>Идет поиск...</p>
          ) : searchResults.length > 0 ? (
            <div className="search-results">
              <h3>Результаты поиска (Выберите кликом):</h3>
              <ul>
                {searchResults.map((result, index) => {
                  if ('phone' in result) { // This is a client
                    return (
                      <li 
                        key={`client-${result.id}-${index}`} 
                        className="search-result-item" 
                        onClick={() => handleSelect(result)}
                      >
                        <div>
                          <strong>👤 {result.full_name}</strong> | 📞 {result.phone}
                        </div>
                        <div className="result-details">
                          {result.address ? result.address : 'Адрес не указан'}
                        </div>
                      </li>
                    );
                  } else if ('license_plate' in result) { // This is a car
                    return (
                      <li 
                        key={`car-${result.id}-${index}`} 
                        className="search-result-item" 
                        onClick={() => handleSelect(result)}
                      >
                        <div>
                          <strong>🚗 {result.make} {result.model}</strong> | 🏷️ {result.license_plate || 'Нет номера'}
                        </div>
                        <div className="result-details">
                          VIN: {result.vin || 'Не указан'} | Год: {result.production_year || 'Не указан'} | Пробег: {result.mileage} км
                        </div>
                      </li>
                    );
                  } else { // This is an order
                    return (
                      <li 
                        key={`order-${result.id}-${index}`} 
                        className="search-result-item" 
                        onClick={() => handleSelect(result)}
                      >
                        <div>
                          <strong>📋 Заказ #{result.id}</strong> | Статус: {result.status}
                        </div>
                        <div className="result-details">
                          {result.complaint || 'Без описания проблемы'}
                        </div>
                      </li>
                    );
                  }
                })}
              </ul>
            </div>
          ) : (
            <p>Ничего не найдено. Попробуйте другой запрос.</p>
          )}
        </div>
        
        <div className="modal-actions">
          <button className="secondary-btn" onClick={() => onResultSelect(null as any)}>➕ НОВЫЙ КЛИЕНТ</button>
          <button className="secondary-btn" onClick={() => onResultSelect(null as any)}>➕ НОВОЕ АВТО</button>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;