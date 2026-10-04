import { supabase } from './supabase';
import type { PropertyMember, PropertyInvitation, UserRole, Property, UserProfile } from '@/types/database';

/**
 * Obtener todos los miembros con acceso a un apartamento específico
 */
export async function fetchPropertyMembers(propertyId: string): Promise<PropertyMember[]> {
  try {
    const { data: memberRows, error } = await supabase
      .from('property_members')
      .select('id, property_id, user_id, role, is_owner, created_at, updated_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });

    if (error || !memberRows) {
      console.warn('Error fetching property members:', error);
      return [];
    }

    if (memberRows.length === 0) {
      return [];
    }

    // Obtener perfiles de usuario si existen
    const userIds = memberRows.map((m) => m.user_id);
    let profileMap: Record<string, UserProfile> = {};

    try {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileRows) {
        profileMap = (profileRows as UserProfile[]).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, UserProfile>);
      }
    } catch (profileErr) {
      console.warn('Could not fetch member profiles:', profileErr);
    }

    return memberRows.map((m) => ({
      id: m.id,
      property_id: m.property_id,
      user_id: m.user_id,
      role: m.role as UserRole,
      is_owner: Boolean(m.is_owner || m.role === 'OWNER'),
      created_at: m.created_at,
      updated_at: m.updated_at,
      profile: profileMap[m.user_id] || null,
    }));
  } catch (err) {
    console.error('Failed to fetch property members:', err);
    return [];
  }
}

/**
 * Actualizar el rol de un miembro en el apartamento
 */
export async function updatePropertyMemberRole(
  propertyId: string,
  memberId: string,
  newRole: UserRole
): Promise<void> {
  const { error } = await supabase
    .from('property_members')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('property_id', propertyId);

  if (error) {
    console.error('Error updating member role:', error);
    throw error;
  }
}

/**
 * Actualizar si un miembro es Dueño / Copropietario del apartamento
 */
export async function updatePropertyMemberOwnership(
  propertyId: string,
  memberId: string,
  isOwner: boolean
): Promise<void> {
  const { error } = await supabase
    .from('property_members')
    .update({
      is_owner: isOwner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('property_id', propertyId);

  if (error) {
    console.error('Error updating member ownership flag:', error);
    throw error;
  }
}

/**
 * Eliminar a un miembro del apartamento
 */
export async function removePropertyMember(
  propertyId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from('property_members')
    .delete()
    .eq('id', memberId)
    .eq('property_id', propertyId);

  if (error) {
    console.error('Error removing member:', error);
    throw error;
  }
}

/**
 * Obtener las invitaciones pendientes para un apartamento
 */
export async function fetchPropertyInvitations(propertyId: string): Promise<PropertyInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('property_invitations')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error fetching property invitations:', error);
      return [];
    }

    return data as PropertyInvitation[];
  } catch (err) {
    console.error('Failed to fetch invitations:', err);
    return [];
  }
}

/**
 * Crear una nueva invitación para un usuario por correo
 */
export async function createPropertyInvitation(
  propertyId: string,
  email: string,
  role: UserRole,
  isOwner: boolean = false
): Promise<PropertyInvitation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Generar token seguro hexadecimal aleatorio de 48 caracteres
  const tokenBytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(tokenBytes);
  } else {
    for (let i = 0; i < 24; i++) tokenBytes[i] = Math.floor(Math.random() * 256);
  }
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('property_invitations')
    .insert({
      property_id: propertyId,
      email: email.trim().toLowerCase(),
      role,
      is_owner: isOwner,
      invited_by: user?.id || null,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating property invitation:', error);
    const message = error?.message || 'No se pudo crear la invitación';
    throw new Error(message);
  }

  return data as PropertyInvitation;
}

/**
 * Cancelar/Revocar una invitación
 */
export async function cancelPropertyInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('property_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) {
    console.error('Error canceling invitation:', error);
    throw error;
  }
}

export interface InvitationDetails {
  invitation: PropertyInvitation;
  property: Property | null;
  isExpired: boolean;
}

/**
 * Obtener detalles públicos de una invitación a través de su token
 */
export async function fetchInvitationByToken(token: string): Promise<InvitationDetails | null> {
  try {
    const { data: invData, error: invError } = await supabase
      .from('property_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (invError || !invData) {
      return null;
    }

    const invitation = invData as PropertyInvitation;
    const isExpired = new Date(invitation.expires_at).getTime() < Date.now();

    // Obtener datos del apartamento
    let property: Property | null = null;
    try {
      const { data: propData } = await supabase
        .from('properties')
        .select('*')
        .eq('id', invitation.property_id)
        .maybeSingle();

      if (propData) {
        property = propData as Property;
      }
    } catch (propErr) {
      console.warn('Could not fetch property for invitation:', propErr);
    }

    return {
      invitation,
      property,
      isExpired,
    };
  } catch (err) {
    console.error('Failed to fetch invitation by token:', err);
    return null;
  }
}

/**
 * Aceptar una invitación utilizando la función RPC de Supabase
 */
export async function acceptPropertyInvitation(
  token: string
): Promise<{ success: boolean; property_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('accept_property_invitation', {
      invitation_token: token,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as { success: boolean; property_id?: string; error?: string };
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar la invitación';
    return { success: false, error: message };
  }
}
