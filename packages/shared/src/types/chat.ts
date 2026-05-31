export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  clientId: string;
  profileId: string;
  profileTitle: string;
  profileAvatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
}

export interface SendMessageDto {
  conversationId: string;
  text: string;
}
