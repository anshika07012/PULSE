export type Role = "patient" | "doctor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  department?: string;
  licenseId?: string;
}

export interface Department {
  name: string;
  capacity: number;
  consultMinutes: number;
}

export interface Doctor {
  name: string;
  department: string;
}

export interface Meta {
  departments: Department[];
  doctors: Doctor[];
}

export type TokenStatus = "waiting" | "in-consultation" | "completed" | "cancelled";

export interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  department: string;
  doctor: string;
  reason?: string;
  priority: "normal" | "urgent";
  status: TokenStatus;
  consultMinutes: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  position?: number;
  estimatedWaitMin?: number;
  mine?: boolean;
}

export interface QueueResponse {
  tokens: Token[];
  stats: { waiting: number; inConsultation: number; completedToday: number; avgWaitMin: number };
  called?: Token | null;
  message?: string;
}

export interface Medicine {
  _id: string;
  name: string;
  genericName?: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  expiry?: string;
  status: "in" | "low" | "out";
}

export interface PharmacyResponse {
  items: Medicine[];
  summary: { total: number; low: number; out: number };
}

export interface Bed {
  _id: string;
  ward: string;
  wardType: string;
  floor: number;
  label: string;
  status: "available" | "occupied" | "cleaning";
  patientName?: string;
  since?: string;
}

export interface WardSummary {
  ward: string;
  floor: number;
  type: string;
  total: number;
  occupied: number;
  available: number;
  cleaning: number;
  occupancy: number;
}

export interface BedsResponse {
  beds: Bed[];
  summary: {
    total: number;
    occupied: number;
    available: number;
    cleaning: number;
    occupancy: number;
    byWard: WardSummary[];
  };
  message?: string;
}

export interface AnalyticsResponse {
  hourly: { label: string; avgWait: number; isNow: boolean; forecast: boolean }[];
  departments: { name: string; active: number; capacity: number; congestion: number; trend: number[] }[];
  kpis: { avgWait: number; peakHour: string; busiest: string };
}

export type Notify = (message: string, tone?: "ok" | "error") => void;
