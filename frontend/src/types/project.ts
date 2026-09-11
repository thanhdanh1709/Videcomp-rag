export interface ProjectFolder {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color?: string;
  createdAt: string;
  isShared?: boolean;
  isPublic?: boolean;
  shareToken?: string;
  sharedWith?: any[];
  owner?: string;
}

