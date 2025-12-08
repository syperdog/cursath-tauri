import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../types/user';
import OrderDetailsModal from './OrderDetailsModal';
import './MasterDashboard.css';
import SearchModal from './SearchModal';
import NewClientModal from './NewClientModal';
import NewCarModal from './NewCarModal';
import AssignWorkersModal from './AssignWorkersModal';
import NewOrderModal from './NewOrderModal';

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
  mileage: number; // Changed from current_mileage to mileage
  last_visit_date: string | null;
  created_at: string;
}

// New interface for client registration
interface NewClient {
  full_name: string;
  phone: string;
  address: string | null;
}

const MasterDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Record<number, Client>>({});
  const [cars, setCars] = useState<Record<number, Car>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedClientForNewOrder, setSelectedClientForNewOrder] = useState<Client | null>(null);
  const [selectedCarForNewOrder, setSelectedCarForNewOrder] = useState<Car | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddCar, setShowAddCar] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<{ periodStart: string, periodEnd: string, status: string, search: string }>({
    periodStart: '2024-01-01',
    periodEnd: new Date().toISOString().split('T')[0],
    status: 'All',
    search: ''
  });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewCarModal, setShowNewCarModal] = useState(false);
  const [showAssignWorkersModal, setShowAssignWorkersModal] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Get session token from localStorage
      const sessionToken = localStorage.getItem('sessionToken');

      if (sessionToken) {
        const userData = await invoke<User | null>('get_user_session', { sessionToken });

        if (userData && (userData.role === 'Master' || userData.role === 'Admin')) {
          setUser(userData);
          await loadOrders();
        } else {
          // Перенаправить на форму входа, если сессия неактивна или роль не Master/Admin
          window.location.hash = '#login';
        }
      } else {
        // If no session token, redirect to login
        window.location.hash = '#login';
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Перенаправить на форму входа в случае ошибки
      window.location.hash = '#login';
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Загрузим все заказы для мастера
      const ordersData = await invoke<Order[]>('get_orders_for_master');
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

  // Фильтрация заказов по дате
  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    return orderDate === selectedDate;
  });

  // Сатусы заказов с эмодзи
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

  // Функция для получения дней месяца
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startingDay = firstDay === 0 ? 6 : firstDay - 1; // Adjust to Monday start

    const days = [];

    // Previous month's days
    for (let i = startingDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Next month's days to complete full weeks
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  // Функция для форматирования месяца
  const formatMonthYear = (date: Date) => {
    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Обработчик навигации по календарю
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Обработчик клика по дню в календаре
  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  };

  // Функция для проверки, принадлежит ли день текущему месяцу
  const isCurrentMonth = (date: Date, referenceMonth: Date) => {
    return date.getMonth() === referenceMonth.getMonth() &&
           date.getFullYear() === referenceMonth.getFullYear();
  };

  // Функция для проверки, есть ли заказы в этот день
  const hasOrdersOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return orders.some(order =>
      new Date(order.created_at).toISOString().split('T')[0] === dateStr
    );
  };

  // Обработчик поиска - теперь открывает модальное окно поиска
  const handleSearch = () => {
    setShowSearchModal(true);
  };

  // Обработчик выбора результата поиска
  const handleSearchResultSelect = (item: Client | Car | Order) => {
    if ('phone' in item) { // Это клиент
      handleCreateNewOrder(item as Client, null);
    } else if ('license_plate' in item) { // Это автомобиль
      // Найдем клиента для этого автомобиля
      const client = clients[(item as Car).client_id] || null;
      handleCreateNewOrder(client, item as Car);
    } else { // Это заказ
      // Найдем клиента и автомобиль для этого заказа
      const order = item as Order;
      const client = clients[order.client_id] || null;
      const car = cars[order.car_id] || null;
      setSelectedOrder(order);
      setIsModalOpen(true);
    }
  };

  // Обработчик клика по строке заказа
  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  // Обработчик открытия модального окна для создания нового заказа
  const handleCreateNewOrder = (client: Client | null, car: Car | null) => {
    setSelectedClientForNewOrder(client);
    setSelectedCarForNewOrder(car);
    setIsNewOrderModalOpen(true);
  };

  // Обработчик закрытия модального окна создания заказа
  const handleNewOrderModalClose = () => {
    setIsNewOrderModalOpen(false);
    setSelectedClientForNewOrder(null);
    setSelectedCarForNewOrder(null);
  };

  // Обработчик успешного создания заказа
  const handleOrderCreated = () => {
    // Reload orders to show the new one
    loadOrders();
  };


  // Функции для работы с архивом
  const toggleArchiveView = () => {
    setShowArchive(!showArchive);
  };

  // Фильтрация архивных заказов (в реальном приложении это было бы на бэкенде)
  const getFilteredArchiveOrders = () => {
    return orders.filter(order => {
      if (archiveFilter.status !== 'All' && order.status !== archiveFilter.status) {
        return false;
      }

      const orderDate = new Date(order.created_at);
      const start = new Date(archiveFilter.periodStart);
      const end = new Date(archiveFilter.periodEnd);
      if (orderDate < start || orderDate > end) {
        return false;
      }

      if (archiveFilter.search &&
          !clients[order.client_id]?.full_name.toLowerCase().includes(archiveFilter.search.toLowerCase()) &&
          !cars[order.car_id]?.make.toLowerCase().includes(archiveFilter.search.toLowerCase()) &&
          !cars[order.car_id]?.model.toLowerCase().includes(archiveFilter.search.toLowerCase())) {
        return false;
      }

      return true;
    });
  };

  return (
    <div className="master-dashboard">
      <header className="dashboard-header">
        <h1>🛠️ {user?.full_name} - Мастер-Приёмщик</h1>
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

      <div className="search-bar">
        <input
          type="text"
          placeholder="Поиск заказа, клиента или авто..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClick={() => handleCreateNewOrder(null, null)} // For new order without search
        />
        <button className="search-btn" onClick={handleSearch}>🔍</button>
      </div>

      <div className="dashboard-content">
        <div className="calendar-section">
          <div className="calendar-header">
            <button onClick={() => navigateMonth('prev')}>◀</button>
            <h2>{formatMonthYear(currentMonth)}</h2>
            <button onClick={() => navigateMonth('next')}>▶</button>
            <button className="archive-btn" onClick={toggleArchiveView}>🗄️ АРХИВ</button>
            <button
              className="new-order-btn"
              onClick={() => handleCreateNewOrder(null, null)}
            >
              ➕ НОВЫЙ ЗАКАЗ
            </button>
          </div>

          <div className="calendar-grid">
            <div className="weekdays">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="days-grid">
              {getDaysInMonth(currentMonth).map((date, index) => {
                const isCurrent = isCurrentMonth(date, currentMonth);
                const dateStr = date.toISOString().split('T')[0];
                const isSelected = dateStr === selectedDate;
                const hasOrders = hasOrdersOnDate(date);

                return (
                  <div
                    key={index}
                    className={`day ${
                      isCurrent ? 'current-month' : 'other-month'
                    } ${isSelected ? 'selected' : ''} ${hasOrders ? 'has-orders' : ''}`}
                    onClick={() => isCurrent && handleDayClick(date)}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!showArchive ? (
          <div className="orders-section">
            <h3>📋 ЗАКАЗЫ НА {selectedDate}:</h3>
            {loading ? (
              <p>Загрузка заказов...</p>
            ) : filteredOrders.length > 0 ? (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Клиент</th>
                    <th>Автомобиль</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => {
                    const client = clients[order.client_id];
                    const car = cars[order.car_id];

                    return (
                      <tr key={order.id} onClick={() => handleOrderClick(order)}>
                        <td>{order.id}</td>
                        <td>
                          {client ? `${client.full_name}` : `Клиент #${order.client_id}`}
                          <br />
                          <small>{client?.phone || ''}</small>
                        </td>
                        <td>
                          {car ? `${car.make} ${car.model}` : `Авто #${order.car_id}`}
                          <br />
                          <small>{car?.license_plate || ''}</small>
                        </td>
                        <td>
                          <span className="status-badge">
                            {getStatusEmoji(order.status)} {order.status}
                          </span>
                        </td>
                        <td>{order.total_amount || '----'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>Нет заказов на выбранную дату</p>
            )}
          </div>
        ) : (
          <div className="archive-section">
            <h3>🗄️ АРХИВ ЗАКАЗОВ</h3>

            <div className="archive-filters">
              <div className="date-filters">
                <label>Период:</label>
                <input
                  type="date"
                  value={archiveFilter.periodStart}
                  onChange={(e) => setArchiveFilter({...archiveFilter, periodStart: e.target.value})}
                />
                <span> - </span>
                <input
                  type="date"
                  value={archiveFilter.periodEnd}
                  onChange={(e) => setArchiveFilter({...archiveFilter, periodEnd: e.target.value})}
                />
              </div>

              <div className="status-filter">
                <label>Статус:</label>
                <select
                  value={archiveFilter.status}
                  onChange={(e) => setArchiveFilter({...archiveFilter, status: e.target.value})}>
                  <option value="All">Все</option>
                  <option value="Closed">Закрыт</option>
                  <option value="Cancelled">Отменен</option>
                </select>
              </div>

              <div className="archive-search">
                <input
                  type="text"
                  placeholder="Поиск: клиент, авто..."
                  value={archiveFilter.search}
                  onChange={(e) => setArchiveFilter({...archiveFilter, search: e.target.value})}
                  onClick={() => setShowSearchModal(true)}
                />
                <button className="search-btn" onClick={() => setShowSearchModal(true)}>🔍</button>
              </div>
            </div>

            <table className="archive-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Дата закр.</th>
                  <th>Клиент</th>
                  <th>Автомобиль</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredArchiveOrders().map(order => {
                  const client = clients[order.client_id];
                  const car = cars[order.car_id];

                  return (
                    <tr key={order.id} onClick={() => handleOrderClick(order)}>
                      <td>{order.id}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>{client ? client.full_name : `Клиент #${order.client_id}`}</td>
                      <td>{car ? `${car.make} ${car.model}` : `Авто #${order.car_id}`}</td>
                      <td>
                        <span className="status-badge">
                          {getStatusEmoji(order.status)} {order.status}
                        </span>
                      </td>
                      <td>{order.total_amount || '----'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal actions moved to separate components */}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          client={clients[selectedOrder.client_id] || null}
          car={cars[selectedOrder.car_id] || null}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {showSearchModal && (
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onResultSelect={handleSearchResultSelect}
        />
      )}

      {showNewClientModal && (
        <NewClientModal
          isOpen={showNewClientModal}
          onClose={() => setShowNewClientModal(false)}
          onClientCreated={(client) => {
            // In a real application we would save the client to the backend
            console.log('New client created:', client);
            setShowNewClientModal(false);
          }}
        />
      )}

      {showNewCarModal && (
        <NewCarModal
          isOpen={showNewCarModal}
          onClose={() => setShowNewCarModal(false)}
          onCarCreated={(car) => {
            // In a real application we would save the car to the backend
            console.log('New car created:', car);
            setShowNewCarModal(false);
          }}
        />
      )}

      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        client={selectedClientForNewOrder}
        car={selectedCarForNewOrder}
        onClose={handleNewOrderModalClose}
        onOrderCreated={handleOrderCreated}
      />

      {showAssignWorkersModal && selectedOrder && (
        <AssignWorkersModal
          isOpen={showAssignWorkersModal}
          order={selectedOrder}
          works={[]} // In real app, we would fetch works for this order
          workers={[]} // In real app, we would fetch available workers
          onClose={() => setShowAssignWorkersModal(false)}
          onAssignmentSaved={() => {
            setShowAssignWorkersModal(false);
            // Update the order status after assigning workers
          }}
        />
      )}
    </div>
  );
};

export default MasterDashboard;