import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User } from '../types/user';

import './AdminDashboard.css';
import ServicesReferenceModal from './ServicesReferenceModal';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'logs' | 'services'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Форма для добавления/редактирования сотрудника
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserData, setNewUserData] = useState({
    id: 0,
    full_name: '',
    role: 'Worker',
    login: '',
    password_hash: '',
    pin_code: '',
    status: 'Active'
  });

  // Загрузка данных в зависимости от активной вкладки
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === 'users') {
          const response: User[] = await invoke('get_all_users');
          setUsers(response);
        } else if (activeTab === 'settings') {
          const settings: string = await invoke('get_system_settings');
          setSystemSettings(JSON.parse(settings));
        } else if (activeTab === 'logs') {
          setLogsLoading(true);
          const logsData: string = await invoke('get_system_logs', { filters: '{}' });
          setLogs(JSON.parse(logsData));
          setLogsLoading(false);
        }
      } catch (err) {
        console.error('Error in fetchData:', err);
        setError('Ошибка загрузки данных: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleAddUser = () => {
    setEditingUser(null);
    setNewUserData({
      id: 0, // будет установлен сервером
      full_name: '',
      role: 'Worker',
      login: '',
      password_hash: '',
      pin_code: '',
      status: 'Active'
    });
    setShowUserForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUserData({
      id: user.id,
      full_name: user.full_name || '',
      role: user.role || 'Worker',
      login: user.login || '',
      password_hash: '',
      pin_code: user.pin_code || '',
      status: user.status || 'Active'
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      try {
        // Получаем токен сессии из localStorage
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
          alert('Сессия не найдена. Пожалуйста, войдите в систему.');
          return;
        }

        await invoke('delete_user', {
          sessionToken,
          userId
        });
        // Обновляем список пользователей
        const response: User[] = await invoke('get_all_users');
        setUsers(response);
      } catch (err) {
        console.error('Error deleting user:', err);
        setError('Ошибка удаления пользователя: ' + (err as Error).message);
      }
    }
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Получаем токен сессии из localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        alert('Сессия не найдена. Пожалуйста, войдите в систему.');
        return;
      }

      // Обновляем/создаем пользователя
      if (editingUser) {
        await invoke('update_user', {
          sessionToken,
          user_id: editingUser.id,
          user_data: {
            ...newUserData,
            // Используем пароль только если он был изменен
            password_hash: newUserData.password_hash || editingUser?.password_hash
          }
        });
      } else {
        await invoke('create_user', {
          sessionToken,
          user_data: newUserData
        });
      }

      // Обновляем список пользователей
      const response: User[] = await invoke('get_all_users');
      setUsers(response);
      setShowUserForm(false);
    } catch (err) {
      console.error('Error saving user:', err);
      setError('Ошибка сохранения пользователя: ' + (err as Error).message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  console.log("AdminDashboard rendering with user:", user);
  console.log("Active tab:", activeTab);
  console.log("Loading:", loading);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Панель администратора</h1>
        <h2>Добро пожаловать, {user?.full_name || 'Администратор'}</h2>
        <button className="logout-btn" onClick={onLogout}>Выйти</button>
      </div>

      <div className="dashboard-content">
        <div className="content-wrapper">
          <div className="sidebar">
            <button
              className={activeTab === 'users' ? 'active' : ''}
              onClick={() => setActiveTab('users')}
            >
              Управление сотрудниками
            </button>
            <button
              className={activeTab === 'settings' ? 'active' : ''}
              onClick={() => setActiveTab('settings')}
            >
              Настройки системы
            </button>
            <button
              className={activeTab === 'logs' ? 'active' : ''}
              onClick={() => setActiveTab('logs')}
            >
              Журнал событий
            </button>
            <button
              className={activeTab === 'services' ? 'active' : ''}
              onClick={() => setActiveTab('services')}
            >
              Справочник услуг
            </button>

            <div className="role-preview">
              <h3>Просмотр ролей:</h3>
              <button onClick={() => window.location.hash = '#master'}>Мастер-Приемщик</button>
              <button onClick={() => window.location.hash = '#diagnostician'}>Диагност</button>
              <button onClick={() => window.location.hash = '#storekeeper'}>Кладовщик</button>
              <button onClick={() => window.location.hash = '#worker'}>Работник</button>
            </div>
          </div>

          <div className="main-content">
          {activeTab === 'users' && (
            <div className="users-section">
              <div className="section-header">
                <h2>Сотрудники</h2>
                <button className="add-btn" onClick={handleAddUser}>Добавить сотрудника</button>
              </div>
              
              {loading ? (
                <p>Загрузка сотрудников...</p>
              ) : error ? (
                <p className="error-message">{error}</p>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>ФИО</th>
                      <th>Роль</th>
                      <th>Логин</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.full_name}</td>
                        <td>{user.role}</td>
                        <td>{user.login || '-'}</td>
                        <td>{user.status}</td>
                        <td>
                          <button className="edit-btn" onClick={() => handleEditUser(user)}>Редактировать</button>
                          <button 
                            className="delete-btn" 
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.login === 'admin'} // Не позволяем удалить главного администратора
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="settings-section">
              <h2>Настройки системы</h2>
              {loading ? (
                <p>Загрузка настроек...</p>
              ) : systemSettings ? (
                <div className="settings-form">
                  <h3>Информация об организации</h3>
                  <div className="form-group">
                    <label>Название:</label>
                    <input
                      type="text"
                      defaultValue={systemSettings.company_name}
                      id="company-name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Адрес:</label>
                    <input
                      type="text"
                      defaultValue={systemSettings.address}
                      id="company-address"
                    />
                  </div>

                  <div className="form-group">
                    <label>Телефон:</label>
                    <input
                      type="text"
                      defaultValue={systemSettings.phone}
                      id="company-phone"
                    />
                  </div>

                  <div className="form-group">
                    <label>Стоимость диагностики (фиксированная):</label>
                    <input
                      type="number"
                      defaultValue={systemSettings.diagnostics_cost}
                      id="diagnostics-cost"
                    /> $
                  </div>

                  <h3>График работы</h3>
                  <div className="schedule-container">
                    <div className="form-group">
                      <label>Пн-Пт:</label>
                      <input
                        type="text"
                        defaultValue={systemSettings.work_schedule.mon_to_fri}
                        id="schedule-mon-fri"
                      />
                    </div>

                    <div className="form-group">
                      <label>Сб:</label>
                      <input
                        type="text"
                        defaultValue={systemSettings.work_schedule.saturday}
                        id="schedule-saturday"
                      />
                    </div>

                    <div className="form-group">
                      <label>Вс:</label>
                      <input
                        type="text"
                        defaultValue={systemSettings.work_schedule.sunday}
                        id="schedule-sunday"
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      className="save-btn"
                      onClick={async () => {
                        try {
                          // Собираем данные из формы
                          const updatedSettings = {
                            company_name: (document.getElementById('company-name') as HTMLInputElement).value,
                            address: (document.getElementById('company-address') as HTMLInputElement).value,
                            phone: (document.getElementById('company-phone') as HTMLInputElement).value,
                            diagnostics_cost: (document.getElementById('diagnostics-cost') as HTMLInputElement).value,
                            work_schedule: {
                              mon_to_fri: (document.getElementById('schedule-mon-fri') as HTMLInputElement).value,
                              saturday: (document.getElementById('schedule-saturday') as HTMLInputElement).value,
                              sunday: (document.getElementById('schedule-sunday') as HTMLInputElement).value
                            }
                          };

                          await invoke('save_system_settings', {
                            settings: JSON.stringify(updatedSettings)
                          });
                          alert('Настройки успешно сохранены');
                        } catch (err) {
                          console.error('Error saving settings:', err);
                          setError('Ошибка сохранения настроек: ' + (err as Error).message);
                        }
                      }}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <p>Не удалось загрузить настройки</p>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="logs-section">
              <div className="section-header">
                <h2>Журнал событий</h2>
                <div className="logs-controls">
                  <select id="log-filter">
                    <option value="Все события">Все события</option>
                    <option value="Login">Вход</option>
                    <option value="Create_Order">Создание заказа</option>
                    <option value="Update_Order_Status">Изменение статуса заказа</option>
                    <option value="Create_User">Создание пользователя</option>
                    <option value="Update_User">Изменение пользователя</option>
                    <option value="Delete_User">Удаление пользователя</option>
                    <option value="Service_Creation">Создание услуги</option>
                    <option value="Service_Update">Изменение услуги</option>
                    <option value="Service_Delete">Удаление услуги</option>
                  </select>
                  <input type="text" placeholder="Поиск по описанию..." id="log-search" />
                  <button onClick={async () => {
                    try {
                      setLogsLoading(true);
                      const filters = {
                        filter: (document.getElementById('log-filter') as HTMLSelectElement).value,
                        search: (document.getElementById('log-search') as HTMLInputElement).value
                      };
                      const logsData: string = await invoke('get_system_logs', {
                        filters: JSON.stringify(filters)
                      });
                      setLogs(JSON.parse(logsData));
                    } catch (err) {
                      console.error('Error loading logs:', err);
                      setError('Ошибка загрузки логов: ' + (err as Error).message);
                    } finally {
                      setLogsLoading(false);
                    }
                  }}>🔍</button>
                </div>
              </div>

              {logsLoading ? (
                <p>Загрузка логов...</p>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Дата и Время</th>
                      <th>Пользователь</th>
                      <th>Событие</th>
                      <th>Детали</th>
                      <th>IP-адрес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr key={log.id || index}>
                        <td>{log.timestamp}</td>
                        <td>{log.user}</td>
                        <td>{log.event}</td>
                        <td>{log.details}</td>
                        <td>{log.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="logs-actions">
                <button className="export-btn">📥 Экспорт в CSV</button>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="services-section">
              <h2>Справочник услуг</h2>
              <ServicesReferenceModal
                isOpen={true}
                onClose={() => setActiveTab('users')}
              />
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Модальное окно для добавления/редактирования сотрудника */}
      {showUserForm && (
        <div className="modal-overlay" onClick={() => setShowUserForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingUser ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h3>
            <form onSubmit={handleSubmitUser}>
              <div className="form-group">
                <label>ФИО:</label>
                <input
                  type="text"
                  name="full_name"
                  value={newUserData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Роль:</label>
                <select
                  name="role"
                  value={newUserData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Admin">Администратор</option>
                  <option value="Master">Мастер-Приемщик</option>
                  <option value="Diagnostician">Диагност</option>
                  <option value="Storekeeper">Кладовщик</option>
                  <option value="Worker">Работник</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Логин:</label>
                <input
                  type="text"
                  name="login"
                  value={newUserData.login}
                  onChange={handleInputChange}
                  required={!editingUser} // Не обязательно для редактирования, если уже задан
                />
              </div>
              
              <div className="form-group">
                <label>Пароль:</label>
                <input
                  type="password"
                  name="password_hash"
                  value={newUserData.password_hash}
                  onChange={handleInputChange}
                  placeholder={editingUser ? "Оставьте пустым, чтобы не менять" : ""}
                />
              </div>
              
              <div className="form-group">
                <label>PIN-код (для работников):</label>
                <input
                  type="text"
                  name="pin_code"
                  value={newUserData.pin_code}
                  onChange={handleInputChange}
                  pattern="[0-9]{4}"
                  placeholder="XXXX"
                  maxLength={4}
                />
              </div>
              
              <div className="form-group">
                <label>Статус:</label>
                <select
                  name="status"
                  value={newUserData.status}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Active">Активен</option>
                  <option value="Inactive">Неактивен</option>
                </select>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="save-btn">Сохранить</button>
                <button type="button" className="cancel-btn" onClick={() => setShowUserForm(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;