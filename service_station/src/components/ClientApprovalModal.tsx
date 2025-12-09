import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ClientApprovalModal.css';

interface WorkItem {
  id: number;
  name: string;
  description: string;
  price: number;
  checked: boolean;
  subItems: WorkItem[];
}

interface ClientApprovalModalProps {
  isOpen: boolean;
  order: any; // Order type
  client: any; // Client type
  onClose: () => void;
  onConfirm: (selectedItems: WorkItem[]) => void;
}

const ClientApprovalModal: React.FC<ClientApprovalModalProps> = ({
  isOpen,
  order,
  client,
  onClose,
  onConfirm
}) => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [rejectedTotal, setRejectedTotal] = useState<number>(0);

  useEffect(() => {
    if (isOpen && order) {
      // В реальной реализации данные загружаются из API
      // Заглушка для демонстрации структуры
      const mockWorkItems: WorkItem[] = [
        {
          id: 1,
          name: 'Стук в передней подвеске',
          description: 'Обнаружен стук в передней подвеске',
          price: 9000,
          checked: true,
          subItems: [
            { id: 11, name: 'Диагностика ходовой', description: '', price: 1000, checked: true, subItems: [] },
            { id: 12, name: 'Замена стоек стабилизатора', description: '', price: 3000, checked: true, subItems: [] },
            { id: 13, name: 'Стойка стабилизатора (Toyota) x2', description: '', price: 5000, checked: true, subItems: [] }
          ]
        },
        {
          id: 2,
          name: 'Дополнительные рекомендации',
          description: 'Рекомендуем также выполнить',
          price: 15000,
          checked: false,
          subItems: [
            { id: 21, name: 'Замена тормозных дисков', description: '', price: 4000, checked: false, subItems: [] },
            { id: 22, name: 'Тормозные диски (Brembo) x2', description: '', price: 11000, checked: false, subItems: [] }
          ]
        }
      ];
      
      setWorkItems(mockWorkItems);
      
      // Рассчитываем начальные суммы
      const checkedPrice = calculateCheckedPrice(mockWorkItems);
      const uncheckedPrice = calculateUncheckedPrice(mockWorkItems);
      setTotalPrice(checkedPrice);
      setRejectedTotal(uncheckedPrice);
    }
  }, [isOpen, order]);

  const calculateCheckedPrice = (items: WorkItem[]): number => {
    let total = 0;
    items.forEach(item => {
      if (item.checked) {
        if (item.subItems.length > 0) {
          total += calculateCheckedPrice(item.subItems);
        } else {
          total += item.price;
        }
      }
    });
    return total;
  };

  const calculateUncheckedPrice = (items: WorkItem[]): number => {
    let total = 0;
    items.forEach(item => {
      if (!item.checked) {
        if (item.subItems.length > 0) {
          total += calculateUncheckedPrice(item.subItems);
        } else {
          total += item.price;
        }
      }
    });
    return total;
  };

  const handleCheckboxChange = (id: number, checked: boolean) => {
    setWorkItems(prevItems => {
      const updateChecked = (items: WorkItem[]): WorkItem[] => {
        return items.map(item => {
          if (item.id === id) {
            // Если это родительский элемент, обновляем все дочерние
            if (item.subItems.length > 0) {
              return {
                ...item,
                checked,
                subItems: updateChecked(item.subItems)
              };
            } else {
              return { ...item, checked };
            }
          } else if (item.subItems.length > 0) {
            // Рекурсивно обновляем дочерние элементы
            return {
              ...item,
              subItems: updateChecked(item.subItems),
              checked: item.subItems.every(subItem => 
                findSubItem(subItem, id) ? checked : subItem.checked
              )
            };
          }
          return item;
        });
      };

      const updatedItems = updateChecked(prevItems);
      
      // Рассчитываем новые суммы
      const checkedPrice = calculateCheckedPrice(updatedItems);
      const uncheckedPrice = calculateUncheckedPrice(updatedItems);
      setTotalPrice(checkedPrice);
      setRejectedTotal(uncheckedPrice);
      
      return updatedItems;
    });
  };

  const findSubItem = (item: WorkItem, id: number): boolean => {
    if (item.id === id) return true;
    for (const subItem of item.subItems) {
      if (findSubItem(subItem, id)) return true;
    }
    return false;
  };

  const handleConfirm = () => {
    const selectedItems = workItems.filter(item => item.checked);
    onConfirm(selectedItems);
  };

  const handleRejectAll = () => {
    // Отклоняем все элементы, кроме диагностики
    setWorkItems(prevItems => {
      const updatedItems = prevItems.map(item => ({
        ...item,
        checked: item.name.toLowerCase().includes('диагностика') ? item.checked : false,
        subItems: item.subItems.map(subItem => ({
          ...subItem,
          checked: subItem.name.toLowerCase().includes('диагностика') ? subItem.checked : false
        }))
      }));

      // Рассчитываем новые суммы
      const checkedPrice = calculateCheckedPrice(updatedItems);
      const uncheckedPrice = calculateUncheckedPrice(updatedItems);
      setTotalPrice(checkedPrice);
      setRejectedTotal(uncheckedPrice);

      return updatedItems;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Заказ-наряд #{order?.id || 'N/A'}</h2>
          <button className="close-btn" onClick={onClose}>✖ ОТМЕНА</button>
        </div>

        <div className="modal-body">
          <div className="client-info">
            <p><strong>👤 КЛИЕНТ:</strong> {client?.full_name || 'N/A'}</p>
            <p><strong>⚠️ СТАТУС:</strong> ⏳ СОГЛАСОВАНИЕ</p>
          </div>

          <div className="approval-content">
            <h3>📋 СОГЛАСОВАНИЕ РАБОТ И ЗАПЧАСТЕЙ:</h3>
            <div className="work-items-list">
              {workItems.map(item => (
                <WorkItemComponent
                  key={item.id}
                  item={item}
                  onCheckboxChange={handleCheckboxChange}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="total-info">
            <p><strong>ИТОГО К ОПЛАТЕ:</strong> {totalPrice} $ (Без учета отклоненных: {rejectedTotal} $.)</p>
          </div>
          <div className="modal-actions">
            <button className="confirm-btn" onClick={handleConfirm}>✅ ПОДТВЕРДИТЬ ВЫБРАННОЕ</button>
            <button className="reject-btn" onClick={handleRejectAll}>❌ ОТКЛОНИТЬ ВСЁ</button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WorkItemComponentProps {
  item: WorkItem;
  onCheckboxChange: (id: number, checked: boolean) => void;
}

const WorkItemComponent: React.FC<WorkItemComponentProps> = ({ item, onCheckboxChange }) => {
  const [expanded, setExpanded] = useState(true);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckboxChange(item.id, e.target.checked);
  };

  const hasSubItems = item.subItems.length > 0;

  return (
    <div className="work-item">
      <div className="work-item-header">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={item.checked}
            onChange={handleCheckboxChange}
          />
          <span className="checkmark">
            {item.checked ? 'x' : ''}
          </span>
        </label>
        <span className="work-item-title" onClick={() => hasSubItems && setExpanded(!expanded)}>
          {hasSubItems ? (expanded ? '[-]' : '[+]') : ''} {item.name} (Всего: {item.price} $)
        </span>
      </div>
      
      {hasSubItems && expanded && (
        <div className="work-item-subitems">
          {item.subItems.map(subItem => (
            <WorkItemComponent
              key={subItem.id}
              item={subItem}
              onCheckboxChange={onCheckboxChange}
            />
          ))}
        </div>
      )}
      
      {item.description && (
        <div className="work-item-description">
          {item.description}
        </div>
      )}
    </div>
  );
};

export default ClientApprovalModal;