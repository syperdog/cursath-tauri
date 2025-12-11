import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../types/user';
import OrderDetailsModal from './OrderDetailsModal';
import ClientApprovalModal from './ClientApprovalModal';
import FinalProcessingModal from './FinalProcessingModal';
import './MasterDashboard.css';
import NewClientModal from './NewClientModal';
import NewCarModal from './NewCarModal';
import AssignWorkersModal from './AssignWorkersModal';
import NewOrderModal from './NewOrderModal';

interface Order {
  id: number;
  client_id: number;
  car_id: number;
  master_id: number | null;
  worker_id: number | null; // Main worker assigned to the entire order
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



const MasterDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Record<number, Client>>({});
  const [cars, setCars] = useState<Record<number, Car>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Client | Car | Order)[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [clientCars, setClientCars] = useState<Car[]>([]);
  const [showClientCarsModal, setShowClientCarsModal] = useState(false);
  const [selectedClientForCars, setSelectedClientForCars] = useState<Client | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedClientForNewOrder, setSelectedClientForNewOrder] = useState<Client | null>(null);
  const [selectedCarForNewOrder, setSelectedCarForNewOrder] = useState<Car | null>(null);

  const [showArchive, setShowArchive] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<Order[]>([]);
  const [archiveFilter, setArchiveFilter] = useState<{ periodStart: string, periodEnd: string, status: string, search: string }>({
    periodStart: '2024-01-01',
    periodEnd: new Date().toISOString().split('T')[0],
    status: 'All',
    search: ''
  });
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewCarModal, setShowNewCarModal] = useState(false);
  const [showAssignWorkersModal, setShowAssignWorkersModal] = useState(false);
  const [showClientApprovalModal, setShowClientApprovalModal] = useState(false);
  const [showFinalProcessingModal, setShowFinalProcessingModal] = useState(false);
  const [selectedClientForFinalProcessing, setSelectedClientForFinalProcessing] = useState<Client | null>(null);
  const [selectedCarForFinalProcessing, setSelectedCarForFinalProcessing] = useState<Car | null>(null);
  const [orderDefects, setOrderDefects] = useState<any[]>([]);
  const [orderWorks, setOrderWorks] = useState<any[]>([]);
  const [orderParts, setOrderParts] = useState<any[]>([]);

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

  // Функция для поиска клиентов, автомобилей и заказов
  const performSearch = async (query: string) => {
    if (query.trim() === '') {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    try {
      const [orders, clients, cars] = await invoke<[Order[], Client[], Car[]]>(
        'search_orders_clients_cars',
        { query }
      );

      // Combine all results
      const results: (Client | Car | Order)[] = [...clients, ...cars, ...orders];
      setSearchResults(results);
      setShowSearchDropdown(true);
    } catch (error) {
      console.error('Error during search:', error);
      setSearchResults([]);
      setShowSearchDropdown(true);
    }
  };

  // Обработчик изменения текста в поле поиска
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Perform search with debounce
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300); // 300ms debounce
  };

  // Обработчик клика по результату поиска
  const handleSearchResultClick = async (item: Client | Car | Order) => {
    setSearchQuery(''); // Clear search query
    setShowSearchDropdown(false); // Hide dropdown
    setSearchResults([]); // Clear results

    if ('phone' in item) { // Это клиент
      // Загрузим автомобили клиента
      try {
        const carsForClient = await invoke<Car[]>('get_cars_by_client_id', { clientId: item.id });
        setClientCars(carsForClient);
        setSelectedClientForCars(item as Client);
        setShowClientCarsModal(true);
      } catch (error) {
        console.error('Error loading client cars:', error);
        // Если не удалось загрузить автомобили, открываем заказ с пустым автомобилем
        handleCreateNewOrder(item as Client, null);
      }
    } else if ('license_plate' in item) { // Это автомобиль
      // Найдем клиента для этого автомобиля
      const client = clients[(item as Car).client_id] || null;
      handleCreateNewOrder(client, item as Car);
    } else { // Это заказ
      // Найдем клиента и автомобиль для этого заказа
      const order = item as Order;
      setSelectedOrder(order);
      setIsModalOpen(true);
    }
  };

  // Обработчик клика вне поля поиска
  const handleClickOutside = (e: MouseEvent) => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
      setShowSearchDropdown(false);
    }
  };

  // Установить обработчик клика вне поля поиска
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Реф для хранения таймера
  const searchTimeoutRef = useRef<number | null>(null);
  // Реф для контейнера поиска
  const searchContainerRef = useRef<HTMLDivElement>(null);



  // Загрузка неисправностей для заказа
  const loadOrderDefects = async (orderId: number) => {
    try {
      const defects = await invoke<any[]>('get_diagnostic_results_by_order_id', { orderId });
      setOrderDefects(defects);
    } catch (error) {
      console.error(`Error loading defects for order ${orderId}:`, error);
      setOrderDefects([]);
    }
  };

  // Загрузка работ для заказа
  const loadOrderWorks = async (orderId: number) => {
    try {
      const works = await invoke<any[]>('get_order_works_by_order_id', { orderId });
      setOrderWorks(works);
    } catch (error) {
      console.error(`Error loading works for order ${orderId}:`, error);
      setOrderWorks([]);
    }
  };

  // Загрузка запчастей для заказа
  const loadOrderParts = async (orderId: number) => {
    try {
      const parts = await invoke<any[]>('get_order_parts_by_order_id', { orderId });
      setOrderParts(parts);
    } catch (error) {
      console.error(`Error loading parts for order ${orderId}:`, error);
      setOrderParts([]);
    }
  };

  // Обработчик клика по строке заказа
  const handleOrderClick = async (order: Order) => {
    setSelectedOrder(order);

    if (order.status === 'Approval') {
      // Загружаем данные для модального окна согласования или назначения работников
      try {
        const [defects, works, parts] = await Promise.all([
          invoke<any[]>('get_diagnostic_results_by_order_id', { orderId: order.id }),
          invoke<any[]>('get_order_works_by_order_id', { orderId: order.id }),
          invoke<any[]>('get_order_parts_by_order_id', { orderId: order.id })
        ]);

        setOrderDefects(defects);
        setOrderWorks(works);
        setOrderParts(parts);

        // Проверяем, есть ли уже подтвержденные работы
        const confirmedWorks = works.filter((work: any) => work.is_confirmed);
        if (confirmedWorks.length > 0) {
          // Если работы уже подтверждены, открываем назначение работников
          setShowAssignWorkersModal(true);
        } else {
          // Если работы еще не подтверждены, открываем согласование
          setShowClientApprovalModal(true);
        }
      } catch (error) {
        console.error('Error loading order data:', error);
        setIsModalOpen(true);
      }
    } else if (order.status === 'Ready') {
      // Для заказов в статусе "Ready" открываем модальное окно завершения
      const client = await invoke<Client | null>('get_client_by_id', { clientId: order.client_id });
      const car = await invoke<Car | null>('get_car_by_id', { carId: order.car_id });

      setSelectedClientForFinalProcessing(client);
      setSelectedCarForFinalProcessing(car);
      setShowFinalProcessingModal(true);
    } else {
      setIsModalOpen(true);
    }
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
  const toggleArchiveView = async () => {
    const newShowArchive = !showArchive;
    setShowArchive(newShowArchive);

    // Загружаем архивные заказы при открытии вкладки архива
    if (newShowArchive) {
      await loadArchivedOrders();
    }
  };

  // Загрузка архивных заказов
  const loadArchivedOrders = async () => {
    try {
      const archivedOrdersData = await invoke<Order[]>('get_archived_orders', {
        statusFilter: archiveFilter.status,
        periodStart: archiveFilter.periodStart,
        periodEnd: archiveFilter.periodEnd,
        searchQuery: archiveFilter.search
      });
      setArchivedOrders(archivedOrdersData);
    } catch (error) {
      console.error('Error loading archived orders:', error);
    }
  };

  // Фильтрация архивных заказов (в реальном приложении это было бы на бэкенде)
  const getFilteredArchiveOrders = () => {
    return archivedOrders.filter(order => {
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

      <div className="search-bar" ref={searchContainerRef}>
        <input
          type="text"
          placeholder="Поиск заказа, клиента или авто..."
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchQuery && setShowSearchDropdown(true)}
        />
        {showSearchDropdown && searchResults.length > 0 && (
          <div className="search-dropdown">
            <ul>
              {searchResults.map((result, index) => {
                if ('phone' in result) { // This is a client
                  return (
                    <li
                      key={`client-${result.id}-${index}`}
                      className="search-result-item"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div>
                        <strong>👤 {result.full_name}</strong> | 📞 {result.phone}
                      </div>
                      <div className="result-details">
                        {result.address ? result.address : 'Адрес не указан'}
                      </div>
                    </li>
                  );
                } else if ('license_plate' in result) { // This is a car
                  return (
                    <li
                      key={`car-${result.id}-${index}`}
                      className="search-result-item"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div>
                        <strong>🚗 {result.make} {result.model}</strong> | 🏷️ {result.license_plate || 'Нет номера'}
                      </div>
                      <div className="result-details">
                        VIN: {result.vin || 'Не указан'} | Год: {result.production_year || 'Не указан'} | Пробег: {result.mileage} км
                      </div>
                    </li>
                  );
                } else { // This is an order
                  return (
                    <li
                      key={`order-${result.id}-${index}`}
                      className="search-result-item"
                      onClick={() => handleSearchResultClick(result)}
                    >
                      <div>
                        <strong>📋 Заказ #{result.id}</strong> | Статус: {result.status}
                      </div>
                      <div className="result-details">
                        {result.complaint || 'Без описания проблемы'}
                      </div>
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        )}
        {showSearchDropdown && searchResults.length === 0 && searchQuery && (
          <div className="search-dropdown">
            <p>Ничего не найдено. Попробуйте другой запрос.</p>
          </div>
        )}
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
                  onChange={(e) => {
                    setArchiveFilter({...archiveFilter, periodStart: e.target.value});
                    // Перезагружаем архивные заказы при изменении фильтра
                    setTimeout(() => loadArchivedOrders(), 0);
                  }}
                />
                <span> - </span>
                <input
                  type="date"
                  value={archiveFilter.periodEnd}
                  onChange={(e) => {
                    setArchiveFilter({...archiveFilter, periodEnd: e.target.value});
                    // Перезагружаем архивные заказы при изменении фильтра
                    setTimeout(() => loadArchivedOrders(), 0);
                  }}
                />
              </div>

              <div className="status-filter">
                <label>Статус:</label>
                <select
                  value={archiveFilter.status}
                  onChange={(e) => {
                    setArchiveFilter({...archiveFilter, status: e.target.value});
                    // Перезагружаем архивные заказы при изменении фильтра
                    setTimeout(() => loadArchivedOrders(), 0);
                  }}>
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
                  onChange={(e) => {
                    setArchiveFilter({...archiveFilter, search: e.target.value});
                    // Перезагружаем архивные заказы при изменении фильтра
                    setTimeout(() => loadArchivedOrders(), 0);
                  }}
                />
                <button className="search-btn">🔍</button>
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
          isOpen={isModalOpen && selectedOrder.status !== 'Approval'}
          onClose={() => setIsModalOpen(false)}
        />
      )}


      {selectedOrder && showClientApprovalModal && (
        <ClientApprovalModal
          isOpen={showClientApprovalModal}
          order={selectedOrder}
          clientName={clients[selectedOrder.client_id]?.full_name || 'Клиент'}
          works={orderWorks}
          parts={orderParts}
          onClose={() => setShowClientApprovalModal(false)}
          onApprovalComplete={async (confirmedWorks, confirmedParts) => {
            console.log('MasterDashboard: Received confirmed works:', confirmedWorks);
            console.log('MasterDashboard: Received confirmed parts:', confirmedParts);
            
            // Закрываем окно согласования
            setShowClientApprovalModal(false);
            
            // Небольшая задержка для корректного закрытия модального окна
            setTimeout(async () => {
              // Открываем модальное окно назначения работников, если есть подтвержденные работы или запчасти
              // Это позволяет мастеру назначить исполнителей на работы и/или запчасти
              if (confirmedWorks.length > 0 || confirmedParts.length > 0) {
                console.log('MasterDashboard: Opening worker assignment modal (works:', confirmedWorks.length, ', parts:', confirmedParts.length, ')');
                try {
                  // Перезагружаем данные о работах из базы данных
                  const updatedWorks = await invoke<any[]>('get_order_works_by_order_id', { orderId: selectedOrder!.id });
                  console.log('MasterDashboard: Updated works from DB:', updatedWorks);

                  // Фильтруем только подтвержденные работы
                  const confirmedWorksFromDB = updatedWorks.filter((work: any) => work.is_confirmed);
                  console.log('MasterDashboard: Confirmed works from DB:', confirmedWorksFromDB);

                  // Отображаем только подтвержденные работы для назначения
                  setOrderWorks(confirmedWorksFromDB);
                  setShowAssignWorkersModal(true);
                } catch (error) {
                  console.error('Error reloading works:', error);
                  alert('Ошибка при загрузке работ: ' + error);
                }
              } else {
                console.log('MasterDashboard: No confirmed works or parts, reloading orders');
                loadOrders(); // Перезагружаем список заказов
              }
            }, 100);
          }}
          onRejectAll={async () => {
            // Обработка отказа от всего - изменяем статус заказа на "Closed"
            // В реальной системе, возможно, нужно будет учесть оплату за диагностику
            try {
              // Получаем токен сессии из localStorage
              const sessionToken = localStorage.getItem('sessionToken');
              if (!sessionToken) {
                alert('Сессия не найдена. Пожалуйста, войдите в систему.');
                return;
              }

              await invoke('update_order_status', {
                sessionToken,
                orderId: selectedOrder.id,
                newStatus: 'Closed'
              });
              console.log('Order rejected by client and status updated to Closed');
              setShowClientApprovalModal(false);
              loadOrders(); // Перезагружаем список заказов
            } catch (error) {
              console.error('Error rejecting order:', error);
            }
          }}
          onAssignWorkers={() => {
            // Закрываем модальное окно согласования и открываем назначение работников
            setShowClientApprovalModal(false);
            setShowAssignWorkersModal(true);
          }}
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

      {/* Модальное окно завершения заказа */}
      {showFinalProcessingModal && selectedOrder && selectedClientForFinalProcessing && selectedCarForFinalProcessing && (
        <FinalProcessingModal
          isOpen={showFinalProcessingModal}
          order={selectedOrder}
          client={selectedClientForFinalProcessing}
          car={selectedCarForFinalProcessing}
          onClose={() => setShowFinalProcessingModal(false)}
          onCompletion={() => {
            setShowFinalProcessingModal(false);
            loadOrders(); // Перезагружаем список заказов после завершения
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

      {/* Modal for selecting a car for the client */}
      {showClientCarsModal && selectedClientForCars && (
        <div className="modal-overlay" onClick={() => setShowClientCarsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚗 Выбор автомобиля для {selectedClientForCars.full_name}</h2>
              <button className="close-btn" onClick={() => setShowClientCarsModal(false)}>✖ ЗАКРЫТЬ</button>
            </div>

            <div className="modal-body">
              {clientCars.length > 0 ? (
                <div className="client-cars-list">
                  <p>Выберите автомобиль клиента:</p>
                  <ul>
                    {clientCars.map((car) => (
                      <li
                        key={car.id}
                        className="car-item"
                        onClick={() => {
                          handleCreateNewOrder(selectedClientForCars, car);
                          setShowClientCarsModal(false);
                        }}
                      >
                        <div>
                          <strong>{car.make} {car.model}</strong> | {car.license_plate || 'Нет номера'}
                        </div>
                        <div className="car-details">
                          {car.production_year ? `Год: ${car.production_year}` : ''} |
                          {car.mileage} км |
                          {car.vin ? `VIN: ${car.vin}` : 'VIN: не указан'}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="no-cars">
                  <p>У клиента пока нет зарегистрированных автомобилей.</p>
                  <p>Вы можете добавить автомобиль для клиента.</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {clientCars.length === 0 && (
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setShowClientCarsModal(false);
                    // Set the selected client for the new car modal
                    setSelectedCarForNewOrder(null);
                    setShowNewCarModal(true);
                  }}
                >
                  ➕ ДОБАВИТЬ АВТОМОБИЛЬ
                </button>
              )}
              <button
                className="primary-btn"
                onClick={() => {
                  handleCreateNewOrder(selectedClientForCars, null);
                  setShowClientCarsModal(false);
                }}
              >
                🚀 НОВЫЙ ЗАКАЗ БЕЗ АВТОМОБИЛЯ
              </button>
            </div>
          </div>
        </div>
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
          works={orderWorks}
          onClose={() => setShowAssignWorkersModal(false)}
          onAssignmentSaved={() => {
            setShowAssignWorkersModal(false);
            loadOrders(); // Перезагружаем список заказов после назначения работников
          }}
        />
      )}
    </div>
  );
};

export default MasterDashboard;