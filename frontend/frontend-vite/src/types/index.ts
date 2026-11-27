export interface User {
  id: number;
  name: string;
  mobile: string;
  role: "admin" | "customer" | "management";
}

export interface Service {
  id: number;
  service_name: string;
  description: string | null;
  price: string | null;
  is_active: boolean;
}