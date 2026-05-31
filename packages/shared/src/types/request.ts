export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DONE';

export interface ServiceRequest {
  id: string;
  clientId: string;
  clientName: string;
  profileId: string;
  profileTitle: string;
  message: string;
  status: RequestStatus;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestDto {
  profileId: string;
  message: string;
  scheduledAt?: string;
}
