import React, { useState } from 'react';
import './NewClientModal.css';

interface NewClient {
  full_name: string;
  phone: string;
  address: string | null;
}

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: NewClient) => void;
}

const NewClientModal: React.FC<NewClientModalProps> = ({ isOpen, onClose, onClientCreated }) => {
  const [newClient, setNewClient] = useState<NewClient>({ full_name: '', phone: '', address: null });

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newClient.full_name || !newClient.phone) {
      alert('Пожалуйста, заполните обязательные поля: ФИО и телефон');
      return;
    }
    
    onClientCreated(newClient);
    setNewClient({ full_name: '', phone: '', address: null });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>👤 НОВЫЙ КЛИЕНТ</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>
        
        <div className="modal-body">
          <div className="input-group">
            <label htmlFor="full_name">ФИО:</label>
            <input
              id="full_name"
              type="text"
              value={newClient.full_name}
              onChange={(e) => setNewClient({...newClient, full_name: e.target.value})}
              placeholder="Иванов Иван Иванович"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="phone">Телефон:</label>
            <input
              id="phone"
              type="tel"
              value={newClient.phone}
              onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
              placeholder="+375 (XX) XXX-XX-XX"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="address">Адрес:</label>
            <input
              id="address"
              type="text"
              value={newClient.address || ''}
              onChange={(e) => setNewClient({...newClient, address: e.target.value || null})}
              placeholder="г. Минск, ул. Ленина, д. 1"
            />
          </div>
          
          <div className="modal-actions">
            <button className="primary-btn" onClick={handleSave}>💾 СОХРАНИТЬ</button>
            <button className="secondary-btn" onClick={onClose}>ОТМЕНА</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewClientModal;