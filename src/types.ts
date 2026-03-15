export type DefectStatus = 'Open' | 'Waiting for feedback' | 'Closed';

export type Role = 'Admin' | 'Lidl Project Manager' | 'General Contractor' | 'Consultant';

export interface ProjectMember {
  email: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  folderId?: string;
  members?: ProjectMember[];
}

export interface DefectAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  file?: File; // For local preview before upload
  annotations?: string; // JSON string of Konva shapes
}

export interface DefectReply {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  createdByEmail: string;
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
  folderId?: string;
  replies?: DefectReply[];
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
