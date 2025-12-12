import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './AddPartToWarehouseModal.css';

interface AddPartToWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartAdded: () => void;
}

interface NewPart {
  name: string;
  brand: string;
  article: string;
  location_cell: string;
  quantity: number;
  min_quantity: number;
  purchase_price: number;
  selling_price: number;
}

const AddPartToWarehouseModal: React.FC<AddPartToWarehouseModalProps> = ({ isOpen, onClose, onPartAdded }) => {
  const [newPart, setNewPart] = useState<NewPart>({
    name: '',
    brand: '',
    article: '',
    location_cell: '',
    quantity: 1,
    min_quantity: 2,
    purchase_price: 0,
    selling_price: 0
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newPart.name || !newPart.brand || !newPart.article || !newPart.location_cell) {
      alert('Пожалуйста, заполните все обязательные поля: название, бренд, артикул и ячейка');
      return;
    }

    if (newPart.quantity < 0 || newPart.min_quantity < 0 || newPart.purchase_price < 0 || newPart.selling_price < 0) {
      alert('Значения не могут быть отрицательными');
      return;
    }

    try {
      setLoading(true);

      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      // Вызываем Tauri команду для добавления запчасти на склад
      const result = await invoke<string>('add_warehouse_item_with_json', {
        request: {
          sessionToken,
          name: newPart.name,
          brand: newPart.brand,
          article: newPart.article,
          locationCell: newPart.location_cell,
          quantity: newPart.quantity,
          minQuantity: newPart.min_quantity,
          purchasePrice: newPart.purchase_price,
          sellingPrice: newPart.selling_price
        }
      });

      console.log(result); // Логируем результат

      // Вызываем callback для обновления данных
      onPartAdded();
      setNewPart({
        name: '',
        brand: '',
        article: '',
        location_cell: '',
        quantity: 1,
        min_quantity: 2,
        purchase_price: 0,
        selling_price: 0
      });
      onClose();

      // Показываем сообщение об успешном добавлении
      alert('Запчасть успешно добавлена на склад!');
    } catch (error) {
      console.error('Error adding part to warehouse:', error);
      alert(`Ошибка при добавлении запчасти на склад: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 ДОБАВИТЬ ЗАПЧАСТЬ НА СКЛАД</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="input-group">
            <label htmlFor="part-name">Название запчасти:</label>
            <input
              id="part-name"
              type="text"
              value={newPart.name}
              onChange={(e) => setNewPart({...newPart, name: e.target.value})}
              placeholder="Например: Масляный фильтр"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="part-brand">Бренд:</label>
            <input
              id="part-brand"
              type="text"
              value={newPart.brand}
              onChange={(e) => setNewPart({...newPart, brand: e.target.value})}
              placeholder="Например: Bosch"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="part-article">Артикул:</label>
            <input
              id="part-article"
              type="text"
              value={newPart.article}
              onChange={(e) => setNewPart({...newPart, article: e.target.value})}
              placeholder="Например: F026300610"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="location-cell">Ячейка склада:</label>
            <input
              id="location-cell"
              type="text"
              value={newPart.location_cell}
              onChange={(e) => setNewPart({...newPart, location_cell: e.target.value})}
              placeholder="Например: A-01-01"
              required
            />
          </div>

          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="quantity">Количество:</label>
              <input
                id="quantity"
                type="number"
                value={newPart.quantity}
                onChange={(e) => setNewPart({...newPart, quantity: parseInt(e.target.value) || 0})}
                min="0"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="min-quantity">Минимальное количество:</label>
              <input
                id="min-quantity"
                type="number"
                value={newPart.min_quantity}
                onChange={(e) => setNewPart({...newPart, min_quantity: parseInt(e.target.value) || 0})}
                min="0"
                required
              />
            </div>
          </div>

          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="purchase-price">Закупочная цена:</label>
              <input
                id="purchase-price"
                type="number"
                step="0.01"
                value={newPart.purchase_price}
                onChange={(e) => setNewPart({...newPart, purchase_price: parseFloat(e.target.value) || 0})}
                min="0"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="selling-price">Цена продажи:</label>
              <input
                id="selling-price"
                type="number"
                step="0.01"
                value={newPart.selling_price}
                onChange={(e) => setNewPart({...newPart, selling_price: parseFloat(e.target.value) || 0})}
                min="0"
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="primary-btn" onClick={handleSave} disabled={loading}>
              {loading ? 'ЗАГРУЗКА...' : '💾 СОХРАНИТЬ'}
            </button>
            <button className="secondary-btn" onClick={onClose}>ОТМЕНА</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPartToWarehouseModal;