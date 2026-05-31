export interface Review {
  id: string;
  profileId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface ReviewsResponse {
  data: Review[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateReviewRequest {
  profileId: string;
  rating: number;
  comment?: string;
}
