-- 1. Удаление таблиц, если они существуют (для чистого запуска)
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS order_parts;
DROP TABLE IF EXISTS order_works;
DROP TABLE IF EXISTS order_defects;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS warehouse;
DROP TABLE IF EXISTS services_reference;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;

-- 2. Создание типов данных (ENUM) для фиксированных значений
CREATE TYPE user_role AS ENUM ('Admin', 'Master', 'Diagnostician', 'Storekeeper', 'Worker');
CREATE TYPE user_status AS ENUM ('Active', 'Inactive');
CREATE TYPE order_status AS ENUM (
    'New',                  -- Приемка
    'Diagnostics',          -- Диагностика
    'Parts_Selection',      -- Подбор деталей
    'Approval',             -- Согласование с клиентом
    'In_Work',              -- В работе
    'Quality_Control',      -- Контроль качества
    'Ready',                -- Готов к выдаче
    'Closed',               -- Выдан/Оплачен
    'Cancelled'             -- Отменен
);
CREATE TYPE part_source AS ENUM ('Stock', 'Supplier'); -- Со склада или под заказ
CREATE TYPE work_status AS ENUM ('Pending', 'In_Progress', 'Done'); -- Статус конкретной работы

-- 3. Таблица Пользователей (Сотрудников)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    login VARCHAR(50) UNIQUE,           -- Для Админа, Мастера, Кладовщика
    password_hash VARCHAR(255),         -- Хеш пароля
    pin_code VARCHAR(4),                -- Для Работников (см. п. 6.2)
    status user_status DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Таблица Клиентов
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Таблица Автомобилей
CREATE TABLE cars (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE,
    vin VARCHAR(17) UNIQUE,             -- Важно для API расшифровки
    license_plate VARCHAR(15),
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    production_year INT,
    mileage INT NOT NULL,               -- Текущий пробег
    last_visit_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Справочник Услуг (Прейскурант)
CREATE TABLE services_reference (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    base_price DECIMAL(10, 2) DEFAULT 0.00,
    norm_hours DECIMAL(4, 2) DEFAULT 0.00 -- Нормо-часы
);

-- 7. Склад (Инвентарь)
CREATE TABLE warehouse (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(50),
    article VARCHAR(50),                -- Артикул производителя
    location_cell VARCHAR(20),          -- Ячейка на складе (A-12-05)
    quantity INT DEFAULT 0,             -- Остаток
    min_quantity INT DEFAULT 2,         -- Неснижаемый остаток (см. п. 8.5)
    purchase_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2)
);

-- 8. Основная таблица Заказов (Заказ-наряд)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id) ON DELETE RESTRICT,
    car_id INT REFERENCES cars(id) ON DELETE RESTRICT,
    master_id INT REFERENCES users(id), -- Кто принял заказ
    
    status order_status DEFAULT 'New',
    complaint TEXT,                     -- Жалоба клиента (см. п. 6.10)
    current_mileage INT,                -- Пробег на момент заезда
    
    prepayment DECIMAL(10, 2) DEFAULT 0.00, -- Аванс (см. п. 6.13)
    total_amount DECIMAL(10, 2) DEFAULT 0.00, -- Итоговая сумма к оплате
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 9. Дефектовочная ведомость (Результаты диагностики)
-- См. пункт 7.2 - Диагност пишет проблемы, но не назначает цены.
CREATE TABLE order_defects (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    diagnostician_id INT REFERENCES users(id), -- Кто нашел
    
    defect_description VARCHAR(255) NOT NULL,
    diagnostician_comment TEXT,
    is_confirmed BOOLEAN DEFAULT FALSE -- Согласился ли клиент это чинить
);

-- 10. Работы в заказе (Смета по работам)
-- См. пункт 6.11 - Назначение исполнителей
CREATE TABLE order_works (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    service_id INT REFERENCES services_reference(id), -- Ссылка на справочник
    service_name_snapshot VARCHAR(150), -- Копия названия на случай удаления из справочника
    
    price DECIMAL(10, 2) NOT NULL,      -- Цена для клиента
    norm_hours DECIMAL(4, 2),           -- Для расчета ЗП механика
    
    worker_id INT REFERENCES users(id), -- Назначенный исполнитель (Слесарь)
    status work_status DEFAULT 'Pending',
    
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);

-- 11. Запчасти в заказе
-- См. пункт 8.2 и 8.4
CREATE TABLE order_parts (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    warehouse_item_id INT REFERENCES warehouse(id), -- Если со склада
    
    part_name_snapshot VARCHAR(150),    -- Название (может быть заказная позиция не со склада)
    brand VARCHAR(50),
    supplier VARCHAR(100),              -- Если под заказ (Шате-М, Армтек)
    
    quantity INT DEFAULT 1,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    source_type part_source DEFAULT 'Stock',
    
    is_issued BOOLEAN DEFAULT FALSE,    -- Выдано ли кладовщиком (см. п. 8.4)
    issued_by INT REFERENCES users(id), -- Кто выдал
    issued_at TIMESTAMP
);

-- 12. Журнал событий (Логи)
-- См. пункт 6.23
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50),             -- Login, Create_Order, Status_Change
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);