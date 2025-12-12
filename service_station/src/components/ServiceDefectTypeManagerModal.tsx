import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ServiceDefectTypeManagerModal.css';
import { Service } from '../types/service';
import { DefectNode, DefectType } from '../types/defect';

interface ServiceDefectTypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NewService {
  name: string;
  basePrice: number;
  normHours: number;
}

interface NewDefectNode {
  name: string;
  description: string | null;
}

interface NewDefectType {
  nodeId: number;
  name: string;
  description: string | null;
}

const ServiceDefectTypeManagerModal: React.FC<ServiceDefectTypeManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'services' | 'defectNodes' | 'defectTypes'>('services');
  
  // Состояния для услуг
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState<NewService>({
    name: '',
    basePrice: 0,
    normHours: 0
  });
  const [loadingServices, setLoadingServices] = useState(false);
  
  // Состояния для узлов неисправностей
  const [defectNodes, setDefectNodes] = useState<DefectNode[]>([]);
  const [newDefectNode, setNewDefectNode] = useState<NewDefectNode>({
    name: '',
    description: null
  });
  const [loadingDefectNodes, setLoadingDefectNodes] = useState(false);
  
  // Состояния для типов неисправностей
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [newDefectType, setNewDefectType] = useState<NewDefectType>({
    nodeId: 0,
    name: '',
    description: null
  });
  const [loadingDefectTypes, setLoadingDefectTypes] = useState(false);

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      loadServices();
      loadDefectNodes();
      loadDefectTypes();
    }
  }, [isOpen]);

  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const servicesData: Service[] = await invoke('get_all_services');
      setServices(servicesData);
    } catch (error) {
      console.error('Error loading services:', error);
      alert(`Ошибка загрузки услуг: ${error}`);
    } finally {
      setLoadingServices(false);
    }
  };

  const loadDefectNodes = async () => {
    setLoadingDefectNodes(true);
    try {
      const nodesData: DefectNode[] = await invoke('get_defect_nodes');
      setDefectNodes(nodesData);
    } catch (error) {
      console.error('Error loading defect nodes:', error);
      alert(`Ошибка загрузки узлов неисправностей: ${error}`);
    } finally {
      setLoadingDefectNodes(false);
    }
  };

  const loadDefectTypes = async () => {
    setLoadingDefectTypes(true);
    try {
      const typesData: DefectType[] = await invoke('get_all_defect_types');
      setDefectTypes(typesData);
    } catch (error) {
      console.error('Error loading defect types:', error);
      alert(`Ошибка загрузки типов неисправностей: ${error}`);
    } finally {
      setLoadingDefectTypes(false);
    }
  };

  const handleCreateService = async () => {
    if (!newService.name) {
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

      const result = await invoke<string>('create_service_with_json', {
        request: {
          sessionToken,
          name: newService.name,
          basePrice: newService.basePrice,
          normHours: newService.normHours
        }
      });

      alert(result);
      setNewService({ name: '', basePrice: 0, normHours: 0 });
      loadServices(); // Обновляем список услуг
    } catch (error) {
      console.error('Error creating service:', error);
      alert(`Ошибка при создании услуги: ${error}`);
    }
  };

  const handleCreateDefectNode = async () => {
    if (!newDefectNode.name) {
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

      const result = await invoke<string>('create_defect_node_with_json', {
        request: {
          sessionToken,
          name: newDefectNode.name,
          description: newDefectNode.description || null
        }
      });

      alert(result);
      setNewDefectNode({ name: '', description: null });
      loadDefectNodes(); // Обновляем список узлов
    } catch (error) {
      console.error('Error creating defect node:', error);
      alert(`Ошибка при создании узла: ${error}`);
    }
  };

  const handleCreateDefectType = async () => {
    if (!newDefectType.name || newDefectType.nodeId === 0) {
      alert('Выберите узел и укажите название неисправности');
      return;
    }

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      const result = await invoke<string>('create_defect_type_with_json', {
        request: {
          sessionToken,
          nodeId: newDefectType.nodeId,
          name: newDefectType.name,
          description: newDefectType.description || null
        }
      });

      alert(result);
      setNewDefectType({ nodeId: 0, name: '', description: null });
      loadDefectTypes(); // Обновляем список типов неисправностей
    } catch (error) {
      console.error('Error creating defect type:', error);
      alert(`Ошибка при создании типа неисправности: ${error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 МЕНЕДЖЕР СПРАВОЧНИКОВ</h2>
          <button className="close-btn" onClick={onClose}>✖ ЗАКРЫТЬ</button>
        </div>

        <div className="modal-body">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              УСЛУГИ
            </button>
            <button
              className={`tab ${activeTab === 'defectNodes' ? 'active' : ''}`}
              onClick={() => setActiveTab('defectNodes')}
            >
              УЗЛЫ НЕИСПРАВНОСТЕЙ
            </button>
            <button
              className={`tab ${activeTab === 'defectTypes' ? 'active' : ''}`}
              onClick={() => setActiveTab('defectTypes')}
            >
              ТИПЫ НЕИСПРАВНОСТЕЙ
            </button>
          </div>

          {activeTab === 'services' && (
            <div className="services-tab">
              <div className="form-section">
                <h3>📋 СОЗДАТЬ НОВУЮ УСЛУГУ</h3>
                <div className="input-group">
                  <label htmlFor="service-name">Название услуги:</label>
                  <input
                    id="service-name"
                    type="text"
                    value={newService.name}
                    onChange={(e) => setNewService({...newService, name: e.target.value})}
                    placeholder="Например: Замена масла"
                  />
                </div>
                <div className="input-grid">
                  <div className="input-group">
                    <label htmlFor="base-price">Базовая цена:</label>
                    <input
                      id="base-price"
                      type="number"
                      step="0.01"
                      value={newService.basePrice}
                      onChange={(e) => setNewService({...newService, basePrice: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="norm-hours">Нормо-часы:</label>
                    <input
                      id="norm-hours"
                      type="number"
                      step="0.01"
                      value={newService.normHours}
                      onChange={(e) => setNewService({...newService, normHours: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <button className="primary-btn" onClick={handleCreateService}>
                  ➕ СОЗДАТЬ УСЛУГУ
                </button>
              </div>

              <div className="list-section">
                <h3>📋 СУЩЕСТВУЮЩИЕ УСЛУГИ</h3>
                {loadingServices ? (
                  <p>Загрузка услуг...</p>
                ) : (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Цена</th>
                        <th>Нормо-часы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(service => (
                        <tr key={service.id}>
                          <td>{service.name}</td>
                          <td>{service.base_price}</td>
                          <td>{service.norm_hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'defectNodes' && (
            <div className="defect-nodes-tab">
              <div className="form-section">
                <h3>🔧 СОЗДАТЬ НОВЫЙ УЗЕЛ НЕИСПРАВНОСТЕЙ</h3>
                <div className="input-group">
                  <label htmlFor="defect-node-name">Название узла:</label>
                  <input
                    id="defect-node-name"
                    type="text"
                    value={newDefectNode.name}
                    onChange={(e) => setNewDefectNode({...newDefectNode, name: e.target.value})}
                    placeholder="Например: Подвеска"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="defect-node-description">Описание:</label>
                  <textarea
                    id="defect-node-description"
                    value={newDefectNode.description || ''}
                    onChange={(e) => setNewDefectNode({...newDefectNode, description: e.target.value || null})}
                    placeholder="Дополнительная информация об узле"
                    rows={2}
                  />
                </div>
                <button className="primary-btn" onClick={handleCreateDefectNode}>
                  ➕ СОЗДАТЬ УЗЕЛ
                </button>
              </div>

              <div className="list-section">
                <h3>🔧 СУЩЕСТВУЮЩИЕ УЗЛЫ НЕИСПРАВНОСТЕЙ</h3>
                {loadingDefectNodes ? (
                  <p>Загрузка узлов...</p>
                ) : (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defectNodes.map(node => (
                        <tr key={node.id}>
                          <td>{node.name}</td>
                          <td>{node.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'defectTypes' && (
            <div className="defect-types-tab">
              <div className="form-section">
                <h3>🔧 СОЗДАТЬ НОВУЮ НЕИСПРАВНОСТЬ</h3>
                <div className="input-group">
                  <label htmlFor="defect-type-node">Узел:</label>
                  <select
                    id="defect-type-node"
                    value={newDefectType.nodeId}
                    onChange={(e) => setNewDefectType({...newDefectType, nodeId: parseInt(e.target.value)})}
                  >
                    <option value={0}>Выберите узел</option>
                    {defectNodes.map(node => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="defect-type-name">Название неисправности:</label>
                  <input
                    id="defect-type-name"
                    type="text"
                    value={newDefectType.name}
                    onChange={(e) => setNewDefectType({...newDefectType, name: e.target.value})}
                    placeholder="Например: Скрип подвески"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="defect-type-description">Описание:</label>
                  <textarea
                    id="defect-type-description"
                    value={newDefectType.description || ''}
                    onChange={(e) => setNewDefectType({...newDefectType, description: e.target.value || null})}
                    placeholder="Детальное описание неисправности"
                    rows={2}
                  />
                </div>
                <button className="primary-btn" onClick={handleCreateDefectType}>
                  ➕ СОЗДАТЬ НЕИСПРАВНОСТЬ
                </button>
              </div>

              <div className="list-section">
                <h3>🔧 СУЩЕСТВУЮЩИЕ ТИПЫ НЕИСПРАВНОСТЕЙ</h3>
                {loadingDefectTypes ? (
                  <p>Загрузка типов неисправностей...</p>
                ) : (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Узел</th>
                        <th>Неисправность</th>
                        <th>Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defectTypes.map(type => (
                        <tr key={type.id}>
                          <td>{type.node_name}</td>
                          <td>{type.name}</td>
                          <td>{type.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDefectTypeManagerModal;