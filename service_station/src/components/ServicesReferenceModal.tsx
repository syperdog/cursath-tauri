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
  description: string | null;
}

interface DefectType {
  id: number;
  node_id: number;
  node_name: string;
  name: string;
  description: string | null;
}

interface Defect {
  id: number;
  order_id: number;
  diagnostician_id: number;
  defect_description: string; // узел/неисправность
  diagnostician_comment: string | null; // детальное описание
  is_confirmed: boolean;
  defect_type_id: number | null;
}

interface ServicesReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ServicesReferenceModal: React.FC<ServicesReferenceModalProps> = ({ isOpen, onClose }) => {
  // Состояния для услуг
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    base_price: '',
    norm_hours: ''
  });

  // Состояния для узлов
  const [defectNodes, setDefectNodes] = useState<DefectNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [showNewNodeForm, setShowNewNodeForm] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');

  // Состояния для неисправностей
  const [newDefect, setNewDefect] = useState({
    description: '',
    comment: ''
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadServices();
      loadDefectNodes();
    }
  }, [isOpen]);

  const loadDefectNodes = async () => {
    try {
      const nodes = await invoke<DefectNode[]>('get_defect_nodes');
      setDefectNodes(nodes);
    } catch (error) {
      console.error('Error loading defect nodes:', error);
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

  const handleCreateService = async () => {
    if (!newService.name.trim()) {
      alert('Название услуги не может быть пустым');
      return;
    }

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
      setShowNewServiceForm(false);

      // Reload services
      await loadServices();
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Ошибка при создании услуги: ' + error);
    }
  };

  const handleCreateDefectNode = async () => {
    if (!newNodeName.trim()) {
      alert('Название узла не может быть пустым');
      return;
    }

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      const newNode: DefectNode = await invoke('create_defect_node', {
        sessionToken,
        name: newNodeName,
        description: newNodeDescription || null
      });

      // Обновляем список узлов
      setDefectNodes([...defectNodes, newNode]);
      setSelectedNodeId(newNode.id);
      setNewNodeName('');
      setNewNodeDescription('');
      setShowNewNodeForm(false);

      alert('Новый узел успешно создан!');
    } catch (error) {
      console.error('Error creating defect node:', error);
      alert('Ошибка при создании узла: ' + error);
    }
  };

  const handleCreateDefect = async () => {
    if (!selectedServiceId) {
      alert('Пожалуйста, выберите услугу');
      return;
    }

    if (!selectedNodeId) {
      alert('Пожалуйста, выберите узел');
      return;
    }

    if (!newDefect.description.trim()) {
      alert('Описание неисправности не может быть пустым');
      return;
    }

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      // Создаем новый тип неисправности
      // Примечание: в текущей реализации мы создаем новый тип неисправности, привязанный к узлу
      // В справочнике услуг не предполагается создание записей о неисправностях в контексте заказа
      await invoke('create_defect_type', {
        sessionToken,
        nodeId: selectedNodeId,
        name: newDefect.description,
        description: newDefect.comment || null
      });

      // Сбросить форму создания неисправности
      setNewDefect({ description: '', comment: '' });

      alert('Неисправность успешно создана и привязана к узлу!');
    } catch (error) {
      console.error('Error creating defect:', error);
      alert('Ошибка при создании неисправности: ' + error);
    }
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
          {/* Выбор/создание услуги */}
          <div className="service-selection-section">
            <h3>🔧 ВЫБОР УСЛУГИ</h3>
            <div className="select-with-create">
              <select
                value={selectedServiceId || ''}
                onChange={(e) => setSelectedServiceId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Выберите услугу</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="create-btn"
                onClick={() => {
                  setShowNewServiceForm(true);
                }}
              >
                ➕ НОВАЯ УСЛУГА
              </button>
            </div>

            {showNewServiceForm && (
              <div className="create-form">
                <h4>СОЗДАТЬ НОВУЮ УСЛУГУ</h4>
                <div className="input-group">
                  <label htmlFor="newServiceName">Название услуги:</label>
                  <input
                    id="newServiceName"
                    type="text"
                    value={newService.name}
                    onChange={(e) => setNewService({...newService, name: e.target.value})}
                    placeholder="Например: Диагностика двигателя"
                  />
                </div>
                <div className="input-grid">
                  <div className="input-group">
                    <label htmlFor="newServiceBasePrice">Базовая цена:</label>
                    <input
                      id="newServiceBasePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newService.base_price}
                      onChange={(e) => setNewService({...newService, base_price: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="newServiceNormHours">Нормо-часы:</label>
                    <input
                      id="newServiceNormHours"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newService.norm_hours}
                      onChange={(e) => setNewService({...newService, norm_hours: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="secondary-btn" onClick={handleCreateService}>
                    🛠️ СОЗДАТЬ УСЛУГУ
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowNewServiceForm(false);
                      setNewService({ name: '', base_price: '', norm_hours: '' });
                    }}
                  >
                    ❌ ОТМЕНА
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Выбор/создание узла */}
          <div className="node-selection-section">
            <h3>🔧 ВЫБОР УЗЛА</h3>
            <div className="select-with-create">
              <select
                value={selectedNodeId || ''}
                onChange={(e) => setSelectedNodeId(e.target.value ? parseInt(e.target.value) : null)}
                disabled={!selectedServiceId}
              >
                <option value="">Выберите узел</option>
                {defectNodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="create-btn"
                disabled={!selectedServiceId}
                onClick={() => {
                  setShowNewNodeForm(true);
                }}
              >
                ➕ НОВЫЙ УЗЕЛ
              </button>
            </div>

            {showNewNodeForm && (
              <div className="create-form">
                <h4>СОЗДАТЬ НОВЫЙ УЗЕЛ</h4>
                <div className="input-group">
                  <label htmlFor="newNodeName">Название узла:</label>
                  <input
                    id="newNodeName"
                    type="text"
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    placeholder="Например: Двигатель"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="newNodeDescription">Описание:</label>
                  <textarea
                    id="newNodeDescription"
                    value={newNodeDescription}
                    onChange={(e) => setNewNodeDescription(e.target.value)}
                    placeholder="Описание узла"
                    rows={2}
                  />
                </div>
                <div className="form-actions">
                  <button className="secondary-btn" onClick={handleCreateDefectNode}>
                    🛠️ СОЗДАТЬ УЗЕЛ
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowNewNodeForm(false);
                      setNewNodeName('');
                      setNewNodeDescription('');
                    }}
                  >
                    ❌ ОТМЕНА
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Создание неисправности */}
          <div className="defect-creation-section">
            <h3>🔧 СОЗДАНИЕ НЕИСПРАВНОСТИ</h3>
            <div className="input-group">
              <label htmlFor="defectDescription">Описание неисправности:</label>
              <input
                id="defectDescription"
                type="text"
                value={newDefect.description}
                onChange={(e) => setNewDefect({...newDefect, description: e.target.value})}
                placeholder="Например: Стук в двигателе"
                disabled={!selectedServiceId || !selectedNodeId}
              />
            </div>
            <div className="input-group">
              <label htmlFor="defectComment">Комментарий:</label>
              <textarea
                id="defectComment"
                value={newDefect.comment}
                onChange={(e) => setNewDefect({...newDefect, comment: e.target.value})}
                placeholder="Дополнительная информация"
                rows={2}
                disabled={!selectedServiceId || !selectedNodeId}
              />
            </div>
            <button
              className="primary-btn"
              onClick={handleCreateDefect}
              disabled={!selectedServiceId || !selectedNodeId || !newDefect.description.trim()}
            >
              🛠️ СОЗДАТЬ НЕИСПРАВНОСТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesReferenceModal;