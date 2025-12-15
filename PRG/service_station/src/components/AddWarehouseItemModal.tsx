import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './AddWarehouseItemModal.css';

interface AddWarehouseItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: () => void;
}

const AddWarehouseItemModal: React.FC<AddWarehouseItemModalProps> = ({ isOpen, onClose, onItemAdded }) => {
  const [formData, setFormData] = useState({
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('price') || name.includes('quantity') ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      await invoke('add_warehouse_item', {
        sessionToken,
        name: formData.name,
        brand: formData.brand,
        article: formData.article,
        locationCell: formData.location_cell,
        quantity: formData.quantity,
        minQuantity: formData.min_quantity,
        purchasePrice: formData.purchase_price,
        sellingPrice: formData.selling_price
      });

      alert('Новая позиция успешно добавлена на склад!');
      onItemAdded();
      onClose();
    } catch (error) {
      console.error('Error adding warehouse item:', error);
      alert('Ошибка при добавлении позиции на склад: ' + error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>➕ ДОБАВИТЬ ПОЗИЦИЮ НА СКЛАД</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Название детали:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="brand">Бренд:</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="article">Артикул:</label>
              <input
                type="text"
                id="article"
                name="article"
                value={formData.article}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="location_cell">Ячейка на складе:</label>
              <input
                type="text"
                id="location_cell"
                name="location_cell"
                value={formData.location_cell}
                onChange={handleInputChange}
                placeholder="A-01-01"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="quantity">Количество:</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="min_quantity">Мин. остаток:</label>
              <input
                type="number"
                id="min_quantity"
                name="min_quantity"
                value={formData.min_quantity}
                onChange={handleInputChange}
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="purchase_price">Закупочная цена:</label>
              <input
                type="number"
                id="purchase_price"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="selling_price">Цена продажи:</label>
              <input
                type="number"
                id="selling_price"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              ❌ ОТМЕНА
            </button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Добавление...' : '✅ ДОБАВИТЬ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWarehouseItemModal;