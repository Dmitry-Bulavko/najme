export type ServiceCategory =
  | 'cleaning'
  | 'babysitting'
  | 'technical'
  | 'massage'
  | 'repair'
  | 'other';

export type WorkFormat = 'ONSITE' | 'REMOTE' | 'BOTH';
export type ProfileStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MediaType = 'IMAGE' | 'VIDEO';

export interface Category {
  id: string;
  slug: string;
  nameI18n: Record<string, string>;
}

export interface PortfolioItem {
  id: string;
  url: string;
  type: MediaType;
  caption?: string;
}

export interface Certificate {
  id: string;
  title: string;
  url?: string;
}

export interface ContactInfo {
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  otherLinks: string[];
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  category: ServiceCategory;
  categoryId: string;
  city: string;
  cities: string[];
  description: string;
  experience?: string;
  rating?: number;
  reviewCount?: number;
  hourlyRate?: number;
  currency?: string;
  workFormat?: WorkFormat;
  verified?: boolean;
  status?: ProfileStatus;
  isPromoted?: boolean;
  portfolio?: PortfolioItem[];
  certificates?: Certificate[];
  contactInfo?: ContactInfo;
  createdAt: string;
}

export interface ProfilesResponse {
  data: Profile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProfileFilters {
  search?: string;
  category?: string;
  city?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'rating' | 'createdAt' | 'price' | 'promoted';
}
