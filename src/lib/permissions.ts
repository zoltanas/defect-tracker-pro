import { Project, Defect, Role } from '../types';

export function getUserRole(project: Project, userEmail: string): Role | null {
  if (userEmail === 'lukas.eiduk@gmail.com') {
    return 'Admin';
  }
  if (project.createdBy === userEmail) {
    return 'Admin'; // Creator is always admin
  }
  const member = project.members?.find(m => m.email === userEmail);
  return member ? member.role : null;
}

export function canCreateDefect(role: Role | null): boolean {
  return role === 'Admin' || role === 'Lidl Project Manager' || role === 'Consultant';
}

export function canEditDefect(role: Role | null, defect: Defect, userEmail: string): boolean {
  if (role === 'Admin') return true;
  if (role === 'Consultant') {
    return defect.createdBy === userEmail; // Can only edit own defects
  }
  return false;
}

export function canDeleteDefect(role: Role | null, defect: Defect, userEmail: string): boolean {
  if (role === 'Admin') return true;
  return false;
}

export function canChangeDefectStatus(role: Role | null, newStatus: string, defect?: Defect, userEmail?: string): boolean {
  if (role === 'Admin') return true;
  if (role === 'Lidl Project Manager') {
    return newStatus === 'Closed'; // Can change status to closed
  }
  if (role === 'Consultant') {
    if (!defect) return true; // Can create with any status
    if (defect && userEmail && defect.createdBy === userEmail) {
      return true; // Can edit own defects fully
    }
    return false;
  }
  if (role === 'General Contractor') {
    return newStatus === 'Waiting for feedback';
  }
  return false;
}

export function canCreateProject(role: Role | null): boolean {
  return role === 'Admin';
}

export function canManagePermissions(role: Role | null): boolean {
  return role === 'Admin' || role === 'Lidl Project Manager'; // Lidl PM can do everything admin does inside project
}

export function canReplyToDefect(role: Role | null): boolean {
  return role !== null; // Anyone with a role can reply
}

export function canEditReply(role: Role | null, replyCreatedByEmail: string, userEmail: string): boolean {
  if (role === 'Admin') return true;
  return replyCreatedByEmail === userEmail;
}
