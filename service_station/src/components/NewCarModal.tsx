import React, { useState } from 'react';
import './NewCarModal.css';

interface NewCar {
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  production_year: number | null;
  mileage: number;
}

interface NewCarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCarCreated: (car: NewCar) => void;
}

const NewCarModal: React.FC<NewCarModalProps> = ({ isOpen, onClose, onCarCreated }) => {
  const [newCar, setNewCar] = useState<NewCar>({ 
    vin: null, 
    license_plate: null, 
    make: '', 
    model: '', 
    production_year: null, 
    mileage: 0 
  });
  const [loadingVin, setLoadingVin] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newCar.make || !newCar.model || !newCar.license_plate) {
      alert('Пожалуйста, заполните обязательные поля: марка, модель и гос. номер');
      return;
    }
    
    onCarCreated(newCar);
    setNewCar({ 
      vin: null, 
      license_plate: null, 
      make: '', 
      model: '', 
      production_year: null, 
      mileage: 0 
    });
    onClose();
  };

  const handleVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vin = e.target.value;
    setNewCar({...newCar, vin: vin || null});
    
    // Auto-fill from VIN functionality (simulated)
    if (vin && vin.length === 17) {
      setLoadingVin(true);
      // Simulate API call to decode VIN
      setTimeout(() => {
        // In a real application, this would come from a VIN decoding API
        setNewCar(prev => ({
          ...prev,
          make: 'Toyota',
          model: 'Camry',
          production_year: 2020
        }));
        setLoadingVin(false);
      }, 1000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚗 НОВЫЙ АВТОМОБИЛЬ</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>
        
        <div className="modal-body">
          <div className="input-group">
            <label htmlFor="vin">VIN:</label>
            <div style={{ display: 'flex' }}>
              <input
                id="vin"
                type="text"
                value={newCar.vin || ''}
                onChange={handleVinChange}
                placeholder="Введите 17-значный VIN"
                maxLength={17}
              />
              {loadingVin && <span>🔄</span>}
            </div>
            <p className="vin-info">ℹ️ После ввода VIN марка, модель и год заполнятся автоматически</p>
          </div>
          
          <div className="input-group">
            <label htmlFor="make">Марка:</label>
            <input
              id="make"
              type="text"
              value={newCar.make}
              onChange={(e) => setNewCar({...newCar, make: e.target.value})}
              placeholder="Например: Toyota"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="model">Модель:</label>
            <input
              id="model"
              type="text"
              value={newCar.model}
              onChange={(e) => setNewCar({...newCar, model: e.target.value})}
              placeholder="Например: Camry"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="license_plate">Госномер:</label>
            <input
              id="license_plate"
              type="text"
              value={newCar.license_plate || ''}
              onChange={(e) => setNewCar({...newCar, license_plate: e.target.value || null})}
              placeholder="Например: A 123 AA 77"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="production_year">Год выпуска:</label>
            <input
              id="production_year"
              type="number"
              value={newCar.production_year || ''}
              onChange={(e) => setNewCar({...newCar, production_year: e.target.value ? parseInt(e.target.value) : null})}
              placeholder="Например: 2020"
              min="1900"
              max="2030"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="mileage">Пробег (км):</label>
            <input
              id="mileage"
              type="number"
              value={newCar.mileage}
              onChange={(e) => setNewCar({...newCar, mileage: e.target.value ? parseInt(e.target.value) : 0})}
              placeholder="Например: 50000"
              min="0"
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

export default NewCarModal;