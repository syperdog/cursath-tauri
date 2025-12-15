import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './AddFaultModal.css';
import { DefectNode, DefectType } from '../types/defect';

type Props = {
  onClose: () => void;
  onAddFault: (fault: { node_id: number; type_id: number; comment: string }) => void;
};

const AddFaultModal: React.FC<Props> = ({ onClose, onAddFault }) => {
  // Состояния для узла, типа неисправности и комментария
  const [defectNodes, setDefectNodes] = useState<DefectNode[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number>(0);
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Загрузка узлов неисправностей при монтировании
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const nodes = await invoke<DefectNode[]>('get_defect_nodes');
        setDefectNodes(nodes);
      } catch (error) {
        console.error('Error loading defect nodes:', error);
        alert('Ошибка загрузки узлов неисправностей: ' + error);
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
          alert('Ошибка загрузки типов неисправностей: ' + error);
        } finally {
          setLoading(false);
        }
      } else {
        setDefectTypes([]);
      }
    };

    loadTypes();
  }, [selectedNodeId]);

  // Обработчик добавления неисправности
  const handleAdd = () => {
    if (selectedNodeId > 0 && selectedTypeId > 0 && comment) {
      onAddFault({
        node_id: selectedNodeId,
        type_id: selectedTypeId,
        comment: comment
      });
      onClose();
    } else {
      alert('Пожалуйста, выберите узел, тип неисправности и укажите комментарий');
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
          {loading && <div className="loading">Загрузка данных...</div>}

          <div className="form-group">
            <label>УЗЕЛ:</label>
            <select
              value={selectedNodeId}
              onChange={(e) => {
                setSelectedNodeId(Number(e.target.value));
                setSelectedTypeId(0); // Сбросить тип при смене узла
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
          </div>

          <div className="form-group">
            <label>ТИП НЕИСПРАВНОСТИ:</label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(Number(e.target.value))}
              disabled={loading || selectedNodeId === 0}
            >
              <option value={0}>Выберите тип неисправности</option>
              {defectTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
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
              disabled={loading}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="add-button" onClick={handleAdd} disabled={loading}>
            💾 ДОБАВИТЬ В СПИСОК
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFaultModal;