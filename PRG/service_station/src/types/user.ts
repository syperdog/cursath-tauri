export interface User {
  id: number;
  full_name: string;
  role: string;
  login: string | null;
  password_hash: string | null;
  pin_code: string | null;
  status: string;
}