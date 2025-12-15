export interface OrderWork {
  id: number;
  order_id: number;
  service_id?: number;
  service_name_snapshot: string;
  price: number;
  worker_id?: number | null;
  status: string;
  is_confirmed: boolean;
  defect_id?: number | null;
}