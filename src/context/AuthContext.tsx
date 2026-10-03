import React, { useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext } from './auth-context-def';
import type { UserRole, UserProfile } from '@/types/database';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (currentUser: User): Promise<UserProfile> => {
    const metadataRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role) as UserRole | undefined;

    try {
      if (typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!error && data) {
          return data as UserProfile;
        }
      }
    } catch (err) {
      console.warn('Could not fetch user profile from profiles table, using fallback:', err);
    }

    return {
      id: currentUser.id,
      role: metadataRole || 'VIEWER',
      full_name: currentUser.user_metadata?.full_name || null,
      phone: currentUser.user_metadata?.phone || null,
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const prof = await fetchUserProfile(user);
      setProfile(prof);
    }
  }, [user, fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;

    // Obtener sesión inicial
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const prof = await fetchUserProfile(currentUser);
          if (isMounted) setProfile(prof);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    // Escuchar cambios de sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const prof = await fetchUserProfile(currentUser);
        if (isMounted) setProfile(prof);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName?.trim() || null,
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
    return { error };
  };

  const role: UserRole | null =
    profile?.role ??
    ((user?.user_metadata?.role || user?.app_metadata?.role) as UserRole) ??
    (user ? 'VIEWER' : null);

  const isSuperUser = role === 'SUPER_USER';
  const isAdmin = role === 'ADMINISTRATOR' || isSuperUser;
  const isOwner = role === 'OWNER';
  const isCleaner = role === 'CLEANER';
  const isViewer = role === 'VIEWER';

  const hasRole = (allowed: UserRole | UserRole[]): boolean => {
    if (!role) return false;
    if (role === 'SUPER_USER') return true;
    const list = Array.isArray(allowed) ? allowed : [allowed];
    return list.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        isSuperUser,
        isAdmin,
        isOwner,
        isCleaner,
        isViewer,
        hasRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
