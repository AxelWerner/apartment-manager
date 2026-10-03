import { supabase } from './supabase';
import type { Property, UserRole } from '@/types/database';

export interface UserPropertyMembership {
  property: Property;
  role: UserRole;
}

/**
 * Obtener todos los apartamentos a los que tiene acceso el usuario actual
 */
export async function fetchUserProperties(): Promise<UserPropertyMembership[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Fallback para modo offline o desarrollo sin sesión
      const { data: fallbackProp } = await supabase
        .from('properties')
        .select('*')
        .limit(1);

      if (fallbackProp && fallbackProp.length > 0) {
        return [
          {
            property: fallbackProp[0] as Property,
            role: 'OWNER',
          },
        ];
      }
      return [];
    }

    const { data, error } = await supabase
      .from('property_members')
      .select('role, properties (*)')
      .eq('user_id', user.id);

    if (error || !data) {
      console.warn('Error fetching property memberships:', error);
      return [];
    }

    return data
      .filter((row: any) => row.properties)
      .map((row: any) => ({
        property: row.properties as Property,
        role: row.role as UserRole,
      }));
  } catch (err) {
    console.error('Failed to fetch user properties:', err);
    return [];
  }
}

/**
 * Obtener un apartamento específico por su ID
 */
export async function fetchPropertyById(propertyId: string): Promise<Property | null> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (!error && data) {
      return data as Property;
    }
  } catch (err) {
    console.warn('Could not fetch property by ID:', err);
  }
  return null;
}

/**
 * Crear un nuevo apartamento.
 * El trigger de Supabase `on_property_created` asigna automáticamente al creador como OWNER.
 */
export async function createNewProperty(propertyData: {
  name: string;
  address?: string;
  city?: string;
  currency?: string;
  default_nightly_rate?: number;
  default_cleaning_fee?: number;
  monthly_revenue_target?: number;
  management_fee_rate?: number;
  check_in_time?: string;
  check_out_time?: string;
}): Promise<Property> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('properties')
    .insert({
      name: propertyData.name.trim(),
      address: propertyData.address?.trim() || null,
      city: propertyData.city?.trim() || 'Medellín',
      currency: propertyData.currency || 'COP',
      default_nightly_rate: propertyData.default_nightly_rate ?? 250000,
      default_cleaning_fee: propertyData.default_cleaning_fee ?? 80000,
      monthly_revenue_target: propertyData.monthly_revenue_target ?? 3000000,
      management_fee_rate: propertyData.management_fee_rate ?? 20.0,
      check_in_time: propertyData.check_in_time || '15:00',
      check_out_time: propertyData.check_out_time || '11:00',
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating property:', error);
    throw error;
  }

  return data as Property;
}

/**
 * Actualizar datos de un apartamento
 */
export async function updatePropertyById(
  propertyId: string,
  updates: Partial<Property>
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating property:', error);
    throw error;
  }

  return data as Property;
}
