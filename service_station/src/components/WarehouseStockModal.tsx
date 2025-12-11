import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AddWarehouseItemModal from './AddWarehouseItemModal';
import './WarehouseStockModal.css';

interface WarehouseItem {
  id: number;
  name: string;
  brand: string;
  part_number: string;
  storage_location: string;
  quantity: number;
  min_quantity: number;
  status: string;
}

interface WarehouseStockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WarehouseStockModal: React.FC<WarehouseStockModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWarehouseStock();
    }
  }, [isOpen]);

  useEffect(() => {
    if (warehouseItems.length > 0) {
      const filtered = warehouseItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.part_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, warehouseItems]);

  const loadWarehouseStock = async () => {
    try {
      setLoading(true);
      // В реальном приложении вызываем API для получения остатков на складе
      // Временно используем заглушку
      const mockItems: WarehouseItem[] = [
        {
          id: 1,
          name: "Масло Shell 5W30",
          brand: "Shell",
          part_number: "SH-5W30-4L",
          storage_location: "A-05-12",
          quantity: 15,
          min_quantity: 5,
          status: "Достаточно"
        },
        {
          id: 2,
          name: "Рычаг передний",
          brand: "Lemforder",
          part_number: "LEM-30333",
          storage_location: "B-12-03",
          quantity: 2,
          min_quantity: 2,
          status: "⚠️ На минимуме"
        },
        {
          id: 3,
          name: "Фильтр масляный",
          brand: "Mann",
          part_number: "MW-68/3",
          storage_location: "C-01-07",
          quantity: 1,
          min_quantity: 5,
          status: "⚠️ Низкий остаток"
        },
        {
          id: 4,
          name: "Колодки торм.",
          brand: "Patron",
          part_number: "PTR-PS5005",
          storage_location: "A-08-15",
          quantity: 8,
          min_quantity: 3,
          status: "Достаточно"
        }
      ];
      setWarehouseItems(mockItems);
      setFilteredItems(mockItems);
    } catch (error) {
      console.error('Error loading warehouse stock:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 ОСТАТКИ НА СКЛАДЕ</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          <div className="search-section">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Поиск: деталь, бренд, артикул..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-btn">🔍</button>
            </div>
          </div>

          <div className="warehouse-stock-table">
            <table>
              <thead>
                <tr>
                  <th>Деталь / Бренд</th>
                  <th>Артикул</th>
                  <th>Ячейка</th>
                  <th>Остаток</th>
                  <th>Мин.</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Загрузка остатков...</td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.name}</div>
                        <div className="item-brand">{item.brand}</div>
                      </td>
                      <td>{item.part_number}</td>
                      <td>{item.storage_location}</td>
                      <td>{item.quantity} шт.</td>
                      <td>{item.min_quantity} шт.</td>
                      <td className={item.quantity <= item.min_quantity ? 'low-stock' : ''}>
                        {item.quantity <= item.min_quantity ? '⚠️ Низкий остаток' : 'Норма'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Ничего не найдено</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary-btn" onClick={() => setShowAddItemModal(true)}>➕ ДОБАВИТЬ ПОЗИЦИЮ</button>
          <button className="primary-btn">➕ ЗАКАЗАТЬ У ПОСТАВЩИКА</button>
        </div>
      </div>
    </div>

    {showAddItemModal && (
      <AddWarehouseItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onItemAdded={() => loadWarehouseStock()} // Перезагружаем список после добавления
      />
    )}
  </div>
  );
};

export default WarehouseStockModal;