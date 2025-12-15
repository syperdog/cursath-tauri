-- База данных для системы управления станцией технического обслуживания (СТО)

-- Пользовательские типы данных (ENUM)

-- Типы статусов заказов
-- New: Новый заказ
-- Diagnostics: На диагностике
-- Parts_Selection: Подбор запчастей
-- Approval: На согласовании с клиентом
-- Approved: Согласован
-- In_Work: В работе
-- Quality_Control: Контроль качества
-- Ready: Готов к выдаче
-- Closed: Закрыт
-- Cancelled: Отменен
-- Agreed: Согласован
-- Payment: На оплате
CREATE TYPE public.order_status AS ENUM (
    'New',
    'Diagnostics',
    'Parts_Selection',
    'Approval',
    'Approved',
    'In_Work',
    'Quality_Control',
    'Ready',
    'Closed',
    'Cancelled',
    'Agreed',
    'Payment'
);

-- Типы источников запчастей
-- Stock: Из склада
-- Supplier: У поставщика
CREATE TYPE public.part_source AS ENUM (
    'Stock',
    'Supplier'
);

-- Роли пользователей
-- Admin: Администратор
-- Master: Мастер-приёмщик
-- Diagnostician: Диагност
-- Storekeeper: Кладовщик
-- Worker: Работник
CREATE TYPE public.user_role AS ENUM (
    'Admin',
    'Master',
    'Diagnostician',
    'Storekeeper',
    'Worker'
);

-- Статусы пользователей
-- Active: Активен
-- Inactive: Неактивен
CREATE TYPE public.user_status AS ENUM (
    'Active',
    'Inactive'
);

-- Статусы работ
-- Pending: В ожидании
-- In_Progress: В процессе
-- Done: Выполнено
CREATE TYPE public.work_status AS ENUM (
    'Pending',
    'In_Progress',
    'Done'
);

-- Таблица автомобилей клиентов
-- Содержит информацию о транспортных средствах, приезжающих на станцию техобслуживания
CREATE TABLE public.cars (
    id integer NOT NULL, -- Уникальный идентификатор автомобиля
    client_id integer, -- Ссылка на владельца автомобиля
    vin character varying(17), -- VIN-номер автомобиля (уникальный)
    license_plate character varying(15), -- Номерной знак
    make character varying(50) NOT NULL, -- Марка автомобиля
    model character varying(50) NOT NULL, -- Модель автомобиля
    production_year integer, -- Год производства
    mileage integer NOT NULL, -- Пробег на момент последнего визита
    last_visit_date timestamp without time zone, -- Дата последнего визита на станцию
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP -- Дата создания записи
);

-- Последовательность для генерации ID автомобилей
CREATE SEQUENCE public.cars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.cars_id_seq OWNED BY public.cars.id;

-- Таблица клиентов
-- Содержит информацию о клиентах станции техобслуживания
CREATE TABLE public.clients (
    id integer NOT NULL, -- Уникальный идентификатор клиента
    full_name character varying(100) NOT NULL, -- Полное имя клиента
    phone character varying(20) NOT NULL, -- Телефон клиента
    address character varying(200), -- Адрес клиента
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP -- Дата создания записи
);

-- Последовательность для генерации ID клиентов
CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;

-- Таблица узлов неисправностей
-- Группирует типы неисправностей по узлам автомобиля
CREATE TABLE public.defect_nodes (
    id integer NOT NULL, -- Уникальный идентификатор узла
    name character varying(100) NOT NULL, -- Название узла (например, "Двигатель", "Тормозная система")
    description text -- Описание узла
);

-- Последовательность для генерации ID узлов неисправностей
CREATE SEQUENCE public.defect_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_nodes_id_seq OWNED BY public.defect_nodes.id;

-- Таблица связи между типами неисправностей и услугами
-- Позволяет определить, какие услуги связаны с конкретным типом неисправности
CREATE TABLE public.defect_type_services (
    id integer NOT NULL, -- Уникальный идентификатор связи
    defect_type_id integer, -- Ссылка на тип неисправности
    service_id integer -- Ссылка на услугу
);

-- Последовательность для генерации ID связей
CREATE SEQUENCE public.defect_type_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_type_services_id_seq OWNED BY public.defect_type_services.id;

-- Таблица типов неисправностей
-- Определяет возможные типы неисправностей, которые могут быть обнаружены на станции
CREATE TABLE public.defect_types (
    id integer NOT NULL, -- Уникальный идентификатор типа неисправности
    node_id integer, -- Ссылка на узел, к которому относится неисправность
    name character varying(100) NOT NULL, -- Название типа неисправности
    description text -- Описание неисправности
);

-- Последовательность для генерации ID типов неисправностей
CREATE SEQUENCE public.defect_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_types_id_seq OWNED BY public.defect_types.id;

-- Таблица неисправностей по заказам
-- Фиксирует выявленные неисправности во время диагностики конкретного заказа
CREATE TABLE public.order_defects (
    id integer NOT NULL, -- Уникальный идентификатор неисправности по заказу
    order_id integer, -- Ссылка на заказ
    diagnostician_id integer, -- Ссылка на диагноста, который обнаружил неисправность
    defect_description character varying(255) NOT NULL, -- Описание неисправности
    diagnostician_comment text, -- Комментарий диагноста
    is_confirmed boolean DEFAULT false, -- Подтверждена ли неисправность клиентом
    defect_type_id integer -- Ссылка на тип неисправности
);

-- Последовательность для генерации ID неисправностей по заказам
CREATE SEQUENCE public.order_defects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_defects_id_seq OWNED BY public.order_defects.id;

-- Таблица запчастей по заказам
-- Содержит информацию о запчастях, необходимых или использованных для выполнения заказа
CREATE TABLE public.order_parts (
    id integer NOT NULL, -- Уникальный идентификатор запчасти по заказу
    order_id integer, -- Ссылка на заказ
    warehouse_item_id integer, -- Ссылка на конкретный элемент на складе
    part_name_snapshot character varying(150), -- Название запчасти (снимок на момент заказа)
    brand character varying(50), -- Бренд запчасти
    supplier character varying(100), -- Поставщик запчасти
    quantity integer DEFAULT 1, -- Количество запчастей
    price_per_unit numeric(10,2) NOT NULL, -- Цена за единицу
    source_type public.part_source DEFAULT 'Stock'::public.part_source, -- Источник запчасти (со склада или у поставщика)
    is_issued boolean DEFAULT false, -- Выдана ли запчасть в производство
    issued_by integer, -- Кто выдал запчасть
    issued_at timestamp without time zone, -- Когда запчасть была выдана
    defect_id integer, -- Ссылка на неисправность, для устранения которой требовалась запчасть
    is_confirmed boolean DEFAULT false -- Подтверждена ли необходимость запчасти клиентом
);

-- Последовательность для генерации ID запчастей по заказам
CREATE SEQUENCE public.order_parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_parts_id_seq OWNED BY public.order_parts.id;

-- Таблица работ по заказам
-- Содержит информацию о работах, запланированных или выполненных для заказа
CREATE TABLE public.order_works (
    id integer NOT NULL, -- Уникальный идентификатор работы по заказу
    order_id integer, -- Ссылка на заказ
    service_id integer, -- Ссылка на тип услуги
    service_name_snapshot character varying(150), -- Название услуги (снимок на момент заказа)
    price numeric(10,2) NOT NULL, -- Цена работы
    norm_hours numeric(4,2), -- Нормативные часы на выполнение работы
    worker_id integer, -- Ссылка на работника, который будет выполнять работу
    status public.work_status DEFAULT 'Pending'::public.work_status, -- Статус работы
    started_at timestamp without time zone, -- Время начала работы
    finished_at timestamp without time zone, -- Время окончания работы
    is_confirmed boolean DEFAULT false -- Подтверждена ли работа клиентом
);

-- Таблица связи работ и неисправностей
-- Определяет какая работа предназначена для устранения конкретной неисправности
CREATE TABLE public.order_works_defects (
    id integer NOT NULL, -- Уникальный идентификатор связи
    work_id integer, -- Ссылка на работу
    defect_id integer -- Ссылка на неисправность
);

-- Последовательность для генерации ID связей работ и неисправностей
CREATE SEQUENCE public.order_works_defects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_works_defects_id_seq OWNED BY public.order_works_defects.id;

-- Последовательность для генерации ID работ по заказам
CREATE SEQUENCE public.order_works_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_works_id_seq OWNED BY public.order_works.id;

-- Таблица заказов
-- Основная таблица, содержащую информацию о заказах на ремонт и обслуживание
CREATE TABLE public.orders (
    id integer NOT NULL, -- Уникальный идентификатор заказа
    client_id integer, -- Ссылка на клиента, которому принадлежит заказ
    car_id integer, -- Ссылка на автомобиль, для которого оформлен заказ
    master_id integer, -- Ссылка на мастера, который обслуживает заказ
    status public.order_status DEFAULT 'New'::public.order_status, -- Статус заказа
    complaint text, -- Жалобы клиента на автомобиль
    current_mileage integer, -- Пробег автомобиля на момент приема
    prepayment numeric(10,2) DEFAULT 0.00, -- Предоплата
    total_amount numeric(10,2) DEFAULT 0.00, -- Общая сумма заказа
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP, -- Дата создания заказа
    completed_at timestamp without time zone, -- Дата завершения заказа
    worker_id integer -- Ссылка на работника, который непосредственно выполняет заказ
);

-- Последовательность для генерации ID заказов
CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

-- Таблица справочника услуг
-- Содержит перечень доступных услуг с базовыми ценами и нормо-часами
CREATE TABLE public.services_reference (
    id integer NOT NULL, -- Уникальный идентификатор услуги
    name character varying(150) NOT NULL, -- Название услуги
    base_price numeric(10,2) DEFAULT 0.00, -- Базовая цена услуги
    norm_hours numeric(4,2) DEFAULT 0.00 -- Нормативное время выполнения услуги
);

-- Последовательность для генерации ID услуг
CREATE SEQUENCE public.services_reference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.services_reference_id_seq OWNED BY public.services_reference.id;

-- Таблица системных логов
-- Хранит информацию о событиях в системе
CREATE TABLE public.system_logs (
    id integer NOT NULL, -- Уникальный идентификатор записи лога
    user_id integer, -- Ссылка на пользователя, создавшего запись (если есть)
    event_type character varying(50), -- Тип события
    description text, -- Описание события
    ip_address character varying(45), -- IP-адрес, с которого произошло событие
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP -- Время события
);

-- Последовательность для генерации ID логов
CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;

-- Таблица пользователей
-- Содержит информацию о пользователях системы (администраторы, мастера, диагносты, кладовщики, работники)
CREATE TABLE public.users (
    id integer NOT NULL, -- Уникальный идентификатор пользователя
    full_name character varying(100) NOT NULL, -- Полное имя пользователя
    role public.user_role NOT NULL, -- Роль пользователя в системе
    login character varying(50), -- Логин пользователя (уникальный)
    password_hash character varying(255), -- Хэш пароля пользователя
    pin_code character varying(4), -- PIN-код для работников
    status public.user_status DEFAULT 'Active'::public.user_status, -- Статус пользователя
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP -- Дата создания учетной записи
);

-- Последовательность для генерации ID пользователей
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- Таблица склада
-- Содержит информацию о запчастях на складе
CREATE TABLE public.warehouse (
    id integer NOT NULL, -- Уникальный идентификатор элемента на складе
    name character varying(150) NOT NULL, -- Название запчасти
    brand character varying(50), -- Бренд запчасти
    article character varying(50), -- Артикул запчасти
    location_cell character varying(20), -- Ячейка хранения на складе
    quantity integer DEFAULT 0, -- Количество запчастей на складе
    min_quantity integer DEFAULT 2, -- Минимальное количество для уведомления о необходимости пополнения
    purchase_price numeric(10,2), -- Цена покупки запчасти
    selling_price numeric(10,2) -- Цена продажи запчасти
);

-- Последовательность для генерации ID элементов склада
CREATE SEQUENCE public.warehouse_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.warehouse_id_seq OWNED BY public.warehouse.id;

-- Установка DEFAULT для столбцов ID с использованием соответствующих последовательностей
ALTER TABLE ONLY public.cars ALTER COLUMN id SET DEFAULT nextval('public.cars_id_seq'::regclass);
ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);
ALTER TABLE ONLY public.defect_nodes ALTER COLUMN id SET DEFAULT nextval('public.defect_nodes_id_seq'::regclass);
ALTER TABLE ONLY public.defect_type_services ALTER COLUMN id SET DEFAULT nextval('public.defect_type_services_id_seq'::regclass);
ALTER TABLE ONLY public.defect_types ALTER COLUMN id SET DEFAULT nextval('public.defect_types_id_seq'::regclass);
ALTER TABLE ONLY public.order_defects ALTER COLUMN id SET DEFAULT nextval('public.order_defects_id_seq'::regclass);
ALTER TABLE ONLY public.order_parts ALTER COLUMN id SET DEFAULT nextval('public.order_parts_id_seq'::regclass);
ALTER TABLE ONLY public.order_works ALTER COLUMN id SET DEFAULT nextval('public.order_works_id_seq'::regclass);
ALTER TABLE ONLY public.order_works_defects ALTER COLUMN id SET DEFAULT nextval('public.order_works_defects_id_seq'::regclass);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);
ALTER TABLE ONLY public.services_reference ALTER COLUMN id SET DEFAULT nextval('public.services_reference_id_seq'::regclass);
ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.warehouse ALTER COLUMN id SET DEFAULT nextval('public.warehouse_id_seq'::regclass);

-- Создание первичных ключей для всех таблиц
ALTER TABLE ONLY public.cars ADD CONSTRAINT cars_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cars ADD CONSTRAINT cars_vin_key UNIQUE (vin);
ALTER TABLE ONLY public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.defect_nodes ADD CONSTRAINT defect_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.defect_type_services ADD CONSTRAINT defect_type_services_defect_type_id_service_id_key UNIQUE (defect_type_id, service_id);
ALTER TABLE ONLY public.defect_type_services ADD CONSTRAINT defect_type_services_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.defect_types ADD CONSTRAINT defect_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_defects ADD CONSTRAINT order_defects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_parts ADD CONSTRAINT order_parts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_works_defects ADD CONSTRAINT order_works_defects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_works_defects ADD CONSTRAINT order_works_defects_work_id_defect_id_key UNIQUE (work_id, defect_id);
ALTER TABLE ONLY public.order_works ADD CONSTRAINT order_works_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.services_reference ADD CONSTRAINT services_reference_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.system_logs ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_login_key UNIQUE (login);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warehouse ADD CONSTRAINT warehouse_pkey PRIMARY KEY (id);

-- Создание внешних ключей для обеспечения целостности данных
ALTER TABLE ONLY public.cars ADD CONSTRAINT cars_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.defect_type_services ADD CONSTRAINT defect_type_services_defect_type_id_fkey FOREIGN KEY (defect_type_id) REFERENCES public.defect_types(id);
ALTER TABLE ONLY public.defect_type_services ADD CONSTRAINT defect_type_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_reference(id);
ALTER TABLE ONLY public.defect_types ADD CONSTRAINT defect_types_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.defect_nodes(id);
ALTER TABLE ONLY public.order_defects ADD CONSTRAINT order_defects_defect_type_id_fkey FOREIGN KEY (defect_type_id) REFERENCES public.defect_types(id);
ALTER TABLE ONLY public.order_defects ADD CONSTRAINT order_defects_diagnostician_id_fkey FOREIGN KEY (diagnostician_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.order_defects ADD CONSTRAINT order_defects_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_parts ADD CONSTRAINT order_parts_defect_id_fkey FOREIGN KEY (def_id) REFERENCES public.order_defects(id);
ALTER TABLE ONLY public.order_parts ADD CONSTRAINT order_parts_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.order_parts ADD CONSTRAINT order_parts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_parts ADD CONSTRAINT order_parts_warehouse_item_id_fkey FOREIGN KEY (warehouse_item_id) REFERENCES public.warehouse(id);
ALTER TABLE ONLY public.order_works_defects ADD CONSTRAINT order_works_defects_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.order_defects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_works_defects ADD CONSTRAINT order_works_defects_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.order_works(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_works ADD CONSTRAINT order_works_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_works ADD CONSTRAINT order_works_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_reference(id);
ALTER TABLE ONLY public.order_works ADD CONSTRAINT order_works_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.system_logs ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;