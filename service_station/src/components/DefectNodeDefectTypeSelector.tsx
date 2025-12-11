import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DefectNode, DefectType } from '../types/defect';
import './DefectNodeDefectTypeSelector.css';

interface Props {
  selectedNodeId?: number;
  selectedTypeId?: number;
  onSelectNode: (nodeId: number) => void;
  onSelectType: (typeId: number) => void;
  showCreateOptions?: boolean;
  userRole?: string;
}

const DefectNodeDefectTypeSelector: React.FC<Props> = ({
  selectedNodeId = 0,
  selectedTypeId = 0,
  onSelectNode,
  onSelectType,
  showCreateOptions = true,
  userRole
}) => {
  // По умолчанию показываем кнопки создания только для администратора
  const canCreate = userRole === 'Admin';
  const [defectNodes, setDefectNodes] = useState<DefectNode[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewNodeForm, setShowNewNodeForm] = useState(false);
  const [showNewDefectTypeForm, setShowNewDefectTypeForm] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [newDefectTypeName, setNewDefectTypeName] = useState('');
  const [newDefectTypeDescription, setNewDefectTypeDescription] = useState('');

  // Загрузка узлов неисправностей при монтировании
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const nodes = await invoke<DefectNode[]>('get_defect_nodes');
        setDefectNodes(nodes);
      } catch (error) {
        console.error('Error loading defect nodes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNodes();
  }, []);

  // Загрузка типов неисправностей при изменении выбранного узла
  useEffect(() => {
    const loadTypes = async () => {
      if (selectedNodeId > 0) {
        try {
          setLoading(true);
          const types = await invoke<DefectType[]>('get_defect_types_by_node', { nodeId: selectedNodeId });
          setDefectTypes(types);
        } catch (error) {
          console.error('Error loading defect types:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setDefectTypes([]);
      }
    };

    loadTypes();
  }, [selectedNodeId]);

  const handleCreateNode = async () => {
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
        description: newNodeDescription
      });

      // Обновляем список узлов
      setDefectNodes([...defectNodes, newNode]);
      onSelectNode(newNode.id);
      setNewNodeName('');
      setNewNodeDescription('');
      setShowNewNodeForm(false);

      alert('Новый узел успешно создан!');
    } catch (error) {
      console.error('Error creating defect node:', error);
      alert('Ошибка при создании узла: ' + error);
    }
  };

  const handleCreateDefectType = async () => {
    if (!newDefectTypeName.trim()) {
      alert('Название неисправности не может быть пустым');
      return;
    }

    if (!selectedNodeId) {
      alert('Пожалуйста, выберите узел для неисправности');
      return;
    }

    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      const newDefectType: DefectType = await invoke('create_defect_type', {
        sessionToken,
        nodeId: selectedNodeId,
        name: newDefectTypeName,
        description: newDefectTypeDescription
      });

      // Обновляем список неисправностей для текущего узла
      if (selectedNodeId === newDefectType.node_id) {
        setDefectTypes([...defectTypes, newDefectType]);
        onSelectType(newDefectType.id);
      }
      
      setNewDefectTypeName('');
      setNewDefectTypeDescription('');
      setShowNewDefectTypeForm(false);

      alert('Новая неисправность успешно создана!');
    } catch (error) {
      console.error('Error creating defect type:', error);
      alert('Ошибка при создании типа неисправности: ' + error);
    }
  };

  return (
    <div className="defect-selector">
      <div className="form-group">
        <label>УЗЕЛ:</label>
        <div className="select-with-create">
          <select
            value={selectedNodeId}
            onChange={(e) => {
              const nodeId = Number(e.target.value);
              onSelectNode(nodeId);
              onSelectType(0); // Сбросить тип при смене узла
            }}
            disabled={loading}
          >
            <option value={0}>Выберите узел</option>
            {defectNodes.map(node => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
          {showCreateOptions && canCreate && (
            <button
              type="button"
              className="create-btn"
              onClick={() => {
                setShowNewNodeForm(true);
                setShowNewDefectTypeForm(false);
              }}
            >
              ➕ НОВЫЙ
            </button>
          )}
        </div>

        {showNewNodeForm && (
          <div className="create-form">
            <input
              type="text"
              placeholder="Название узла"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
            />
            <textarea
              placeholder="Описание узла"
              value={newNodeDescription}
              onChange={(e) => setNewNodeDescription(e.target.value)}
            ></textarea>
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={handleCreateNode}>
                🛠️ СОЗДАТЬ
              </button>
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => setShowNewNodeForm(false)}
              >
                ❌ ОТМЕНА
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>ТИП НЕИСПРАВНОСТИ:</label>
        <div className="select-with-create">
          <select
            value={selectedTypeId}
            onChange={(e) => onSelectType(Number(e.target.value))}
            disabled={loading || selectedNodeId === 0}
          >
            <option value={0}>Выберите тип неисправности</option>
            {defectTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {showCreateOptions && canCreate && (
            <button
              type="button"
              className="create-btn"
              disabled={selectedNodeId === 0}
              onClick={() => {
                setShowNewDefectTypeForm(true);
                setShowNewNodeForm(false);
              }}
            >
              ➕ НОВАЯ
            </button>
          )}
        </div>

        {showNewDefectTypeForm && (
          <div className="create-form">
            <input
              type="text"
              placeholder="Название неисправности"
              value={newDefectTypeName}
              onChange={(e) => setNewDefectTypeName(e.target.value)}
            />
            <textarea
              placeholder="Описание неисправности"
              value={newDefectTypeDescription}
              onChange={(e) => setNewDefectTypeDescription(e.target.value)}
            ></textarea>
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={handleCreateDefectType}>
                🛠️ СОЗДАТЬ
              </button>
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => setShowNewDefectTypeForm(false)}
              >
                ❌ ОТМЕНА
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DefectNodeDefectTypeSelector;