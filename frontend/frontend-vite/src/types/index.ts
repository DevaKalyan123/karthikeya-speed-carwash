export interface User {
  id: number;
  name: string;
  mobile: string;
  role: "admin" | "customer";
}

export interface Service {
  id: number;
  service_name: string;
  description: string | null;
}