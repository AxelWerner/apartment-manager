import { createContext } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { UserRole, UserProfile } from '@/types/database';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile?: UserProfile | null;
  role?: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  isSuperUser?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  isCleaner?: boolean;
  isViewer?: boolean;
  hasRole?: (allowed: UserRole | UserRole[]) => boolean;
  refreshProfile?: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
