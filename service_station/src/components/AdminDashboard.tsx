import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { User } from '../types/tauri';

import './AdminDashboard.css';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Форма для добавления/редактирования сотрудника
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserData, setNewUserData] = useState({
    full_name: '',
    role: 'Worker',
    login: '',
    password: '',
    pin_code: '',
    status: 'Active'
  });

  // Загрузка списка пользователей
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response: User[] = await invoke('get_all_users');
        setUsers(response);
        setLoading(false);
      } catch (err) {
        setError('Ошибка загрузки пользователей: ' + (err as Error).message);
        setLoading(false);
      }
    };
    
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleAddUser = () => {
    setEditingUser(null);
    setNewUserData({
      full_name: '',
      role: 'Worker',
      login: '',
      password: '',
      pin_code: '',
      status: 'Active'
    });
    setShowUserForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUserData({
      full_name: user.full_name || '',
      role: user.role || 'Worker',
      login: user.login || '',
      password: '',
      pin_code: user.pin_code || '',
      status: user.status || 'Active'
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      try {
        await invoke('delete_user', { userId });
        // Обновляем список пользователей
        const response: User[] = await invoke('get_all_users');
        setUsers(response);
      } catch (err) {
        setError('Ошибка удаления пользователя: ' + (err as Error).message);
      }
    }
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Обновляем пользователя
        await invoke('update_user', { 
          userId: editingUser.id, 
          userData: newUserData 
        });
      } else {
        // Создаем нового пользователя
        await invoke('create_user', { userData: newUserData });
      }
      
      // Обновляем список пользователей
      const response: User[] = await invoke('get_all_users');
      setUsers(response);
      setShowUserForm(false);
    } catch (err) {
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

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Панель администратора</h1>
        <h2>Добро пожаловать, {user.full_name}</h2>
        <button className="logout-btn" onClick={onLogout}>Выйти</button>
      </div>

      <div className="dashboard-content">
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
              <p>Здесь будут настройки системы.</p>
              {/* Добавим заглушку для будущих настроек */}
            </div>
          )}
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
                  name="password"
                  value={newUserData.password}
                  onChange={handleInputChange}
                  required={!editingUser} // Не обязательно для редактирования
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