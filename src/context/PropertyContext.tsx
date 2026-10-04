/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchUserProperties,
  fetchPropertyById,
  createNewProperty,
  updatePropertyById,
  type UserPropertyMembership,
} from '@/lib/property-service';
import type { Property, UserRole } from '@/types/database';

interface PropertyContextType {
  properties: UserPropertyMembership[];
  activeProperty: Property | null;
  activePropertyId: string;
  role: UserRole;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isCleaner: boolean;
  isViewer: boolean;
  isLoading: boolean;
  createProperty: (data: Parameters<typeof createNewProperty>[0]) => Promise<Property>;
  updateProperty: (updates: Partial<Property>) => Promise<Property>;
  switchProperty: (newPropertyId: string) => void;
  refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { propertyId: urlPropertyId } = useParams<{ propertyId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const routePropertyId = location.pathname.match(/^\/p\/([^/]+)/)?.[1];
  const currentPropertyId = routePropertyId || urlPropertyId;

  const [properties, setProperties] = useState<UserPropertyMembership[]>([]);
  const [directFetchedProperty, setDirectFetchedProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derivar la propiedad activa directamente del estado y la URL
  const activeProperty = useMemo(() => {
    if (currentPropertyId) {
      const match = properties.find((m) => m.property.id === currentPropertyId);
      if (match) return match.property;
      if (directFetchedProperty?.id === currentPropertyId) return directFetchedProperty;
    }
    const storedId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_property_id') : null;
    if (storedId) {
      const match = properties.find((m) => m.property.id === storedId);
      if (match) return match.property;
    }
    return properties[0]?.property || null;
  }, [properties, currentPropertyId, directFetchedProperty]);

  const activePropertyId = activeProperty?.id || currentPropertyId || (properties[0]?.property.id ?? '');

  // Sincronizar propiedades desde Supabase
  const loadProperties = useCallback(async () => {
    try {
      const list = await fetchUserProperties();
      setProperties(list);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const list = await fetchUserProperties();
        if (ignore) return;
        setProperties(list);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  // Si se accede directamente a una propiedad por URL que no esté en properties, buscarla
  useEffect(() => {
    if (!currentPropertyId) return;
    localStorage.setItem('active_property_id', currentPropertyId);

    const exists = properties.some((p) => p.property.id === currentPropertyId);
    if (exists) return;

    let ignore = false;
    fetchPropertyById(currentPropertyId).then((prop) => {
      if (!ignore && prop) {
        setDirectFetchedProperty(prop);
      }
    });

    return () => {
      ignore = true;
    };
  }, [currentPropertyId, properties]);

  const activeMembership = useMemo(() => {
    if (activePropertyId) {
      return properties.find((m) => m.property.id === activePropertyId);
    }
    return properties[0] || null;
  }, [properties, activePropertyId]);

  // Determinar si es Dueño Principal de la propiedad
  const isPrimaryOwner = Boolean(
    activeMembership?.role === 'PRIMARY_OWNER' ||
    (activeProperty?.primary_owner_id && user?.id && activeProperty.primary_owner_id === user.id) ||
    (!activeProperty?.primary_owner_id && activeProperty?.created_by && user?.id && activeProperty.created_by === user.id)
  );

  // Determinar rol efectivo del usuario en la propiedad activa
  const role: UserRole = useMemo(() => {
    const userRole = (user as { role?: UserRole } | null)?.role || (user?.user_metadata?.role as UserRole | undefined);
    if (userRole === 'SUPER_USER') {
      return 'SUPER_USER';
    }
    if (isPrimaryOwner) {
      return 'PRIMARY_OWNER';
    }
    if (activeMembership) {
      return activeMembership.role;
    }
    return 'VIEWER';
  }, [activeMembership, isPrimaryOwner, user]);

  const isOwner = Boolean(
    isPrimaryOwner ||
    role === 'OWNER' ||
    role === 'PRIMARY_OWNER'
  );
  const isAdmin = Boolean(isOwner || role === 'ADMINISTRATOR');
  const isOperator = Boolean(isAdmin || role === 'OPERATOR');
  const isCleaner = Boolean(role === 'CLEANER');
  const isViewer = Boolean(role === 'VIEWER');

  // Cambiar de propiedad en la interfaz
  const switchProperty = useCallback(
    (newPropertyId: string) => {
      localStorage.setItem('active_property_id', newPropertyId);

      // Reemplazar :propertyId en la ruta actual si está bajo /p/:propertyId/...
      const pathname = location.pathname;
      if (pathname.startsWith('/p/')) {
        const parts = pathname.split('/');
        // parts = ['', 'p', ':propertyId', 'dashboard', ...]
        parts[2] = newPropertyId;
        navigate(parts.join('/'));
      } else {
        navigate(`/p/${newPropertyId}/dashboard`);
      }
    },
    [location.pathname, navigate]
  );

  // Crear una nueva propiedad
  const createProperty = useCallback(
    async (data: Parameters<typeof createNewProperty>[0]) => {
      const newProp = await createNewProperty(data);
      setDirectFetchedProperty(newProp);
      localStorage.setItem('active_property_id', newProp.id);
      await loadProperties();
      navigate(`/p/${newProp.id}/dashboard`);
      return newProp;
    },
    [loadProperties, navigate]
  );

  // Actualizar la propiedad activa
  const updateProperty = useCallback(
    async (updates: Partial<Property>) => {
      if (!activePropertyId) throw new Error('No active property selected');
      const updated = await updatePropertyById(activePropertyId, updates);
      setDirectFetchedProperty(updated);
      setProperties((prev) =>
        prev.map((item) =>
          item.property.id === updated.id ? { ...item, property: updated } : item
        )
      );
      return updated;
    },
    [activePropertyId]
  );

  return (
    <PropertyContext.Provider
      value={{
        properties,
        activeProperty,
        activePropertyId,
        role,
        isOwner,
        isPrimaryOwner,
        isAdmin,
        isOperator,
        isCleaner,
        isViewer,
        isLoading,
        createProperty,
        updateProperty,
        switchProperty,
        refreshProperties: loadProperties,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function usePropertyContext() {
  return useContext(PropertyContext);
}

export function useActiveProperty() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useActiveProperty must be used within a PropertyProvider');
  }
  return context;
}
