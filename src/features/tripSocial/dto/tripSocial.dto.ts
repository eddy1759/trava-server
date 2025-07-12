export interface CreateCommentData {
    tripId: string;
    userId: string;
    content: string;
  }
  
  export interface UpdateCommentData {
    content?: string;
  }
  