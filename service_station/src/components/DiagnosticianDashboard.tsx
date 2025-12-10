import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './DiagnosticianDashboard.css';
import DiagnosticsModal from './DiagnosticsModal';

// Типы данных для заказа и автомобиля
type Order = {
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
};

// Тип для пользователя
interface User {
  id: number;
  full_name: string;
  role: string;
  login: string;
  status: string;
  pin_code: string;
}

// Тип для результатов диагностики
type DiagnosticResult = {
  id: number;
  order_id: number;
  diagnostician_id: number;
  description: string;
  created_at: string;
};

// Тип для автомобиля
type Car = {
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
};

const DiagnosticianDashboard: React.FC = () => {
  // Состояние для списка заказов, ожидающих диагностики
  const [orders, setOrders] = useState<Order[]>([]);

  // Состояние для карточек автомобилей
  const [carDetailsMap, setCarDetailsMap] = useState<Record<number, Car>>({});

  // Состояние для пользователя
  const [user, setUser] = useState<User | null>(null);

  // Состояние для выбранного заказа
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  // Состояние для отображения модального окна диагностики
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

  // Функция для обработки выбора заказа
  const handleSelectOrder = (orderId: number) => {
    setSelectedOrder(orderId);
  };

  // Функция для начала диагностики
  const handleStartDiagnosis = () => {
    if (selectedOrder !== null) {
      setShowDiagnosticsModal(true);
    }
  };

  // Функция для завершения диагностики
  const handleDiagnosisComplete = async (faults: any[]) => {
    console.log(`Диагностика для заказа #${selectedOrder} завершена. Неисправности:`, faults);

    // Получаем ID диагноста из сессии пользователя
    const diagnosticianId = user?.id;

    if (selectedOrder && diagnosticianId) {
      try {
        // Сначала сохраняем результаты диагностики
        // Преобразуем список неисправностей в формат, подходящий для сохранения
        const diagnosticResults = faults.map(fault => ({
          id: 0, // будет сгенерирован в базе данных
          order_id: selectedOrder,
          diagnostician_id: diagnosticianId,
          description: `${fault.category} / ${fault.type} - ${fault.comment}`,
          created_at: new Date().toISOString()
        }));

        if (diagnosticResults.length > 0) {
          // Передаем только описания неисправностей, а не полный объект DiagnosticResult
          const defectDescriptions = diagnosticResults.map(d => d.description);
          await invoke('save_diagnostic_results', {
            orderId: selectedOrder,
            diagnosticianId: diagnosticianId,
            defects: defectDescriptions
          });
          console.log(`Результаты диагностики для заказа #${selectedOrder} сохранены`);
        }

        // Затем обновляем статус заказа на 'Parts_Selection', чтобы передать заказ кладовщику
        const statusUpdateResult = await invoke('update_order_status', {
          orderId: selectedOrder,
          newStatus: 'Parts_Selection'
        });
        console.log(`Статус заказа #${selectedOrder} обновлён на 'Parts_Selection'. Результат:`, statusUpdateResult);

        // После обновления статуса, обновляем список заказов
        fetchOrders();
      } catch (error) {
        console.error('Ошибка при сохранении результатов диагностики или обновлении статуса:', error);
      }
    }

    // Сбрасываем выбранный заказ, так как он больше не будет в списке
    setSelectedOrder(null);
    setShowDiagnosticsModal(false);
  };

  // Функция для закрытия модального окна
  const handleCloseModal = () => {
    setShowDiagnosticsModal(false);
  };

  // Функция для получения заказов для диагноста
  const fetchOrders = async () => {
    try {
      const fetchedOrders: Order[] = await invoke('get_orders_for_diagnostician');
      setOrders(fetchedOrders);

      // Fetch car details for each order
      const carDetailsPromises = fetchedOrders.map(order =>
        invoke<Car>('get_car_by_id', { carId: order.car_id })
      );

      const carDetailsList = await Promise.all(carDetailsPromises);

      // Create a map of carId to car details
      const newCarDetailsMap: Record<number, Car> = {};
      carDetailsList.forEach((car, index) => {
        if (car) {
          newCarDetailsMap[fetchedOrders[index].car_id] = car;
        }
      });

      setCarDetailsMap(newCarDetailsMap);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  // Проверка сессии при загрузке компонента
  React.useEffect(() => {
    checkSession();
    fetchOrders(); // Добавляем вызов функции получения заказов
  }, []);

  const checkSession = async () => {
    try {
      // Получить токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');

      if (sessionToken) {
        const userData: User | null = await invoke('get_user_session', { sessionToken });

        if (userData && (userData.role === 'Diagnostician' || userData.role === 'Admin')) {
          setUser(userData);
        } else {
          // Перенаправить на форму входа, если сессия неактивна или роль не та
          window.location.hash = '#login';
        }
      } else {
        // Если нет токена сессии, перенаправить на вход
        window.location.hash = '#login';
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Перенаправить на форму входа в случае ошибки
      window.location.hash = '#login';
    }
  };

  const handleLogout = () => {
    // Сбросить данные сессии
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');

    // Перенаправить на страницу входа
    window.location.hash = '#login';
  };

  return (
    <div className="dashboard diagnostician-dashboard">
      <div className="dashboard-header">
        <h1>🔍 ДИАГНОСТ: {user?.full_name || 'Иванов И.И.'}</h1>
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
          <button className="exit-button" onClick={handleLogout}>✖ ВЫХОД</button>
        </div>
      </div>

      <div className="dashboard-content">
        <h2>ОЖИДАЮТ ДИАГНОСТИКИ:</h2>

        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Автомобиль</th>
                <th>Гос. Номер</th>
                <th>Причина обращения</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                // We'll need to fetch car details to display make/model and license plate
                const carDetails = carDetailsMap[order.car_id] || { make: '', model: '', license_plate: '' };
                const carModel = `${carDetails.make} ${carDetails.model}`;
                const issueDescription = order.complaint || '';

                return (
                  <tr
                    key={order.id}
                    className={selectedOrder === order.id ? 'selected' : ''}
                    onClick={() => handleSelectOrder(order.id)}
                  >
                    <td>{order.id}</td>
                    <td>{carModel}</td>
                    <td>{carDetails.license_plate}</td>
                    <td>{issueDescription}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="dashboard-actions">
          <button
            className="start-diagnosis-button"
            onClick={handleStartDiagnosis}
            disabled={selectedOrder === null}
          >
            📋 ПРОВЕСТИ ДИАГНОСТИКУ
          </button>
        </div>
      </div>

      {/* Модальное окно диагностики */}
      {showDiagnosticsModal && selectedOrder && (
        <DiagnosticsModal
          orderId={selectedOrder}
          clientComplaint={orders.find(o => o.id === selectedOrder)?.complaint || ''}
          onClose={handleCloseModal}
          onDiagnosisComplete={handleDiagnosisComplete}
        />
      )}
    </div>
  );
};

export default DiagnosticianDashboard;