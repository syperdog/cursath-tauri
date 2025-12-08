import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../types/user';
import './StorekeeperDashboard.css';
import PartsSelectionModal from './PartsSelectionModal';
import IssuePartsModal from './IssuePartsModal';
import WarehouseStockModal from './WarehouseStockModal';

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  status: string;
  complaint: string | null;
  current_mileage: number | null;
  prepayment: string | null; // Decimal as string
  total_amount: string | null; // Decimal as string
  created_at: string;
  completed_at: string | null;
}

interface Client {
  id: number;
  full_name: string;
  phone: string;
  address: string | null;
  created_at: string;
}

interface Car {
  id: number;
  client_id: number;
  vin: string | null;
  license_plate: string | null;
  make: string;
  model: string;
  production_year: number | null;
  mileage: number;
  last_visit_date: string | null;
  created_at: string;
}

interface DiagnosticResult {
  id: number;
  order_id: number;
  diagnostician_id: number;
  description: string;
  created_at: string;
}

interface PartSuggestion {
  id: number;
  name: string;
  brand: string;
  supplier: string;
  price: number;
  availability: string;
  part_number: string;
}

const StorekeeperDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Record<number, Client>>({});
  const [cars, setCars] = useState<Record<number, Car>>({});
  const [activeTab, setActiveTab] = useState<'selection' | 'issuance'>('selection');
  const [loading, setLoading] = useState(true);
  const [diagnosticResults, setDiagnosticResults] = useState<Record<number, DiagnosticResult[]>>({});

  // Modal states
  const [showPartsSelectionModal, setShowPartsSelectionModal] = useState(false);
  const [showIssuePartsModal, setShowIssuePartsModal] = useState(false);
  const [showWarehouseStockModal, setShowWarehouseStockModal] = useState(false);
  const [selectedOrderForParts, setSelectedOrderForParts] = useState<Order | null>(null);
  const [selectedOrderForIssuance, setSelectedOrderForIssuance] = useState<Order | null>(null);

  useEffect(() => {
    checkSession();
    loadOrders();
  }, []);

  const checkSession = async () => {
    try {
      // Get session token from localStorage
      const sessionToken = localStorage.getItem('sessionToken');

      if (sessionToken) {
        const userData = await invoke<User | null>('get_user_session', { sessionToken });

        if (userData && (userData.role === 'Storekeeper' || userData.role === 'Admin')) {
          setUser(userData);
        } else {
          // Redirect to login if session is inactive or role is not Storekeeper/Admin
          window.location.hash = '#login';
        }
      } else {
        // If no session token, redirect to login
        window.location.hash = '#login';
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Redirect to login in case of error
      window.location.hash = '#login';
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);

      // Загрузим все заказы для кладовщика (всё, что не закрыто и не отменено)
      const ordersData = await invoke<Order[]>('get_orders_for_storekeeper');
      setOrders(ordersData);

      // Загрузим информацию о клиентах и автомобилях для каждого заказа
      const uniqueClientIds = [...new Set(ordersData.map(order => order.client_id))];
      const uniqueCarIds = [...new Set(ordersData.map(order => order.car_id))];

      // Загрузим данные о клиентах
      for (const clientId of uniqueClientIds) {
        if (!clients[clientId]) {
          try {
            const clientData = await invoke<Client | null>('get_client_by_id', { clientId });
            if (clientData) {
              setClients(prev => ({ ...prev, [clientId]: clientData }));
            }
          } catch (error) {
            console.error(`Error loading client ${clientId}:`, error);
          }
        }
      }

      // Загрузим данные об автомобилях
      for (const carId of uniqueCarIds) {
        if (!cars[carId]) {
          try {
            const carData = await invoke<Car | null>('get_car_by_id', { carId });
            if (carData) {
              setCars(prev => ({ ...prev, [carId]: carData }));
            }
          } catch (error) {
            console.error(`Error loading car ${carId}:`, error);
          }
        }
      }

      // Загрузим результаты диагностики
      for (const order of ordersData) {
        try {
          const results = await invoke<DiagnosticResult[]>('get_diagnostic_results_by_order_id', { orderId: order.id });
          setDiagnosticResults(prev => ({ ...prev, [order.id]: results }));
        } catch (error) {
          console.error(`Error loading diagnostic results for order ${order.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (sessionToken) {
        await invoke('logout_user', { sessionToken });
      }
      // Clear local storage
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      window.location.hash = '#login';
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Фильтрация заказов в зависимости от вкладки
  const getFilteredOrders = () => {
    if (activeTab === 'selection') {
      // Заказы, требующие подбора запчастей (после диагностики)
      return orders.filter(order =>
        order.status === 'Diagnostics' ||
        order.status === 'Parts_Selection' ||
        order.status === 'Approval'
      );
    } else {
      // Заказы, готовые к выдаче в цех (после согласования)
      return orders.filter(order =>
        order.status === 'In_Work'
      );
    }
  };

  const filteredOrders = getFilteredOrders();

  // Статусы заказов с эмодзи
  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'New': return '🆕';
      case 'Diagnostics': return '🔍';
      case 'Parts_Selection': return '📦';
      case 'Approval': return '📋';
      case 'In_Work': return '🔧';
      case 'Quality_Control': return '✅';
      case 'Ready': return '🏁';
      case 'Closed': return '🔒';
      case 'Cancelled': return '❌';
      default: return '❓';
    }
  };

  const handlePartsSelection = (order: Order) => {
    setSelectedOrderForParts(order);
    setShowPartsSelectionModal(true);
  };

  const handlePartsSelectionSave = (selectedParts: PartSuggestion[]) => {
    console.log('Selected parts for order:', selectedOrderForParts?.id, selectedParts);
    // В реальном приложении сохраняем выбранные запчасти в базу
    setShowPartsSelectionModal(false);
    setSelectedOrderForParts(null);
  };

  const handleIssueParts = (order: Order) => {
    setSelectedOrderForIssuance(order);
    setShowIssuePartsModal(true);
  };

  const handleIssueConfirmed = () => {
    console.log('Parts issued for order:', selectedOrderForIssuance?.id);
    // В реальном приложении обновляем статус заказа
    setShowIssuePartsModal(false);
    setSelectedOrderForIssuance(null);
    loadOrders(); // Обновляем список заказов
  };

  return (
    <div className="storekeeper-dashboard">
      <header className="dashboard-header">
        <h1>📦 {user?.full_name} - Кладовщик</h1>
        <div className="header-buttons">
          {user?.role === 'Admin' && (
            <button
              className="admin-return-btn"
              onClick={() => window.location.hash = '#admin'}
              title="Вернуться в меню администратора"
            >
              🏠 Админ-панель
            </button>
          )}
          <button className="logout-btn" onClick={handleLogout}>✖ ВЫХОД</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'selection' ? 'active' : ''}`}
            onClick={() => setActiveTab('selection')}
          >
            🔍 ПОДБОР ({filteredOrders.filter(o =>
              o.status === 'Diagnostics' ||
              o.status === 'Parts_Selection' ||
              o.status === 'Approval'
            ).length})
          </button>
          <button
            className={`tab ${activeTab === 'issuance' ? 'active' : ''}`}
            onClick={() => setActiveTab('issuance')}
          >
            📤 ВЫДАЧА В ЦЕХ ({filteredOrders.filter(o => o.status === 'In_Work').length})
          </button>
        </div>

        <div className="dashboard-actions">
          <button
            className="secondary-btn"
            onClick={() => setShowWarehouseStockModal(true)}
          >
            🔍 СКЛАД (Остатки)
          </button>
        </div>

        {activeTab === 'selection' && (
          <div className="orders-section">
            <h3>ЗАКАЗЫ НА ПОДБОР ЗАПЧАСТЕЙ (Статус: Подбор запчастей):</h3>
            {loading ? (
              <p>Загрузка заказов...</p>
            ) : filteredOrders.filter(o =>
              o.status === 'Diagnostics' ||
              o.status === 'Parts_Selection' ||
              o.status === 'Approval'
            ).length > 0 ? (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Автомобиль</th>
                    <th>Диагност</th>
                    <th>Необходимые запчасти</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders
                    .filter(o =>
                      o.status === 'Diagnostics' ||
                      o.status === 'Parts_Selection' ||
                      o.status === 'Approval'
                    )
                    .map(order => {
                      const client = clients[order.client_id];
                      const car = cars[order.car_id];
                      const diagnostics = diagnosticResults[order.id] || [];

                      return (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>
                            {car ? `${car.make} ${car.model}` : `Авто #${order.car_id}`}
                            <br />
                            <small>{car?.license_plate || ''}</small>
                          </td>
                          <td>
                            {/* Здесь будет информация о диагносте */}
                            {diagnostics.length > 0 ? 'Диагност' : 'Нет данных'}
                          </td>
                          <td>
                            {diagnostics.map(d => d.description).join(', ') || 'Нет данных'}
                          </td>
                          <td>
                            <button
                              className="primary-btn"
                              onClick={() => handlePartsSelection(order)}
                            >
                              📦 ПОДОБРАТЬ ЗАПЧАСТИ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <p>Нет заказов на подбор запчастей</p>
            )}
          </div>
        )}

        {activeTab === 'issuance' && (
          <div className="orders-section">
            <h3>ЗАКАЗЫ ОЖИДАЮЩИЕ ВЫДАЧИ ЗАПЧАСТЕЙ (Статус: В работе):</h3>
            {loading ? (
              <p>Загрузка заказов...</p>
            ) : filteredOrders.filter(o => o.status === 'In_Work').length > 0 ? (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Автомобиль</th>
                    <th>Механик</th>
                    <th>К выдаче</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders
                    .filter(o => o.status === 'In_Work')
                    .map(order => {
                      const client = clients[order.client_id];
                      const car = cars[order.car_id];

                      return (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>
                            {car ? `${car.make} ${car.model}` : `Авто #${order.car_id}`}
                            <br />
                            <small>{car?.license_plate || ''}</small>
                          </td>
                          <td>
                            {/* Здесь будет имя механика */}
                            Назначенный механик
                          </td>
                          <td>
                            Запчасти для заказа
                          </td>
                          <td>
                            <button
                              className="primary-btn"
                              onClick={() => handleIssueParts(order)}
                            >
                              📤 ВЫДАТЬ ЗАПЧАСТИ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <p>Нет заказов на выдачу запчастей</p>
            )}
          </div>
        )}
      </div>

      {showPartsSelectionModal && selectedOrderForParts && (
        <PartsSelectionModal
          isOpen={showPartsSelectionModal}
          order={selectedOrderForParts}
          car={cars[selectedOrderForParts.car_id] || null}
          diagnostics={diagnosticResults[selectedOrderForParts.id] || []}
          onClose={() => {
            setShowPartsSelectionModal(false);
            setSelectedOrderForParts(null);
          }}
          onSave={handlePartsSelectionSave}
        />
      )}

      {showIssuePartsModal && selectedOrderForIssuance && (
        <IssuePartsModal
          isOpen={showIssuePartsModal}
          order={selectedOrderForIssuance}
          onClose={() => {
            setShowIssuePartsModal(false);
            setSelectedOrderForIssuance(null);
          }}
          onIssueConfirmed={handleIssueConfirmed}
        />
      )}

      {showWarehouseStockModal && (
        <WarehouseStockModal
          isOpen={showWarehouseStockModal}
          onClose={() => setShowWarehouseStockModal(false)}
        />
      )}
    </div>
  );
};

export default StorekeeperDashboard;