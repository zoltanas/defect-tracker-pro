export type DefectStatus = 'Open' | 'In Progress' | 'Waiting for Feedback' | 'Resolved' | 'Closed';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface DefectAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  file?: File; // For local preview before upload
}

export interface Defect {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: DefectStatus;
  x?: number; // Relative X coordinate on the drawing (0-1)
  y?: number; // Relative Y coordinate on the drawing (0-1)
  drawingId?: string;
  createdAt: string;
  createdBy: string;
  assignee: string;
  attachments: DefectAttachment[];
}

export interface Drawing {
  id: string;
  projectId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  file?: File; // For local preview before upload
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  accessToken: string;
}
