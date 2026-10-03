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
import { DEFAULT_PROPERTY_ID } from '@/lib/supabase';

interface PropertyContextType {
  properties: UserPropertyMembership[];
  activeProperty: Property | null;
  activePropertyId: string;
  role: UserRole;
  isOwner: boolean;
  isAdmin: boolean;
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

  const [properties, setProperties] = useState<UserPropertyMembership[]>([]);
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar lista de propiedades del usuario
  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await fetchUserProperties();
      setProperties(list);

      // Determinar la propiedad activa
      const targetId =
        urlPropertyId ||
        list[0]?.property.id ||
        localStorage.getItem('active_property_id') ||
        DEFAULT_PROPERTY_ID;

      const found = list.find((m) => m.property.id === targetId)?.property;
      if (found) {
        setActiveProperty(found);
      } else if (targetId) {
        // Puede ser una propiedad a la que accede directamente por ID
        const fetched = await fetchPropertyById(targetId);
        if (fetched) {
          setActiveProperty(fetched);
        } else if (list.length > 0) {
          setActiveProperty(list[0].property);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [urlPropertyId]);

  useEffect(() => {
    loadProperties();
  }, [user?.id, urlPropertyId, loadProperties]);

  // Si cambia la URL con :propertyId, sincronizar activeProperty
  useEffect(() => {
    if (!urlPropertyId) return;
    const match = properties.find((p) => p.property.id === urlPropertyId);
    if (match) {
      setActiveProperty(match.property);
      localStorage.setItem('active_property_id', urlPropertyId);
    } else {
      fetchPropertyById(urlPropertyId).then((prop) => {
        if (prop) {
          setActiveProperty(prop);
          localStorage.setItem('active_property_id', urlPropertyId);
        }
      });
    }
  }, [urlPropertyId, properties]);

  const activePropertyId = activeProperty?.id || urlPropertyId || DEFAULT_PROPERTY_ID;

  // Determinar rol del usuario en la propiedad activa
  const role: UserRole = useMemo(() => {
    if (!activePropertyId) return 'VIEWER';
    const membership = properties.find((m) => m.property.id === activePropertyId);
    return membership?.role || 'OWNER'; // Si es el creador o desarrollo, fallback a OWNER
  }, [properties, activePropertyId]);

  const isOwner = role === 'OWNER' || role === 'SUPER_USER';
  const isAdmin = isOwner || role === 'ADMINISTRATOR';
  const isCleaner = role === 'CLEANER';
  const isViewer = role === 'VIEWER';

  // Cambiar de propiedad en la interfaz
  const switchProperty = useCallback(
    (newPropertyId: string) => {
      localStorage.setItem('active_property_id', newPropertyId);
      const targetMatch = properties.find((m) => m.property.id === newPropertyId);
      if (targetMatch) {
        setActiveProperty(targetMatch.property);
      }

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
    [properties, location.pathname, navigate]
  );

  // Crear una nueva propiedad
  const createProperty = useCallback(
    async (data: Parameters<typeof createNewProperty>[0]) => {
      const newProp = await createNewProperty(data);
      await loadProperties();
      switchProperty(newProp.id);
      return newProp;
    },
    [loadProperties, switchProperty]
  );

  // Actualizar la propiedad activa
  const updateProperty = useCallback(
    async (updates: Partial<Property>) => {
      if (!activePropertyId) throw new Error('No active property selected');
      const updated = await updatePropertyById(activePropertyId, updates);
      setActiveProperty(updated);
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
        isAdmin,
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

export function useActiveProperty() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useActiveProperty must be used within a PropertyProvider');
  }
  return context;
}
