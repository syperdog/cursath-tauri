import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ServicesReferenceModal.css';

interface Service {
  id: number;
  name: string;
  base_price: string; // DECIMAL as string
  norm_hours: string; // DECIMAL as string
}

interface DefectNode {
  id: number;
  name: string;
  description: string;
}

interface DefectType {
  id: number;
  node_id: number;
  node_name: string;
  name: string;
  description: string;
}

interface DefectNodeWithTypes {
  node_id: number;
  node_name: string;
  node_description: string;
  defect_types: DefectType[];
}

interface ServicesReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ServicesReferenceModal: React.FC<ServicesReferenceModalProps> = ({ isOpen, onClose }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newService, setNewService] = useState({
    name: '',
    base_price: '',
    norm_hours: ''
  });
  const [defectTypesGrouped, setDefectTypesGrouped] = useState<DefectNodeWithTypes[]>([]);
  const [selectedDefectTypes, setSelectedDefectTypes] = useState<number[]>([]);
  const [editingServiceDefectTypes, setEditingServiceDefectTypes] = useState<DefectType[]>([]);
  const [showDefectTypesModal, setShowDefectTypesModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadServices();
      loadDefectTypes();
    }
  }, [isOpen]);

  const loadDefectTypes = async () => {
    try {
      const defectTypesData = await invoke<DefectNodeWithTypes[]>('get_all_defect_types_grouped');
      setDefectTypesGrouped(defectTypesData);
    } catch (error) {
      console.error('Error loading defect types:', error);
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      const servicesData = await invoke<Service[]>('get_all_services');
      setServices(servicesData);
    } catch (error) {
      console.error('Error loading services:', error);
      alert('Ошибка при загрузке услуг: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      await invoke('create_service', {
        sessionToken,
        name: newService.name,
        basePrice: parseFloat(newService.base_price) || 0,
        normHours: parseFloat(newService.norm_hours) || 0
      });

      // Reset form
      setNewService({ name: '', base_price: '', norm_hours: '' });

      // Reload services
      await loadServices();
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Ошибка при создании услуги: ' + error);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingService) return;

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      await invoke('update_service', {
        sessionToken,
        serviceId: editingService.id,
        name: editingService.name,
        basePrice: parseFloat(editingService.base_price) || 0,
        normHours: parseFloat(editingService.norm_hours) || 0
      });

      // Close edit mode
      setEditingService(null);

      // Reload services
      await loadServices();
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Ошибка при обновлении услуги: ' + error);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту услугу?')) {
      return;
    }

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      await invoke('delete_service', {
        sessionToken,
        serviceId: id
      });

      // Reload services
      await loadServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Ошибка при удалении услуги: ' + error);
    }
  };

  const handleEditClick = (service: Service) => {
    setEditingService(service);
  };

  const handleCancelEdit = () => {
    setEditingService(null);
    setShowDefectTypesModal(false); // Закрываем модальное окно связей
  };

  const handleEditDefectTypes = async (serviceId: number) => {
    try {
      const serviceDefectTypes = await invoke<DefectType[]>('get_service_defect_types', { serviceId });
      setEditingServiceDefectTypes(serviceDefectTypes);

      // Устанавливаем выбранные типы неисправностей для модального окна
      setSelectedDefectTypes(serviceDefectTypes.map(dt => dt.id));
      setShowDefectTypesModal(true);
    } catch (error) {
      console.error('Error loading service defect types:', error);
      alert('Ошибка при загрузке связанных типов неисправностей: ' + error);
    }
  };

  const handleSaveDefectTypes = async () => {
    if (!editingService) return;

    try {
      await invoke('link_service_to_defect_type', {
        serviceId: editingService.id,
        defectTypeIds: selectedDefectTypes
      });

      // Обновляем отображение типов неисправностей для редактируемой услуги
      const updatedServiceDefectTypes = defectTypesGrouped.flatMap(node =>
        node.defect_types.filter(dt => selectedDefectTypes.includes(dt.id))
      );

      setEditingServiceDefectTypes(updatedServiceDefectTypes);
      setShowDefectTypesModal(false);
      alert('Связи с типами неисправностей успешно сохранены!');
    } catch (error) {
      console.error('Error saving defect types:', error);
      alert('Ошибка при сохранении связей с типами неисправностей: ' + error);
    }
  };

  const toggleDefectType = (defectTypeId: number) => {
    setSelectedDefectTypes(prev =>
      prev.includes(defectTypeId)
        ? prev.filter(id => id !== defectTypeId)
        : [...prev, defectTypeId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="services-reference-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 СПРАВОЧНИК УСЛУГ</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          <div className="add-service-form">
            <h3>➕ ДОБАВИТЬ НОВУЮ УСЛУГУ</h3>
            <form onSubmit={handleCreateService}>
              <div className="input-group">
                <label htmlFor="serviceName">Название услуги:</label>
                <input
                  id="serviceName"
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService({...newService, name: e.target.value})}
                  placeholder="Например: Диагностика двигателя"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="serviceBasePrice">Базовая цена:</label>
                <input
                  id="serviceBasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newService.base_price}
                  onChange={(e) => setNewService({...newService, base_price: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="serviceNormHours">Нормо-часы:</label>
                <input
                  id="serviceNormHours"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newService.norm_hours}
                  onChange={(e) => setNewService({...newService, norm_hours: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <button type="submit" className="add-service-btn">➕ ДОБАВИТЬ УСЛУГУ</button>
            </form>
          </div>

          <div className="services-list">
            <h3>📋 СПИСОК УСЛУГ:</h3>

            {loading ? (
              <p>Загрузка услуг...</p>
            ) : services.length === 0 ? (
              <p>Нет сохраненных услуг</p>
            ) : (
              <table className="services-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Название</th>
                    <th>Базовая цена</th>
                    <th>Нормо-часы</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id}>
                      {editingService && editingService.id === service.id ? (
                        <>
                          <td>{service.id}</td>
                          <td>
                            <input
                              type="text"
                              value={editingService.name}
                              onChange={(e) => setEditingService({...editingService, name: e.target.value})}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingService.base_price}
                              onChange={(e) => setEditingService({...editingService, base_price: e.target.value})}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingService.norm_hours}
                              onChange={(e) => setEditingService({...editingService, norm_hours: e.target.value})}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <button
                              className="edit-defect-types-btn"
                              onClick={() => handleEditDefectTypes(service.id)}
                            >
                              📋 Узлы/неиспр.
                            </button>
                            <button
                              className="save-btn"
                              onClick={handleUpdateService}
                            >
                              ✅ Сохранить
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={handleCancelEdit}
                            >
                              ❌ Отмена
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{service.id}</td>
                          <td>{service.name}</td>
                          <td>{parseFloat(service.base_price).toFixed(2)}</td>
                          <td>{parseFloat(service.norm_hours).toFixed(2)}</td>
                          <td>
                            <div>
                              <button
                                className="edit-btn"
                                onClick={() => handleEditClick(service)}
                              >
                                📝 Редакт.
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteService(service.id)}
                              >
                                🗑️ Удалить
                              </button>
                              <button
                                className="view-defect-types-btn"
                                onClick={() => handleEditDefectTypes(service.id)}
                                title="Посмотреть связанные узлы/неисправности"
                              >
                                📋 Узлы/неиспр.
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно для выбора типов неисправностей */}
      {showDefectTypesModal && editingService && (
        <div className="modal-overlay" onClick={() => setShowDefectTypesModal(false)}>
          <div className="defect-types-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 СВЯЗЬ УСЛУГИ С НЕИСПРАВНОСТЯМИ: {editingService.name}</h2>
              <button className="close-btn" onClick={() => setShowDefectTypesModal(false)}>✖ ЗАКРЫТЬ</button>
            </div>

            <div className="defect-types-content">
              <div className="defect-nodes-list">
                {defectTypesGrouped.map(node => (
                  <div key={node.node_id} className="defect-node-section">
                    <h3>{node.node_name}</h3>
                    <div className="defect-types-grid">
                      {node.defect_types.map(defectType => (
                        <label key={defectType.id} className="defect-type-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedDefectTypes.includes(defectType.id)}
                            onChange={() => toggleDefectType(defectType.id)}
                          />
                          <span className="defect-type-name">{defectType.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="defect-types-actions">
                <button
                  className="save-defect-types-btn"
                  onClick={handleSaveDefectTypes}
                >
                  ✅ СОХРАНИТЬ СВЯЗИ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesReferenceModal;