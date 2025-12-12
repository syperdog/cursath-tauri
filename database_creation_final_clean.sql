

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

CREATE TYPE public.part_source AS ENUM (
    'Stock',
    'Supplier'
);

CREATE TYPE public.user_role AS ENUM (
    'Admin',
    'Master',
    'Diagnostician',
    'Storekeeper',
    'Worker'
);

CREATE TYPE public.user_status AS ENUM (
    'Active',
    'Inactive'
);

CREATE TYPE public.work_status AS ENUM (
    'Pending',
    'In_Progress',
    'Done'
);

CREATE FUNCTION public.calculate_warranty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- При завершении работы устанавливаем гарантию
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.warranty_until = CURRENT_DATE + (NEW.warranty_months || ' months')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.check_expensive_parts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    avg_price DECIMAL(10,2);
    threshold DECIMAL(10,2);
BEGIN
    -- Если цена в USD указана, проверяем порог
    IF NEW.price_usd IS NOT NULL THEN
        SELECT AVG(price_usd) INTO avg_price FROM parts WHERE price_usd IS NOT NULL;
        threshold := avg_price * 3;
        
        IF NEW.price_usd > threshold THEN
            NEW.needs_approval := TRUE;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.check_stock_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_stock DECIMAL(10,3);
BEGIN
    -- Проверяем остаток при списании детали
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT quantity_in_stock INTO current_stock 
        FROM parts WHERE id = NEW.part_id;
        
        IF current_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Недостаточно деталей на складе. Доступно: %, требуется: %', 
                             current_stock, NEW.quantity;
        END IF;
        
        -- Обновляем остаток на складе
        UPDATE parts 
        SET quantity_in_stock = quantity_in_stock - NEW.quantity
        WHERE id = NEW.part_id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.check_work_overlap() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    -- Проверяем что у слесаря нет активных работ в это же время
    IF TG_OP = 'INSERT' AND NEW.end_time IS NULL THEN
        SELECT COUNT(*) INTO overlap_count
        FROM defect_work_log 
        WHERE worker_id = NEW.worker_id 
          AND end_time IS NULL 
          AND id != COALESCE(NEW.id, 0);
          
        IF overlap_count > 0 THEN
            RAISE EXCEPTION 'Слесарь уже выполняет другую работу';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TABLE public.cars (
    id integer NOT NULL,
    client_id integer,
    vin character varying(17),
    license_plate character varying(15),
    make character varying(50) NOT NULL,
    model character varying(50) NOT NULL,
    production_year integer,
    mileage integer NOT NULL,
    last_visit_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.cars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.cars_id_seq OWNED BY public.cars.id;

CREATE TABLE public.clients (
    id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    address character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;

CREATE TABLE public.defect_nodes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);

CREATE SEQUENCE public.defect_nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_nodes_id_seq OWNED BY public.defect_nodes.id;

CREATE TABLE public.defect_type_services (
    id integer NOT NULL,
    defect_type_id integer,
    service_id integer
);

CREATE SEQUENCE public.defect_type_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_type_services_id_seq OWNED BY public.defect_type_services.id;

CREATE TABLE public.defect_types (
    id integer NOT NULL,
    node_id integer,
    name character varying(100) NOT NULL,
    description text
);

CREATE SEQUENCE public.defect_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.defect_types_id_seq OWNED BY public.defect_types.id;

CREATE TABLE public.order_defects (
    id integer NOT NULL,
    order_id integer,
    diagnostician_id integer,
    defect_description character varying(255) NOT NULL,
    diagnostician_comment text,
    is_confirmed boolean DEFAULT false,
    defect_type_id integer
);

CREATE SEQUENCE public.order_defects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_defects_id_seq OWNED BY public.order_defects.id;

CREATE TABLE public.order_parts (
    id integer NOT NULL,
    order_id integer,
    warehouse_item_id integer,
    part_name_snapshot character varying(150),
    brand character varying(50),
    supplier character varying(100),
    quantity integer DEFAULT 1,
    price_per_unit numeric(10,2) NOT NULL,
    source_type public.part_source DEFAULT 'Stock'::public.part_source,
    is_issued boolean DEFAULT false,
    issued_by integer,
    issued_at timestamp without time zone,
    defect_id integer,
    is_confirmed boolean DEFAULT false
);

CREATE SEQUENCE public.order_parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_parts_id_seq OWNED BY public.order_parts.id;

CREATE TABLE public.order_works (
    id integer NOT NULL,
    order_id integer,
    service_id integer,
    service_name_snapshot character varying(150),
    price numeric(10,2) NOT NULL,
    norm_hours numeric(4,2),
    worker_id integer,
    status public.work_status DEFAULT 'Pending'::public.work_status,
    started_at timestamp without time zone,
    finished_at timestamp without time zone,
    is_confirmed boolean DEFAULT false
);

CREATE TABLE public.order_works_defects (
    id integer NOT NULL,
    work_id integer,
    defect_id integer
);

CREATE SEQUENCE public.order_works_defects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_works_defects_id_seq OWNED BY public.order_works_defects.id;

CREATE SEQUENCE public.order_works_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_works_id_seq OWNED BY public.order_works.id;

CREATE TABLE public.orders (
    id integer NOT NULL,
    client_id integer,
    car_id integer,
    master_id integer,
    status public.order_status DEFAULT 'New'::public.order_status,
    complaint text,
    current_mileage integer,
    prepayment numeric(10,2) DEFAULT 0.00,
    total_amount numeric(10,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    worker_id integer
);

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

CREATE TABLE public.services_reference (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    base_price numeric(10,2) DEFAULT 0.00,
    norm_hours numeric(4,2) DEFAULT 0.00
);

CREATE SEQUENCE public.services_reference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.services_reference_id_seq OWNED BY public.services_reference.id;

CREATE TABLE public.system_logs (
    id integer NOT NULL,
    user_id integer,
    event_type character varying(50),
    description text,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    role public.user_role NOT NULL,
    login character varying(50),
    password_hash character varying(255),
    pin_code character varying(4),
    status public.user_status DEFAULT 'Active'::public.user_status,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.warehouse (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    brand character varying(50),
    article character varying(50),
    location_cell character varying(20),
    quantity integer DEFAULT 0,
    min_quantity integer DEFAULT 2,
    purchase_price numeric(10,2),
    selling_price numeric(10,2)
);

CREATE SEQUENCE public.warehouse_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.warehouse_id_seq OWNED BY public.warehouse.id;

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

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_vin_key UNIQUE (vin);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.defect_nodes
    ADD CONSTRAINT defect_nodes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.defect_type_services
    ADD CONSTRAINT defect_type_services_defect_type_id_service_id_key UNIQUE (defect_type_id, service_id);

ALTER TABLE ONLY public.defect_type_services
    ADD CONSTRAINT defect_type_services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.defect_types
    ADD CONSTRAINT defect_types_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_defects
    ADD CONSTRAINT order_defects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_works_defects
    ADD CONSTRAINT order_works_defects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_works_defects
    ADD CONSTRAINT order_works_defects_work_id_defect_id_key UNIQUE (work_id, defect_id);

ALTER TABLE ONLY public.order_works
    ADD CONSTRAINT order_works_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.services_reference
    ADD CONSTRAINT services_reference_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_key UNIQUE (login);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.defect_type_services
    ADD CONSTRAINT defect_type_services_defect_type_id_fkey FOREIGN KEY (defect_type_id) REFERENCES public.defect_types(id);

ALTER TABLE ONLY public.defect_type_services
    ADD CONSTRAINT defect_type_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_reference(id);

ALTER TABLE ONLY public.defect_types
    ADD CONSTRAINT defect_types_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.defect_nodes(id);

ALTER TABLE ONLY public.order_defects
    ADD CONSTRAINT order_defects_defect_type_id_fkey FOREIGN KEY (defect_type_id) REFERENCES public.defect_types(id);

ALTER TABLE ONLY public.order_defects
    ADD CONSTRAINT order_defects_diagnostician_id_fkey FOREIGN KEY (diagnostician_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.order_defects
    ADD CONSTRAINT order_defects_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.order_defects(id);

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_parts
    ADD CONSTRAINT order_parts_warehouse_item_id_fkey FOREIGN KEY (warehouse_item_id) REFERENCES public.warehouse(id);

ALTER TABLE ONLY public.order_works_defects
    ADD CONSTRAINT order_works_defects_defect_id_fkey FOREIGN KEY (defect_id) REFERENCES public.order_defects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_works_defects
    ADD CONSTRAINT order_works_defects_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.order_works(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_works
    ADD CONSTRAINT order_works_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_works
    ADD CONSTRAINT order_works_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_reference(id);

ALTER TABLE ONLY public.order_works
    ADD CONSTRAINT order_works_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


