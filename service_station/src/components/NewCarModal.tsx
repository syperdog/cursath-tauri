import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './NewCarModal.css';

interface Client {
  id: number;
  full_name: string;
  phone: string;
  address: string | null;
  created_at: string;
}

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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingVin, setLoadingVin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      setLoadingClients(true);
      const clientList: Client[] = await invoke('get_all_clients');
      setClients(clientList);
    } catch (error) {
      console.error('Error loading clients:', error);
      alert(`Ошибка при загрузке клиентов: ${error}`);
    } finally {
      setLoadingClients(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newCar.make || !newCar.model || !newCar.license_plate) {
      alert('Пожалуйста, заполните обязательные поля: марка, модель и гос. номер');
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

      // Вызываем Tauri команду для создания автомобиля
      const result = await invoke<string>('create_car', {
        session_token: sessionToken,
        client_id: selectedClient, // Используем выбранного клиента
        vin: newCar.vin,
        license_plate: newCar.license_plate,
        make: newCar.make,
        model: newCar.model,
        production_year: newCar.production_year,
        mileage: newCar.mileage
      });

      console.log(result); // Логируем результат

      // Вызываем колбэк с созданным автомобилем
      onCarCreated(newCar);
      setNewCar({
        vin: null,
        license_plate: null,
        make: '',
        model: '',
        production_year: null,
        mileage: 0
      });
      setSelectedClient(null); // Сбрасываем выбор клиента
      onClose();

      // Показываем сообщение об успешном создании
      alert('Автомобиль успешно создан!');
    } catch (error) {
      console.error('Error creating car:', error);
      alert(`Ошибка при создании автомобиля: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVinChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vin = e.target.value;
    setNewCar({...newCar, vin: vin || null});

    // Auto-fill from VIN functionality (using API)
    if (vin && vin.length === 17) {
      setLoadingVin(true);
      try {
        // Using the API Ninja VIN lookup service
        const response = await fetch(`https://api.api-ninjas.com/v1/vinlookup?vin=${vin}`, {
          method: 'GET',
          headers: {
            'X-Api-Key': 'BthsIknzxcAwqBYBy/ni/A==wvRJXJtBFnnNzkvP',
          }
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data && data[0]) {
          const vehicleInfo = data[0];
          setNewCar(prev => ({
            ...prev,
            make: vehicleInfo.make || '',
            model: vehicleInfo.model || '',
            production_year: vehicleInfo.year || null
          }));
        }
      } catch (error) {
        console.error('Error decoding VIN:', error);
        alert(`Ошибка при декодировании VIN: ${error}`);
      } finally {
        setLoadingVin(false);
      }
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
            <label htmlFor="client-select">Клиент:</label>
            {loadingClients ? (
              <div>Загрузка клиентов...</div>
            ) : (
              <select
                id="client-select"
                value={selectedClient || ''}
                onChange={(e) => setSelectedClient(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Выберите клиента</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} ({client.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

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

export default NewCarModal;