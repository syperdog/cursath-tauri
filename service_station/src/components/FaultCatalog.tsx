import React from 'react';
import './FaultCatalog.css';

// Типы данных для неисправности
type Fault = {
  id: string;
  category: string;
  name: string;
  description: string;
};

type Props = {
  faults: Fault[];
};

const FaultCatalog: React.FC<Props> = ({ faults }) => {
  return (
    <div className="fault-catalog">
      <h2>🔧 СПРАВОЧНИК НЕИСПРАВНОСТЕЙ</h2>
      <div className="catalog-content">
        <table className="fault-table">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Неисправность</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            {faults.map(fault => (
              <tr key={fault.id}>
                <td>{fault.category}</td>
                <td>{fault.name}</td>
                <td>{fault.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FaultCatalog;