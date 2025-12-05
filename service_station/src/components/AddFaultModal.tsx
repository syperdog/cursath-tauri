import React, { useState } from 'react';
import './AddFaultModal.css';

// Типы данных для неисправности
type FaultCategory = {
  id: string;
  name: string;
};

type FaultType = {
  id: string;
  name: string;
  categoryId: string;
};

type Props = {
  onClose: () => void;
  onAddFault: (fault: { category: string; type: string; comment: string }) => void;
};

const AddFaultModal: React.FC<Props> = ({ onClose, onAddFault }) => {
  // Состояния для категории, типа неисправности и комментария
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFaultType, setSelectedFaultType] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  // Пример справочника неисправностей
  const faultCategories: FaultCategory[] = [
    { id: 'suspension', name: 'Подвеска' },
    { id: 'brakes', name: 'Тормоза' },
    { id: 'engine', name: 'Двигатель' },
    { id: 'electrical', name: 'Электрооборудование' },
  ];

  const faultTypes: FaultType[] = [
    { id: 'ball_joint', name: 'Люфт шаровой опоры', categoryId: 'suspension' },
    { id: 'brake_pad_wear', name: 'Износ колодок', categoryId: 'brakes' },
    { id: 'engine_oil_leak', name: 'Течь масла', categoryId: 'engine' },
    { id: 'battery_corrosion', name: 'Окисление клемм', categoryId: 'electrical' },
  ];

  // Фильтрация типов неисправностей по выбранной категории
  const filteredFaultTypes = faultTypes.filter(
    fault => fault.categoryId === selectedCategory
  );

  // Обработчик добавления неисправности
  const handleAdd = () => {
    if (selectedCategory && selectedFaultType && comment) {
      onAddFault({
        category: selectedCategory,
        type: selectedFaultType,
        comment: comment
      });
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>🔧 ДОБАВИТЬ НЕИСПРАВНОСТЬ</h2>
          <button className="close-button" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>КАТЕГОРИЯ:</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedFaultType(''); // Сбросить тип при смене категории
              }}
            >
              <option value="">Выберите категорию</option>
              {faultCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>НЕИСПРАВНОСТЬ:</label>
            <select 
              value={selectedFaultType} 
              onChange={(e) => setSelectedFaultType(e.target.value)}
              disabled={!selectedCategory}
            >
              <option value="">Выберите неисправность</option>
              {filteredFaultTypes.map(fault => (
                <option key={fault.id} value={fault.id}>
                  {fault.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>КОММЕНТАРИЙ (Детали, сторона, степень износа):</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Передний левый рычаг, пыльник порван"
              rows={3}
            />
            <textarea
              value=""
              onChange={() => {}}
              placeholder="________________________________________________________"
              rows={1}
              readOnly
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="add-button" onClick={handleAdd}>💾 ДОБАВИТЬ В СПИСОК</button>
        </div>
      </div>
    </div>
  );
};

export default AddFaultModal;