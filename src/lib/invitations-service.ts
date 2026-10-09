import { supabase } from './supabase';
import type {
  PropertyMember,
  PropertyInvitation,
  UserPendingInvitation,
  UserRole,
  Property,
  UserProfile,
} from '@/types/database';

/**
 * Obtener todos los miembros con acceso a un apartamento específico
 */
export async function fetchPropertyMembers(propertyId: string): Promise<PropertyMember[]> {
  try {
    const { data: memberRows, error } = await supabase
      .from('property_members')
      .select('id, property_id, user_id, role, created_at, updated_at')
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

    // Obtener id del dueño principal de la propiedad
    let primaryOwnerId: string | null = null;
    try {
      const { data: propRow } = await supabase
        .from('properties')
        .select('primary_owner_id, created_by')
        .eq('id', propertyId)
        .single();
      if (propRow) {
        primaryOwnerId = propRow.primary_owner_id || propRow.created_by || null;
      }
    } catch {
      // Ignorar fallback
    }

    return memberRows.map((m) => {
      const isPrimaryOwner = Boolean(
        m.role === 'PRIMARY_OWNER' ||
        (primaryOwnerId && m.user_id === primaryOwnerId)
      );
      return {
        id: m.id,
        property_id: m.property_id,
        user_id: m.user_id,
        role: (isPrimaryOwner ? 'PRIMARY_OWNER' : m.role) as UserRole,
        is_primary_owner: isPrimaryOwner,
        created_at: m.created_at,
        updated_at: m.updated_at,
        profile: profileMap[m.user_id] || null,
      };
    });
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
 * Transferir la titularidad de Dueño Principal a otro miembro del apartamento
 */
export async function transferPrimaryOwnership(
  propertyId: string,
  newOwnerUserId: string
): Promise<void> {
  const { data, error } = await supabase.rpc('transfer_primary_ownership', {
    p_property_id: propertyId,
    p_new_primary_owner_id: newOwnerUserId,
  });

  if (error) {
    console.error('Error transferring primary ownership:', error);
    throw error;
  }

  const result = data as { success?: boolean; error?: string };
  if (!result || !result.success) {
    throw new Error(result?.error || 'No se pudo transferir la titularidad de Dueño Principal');
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
  role: UserRole
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
    // Intentar primero con 'p_token' (nombre del parámetro en la función RPC de Supabase)
    let { data, error } = await supabase.rpc('accept_property_invitation', {
      p_token: token,
    });

    // Fallback con 'invitation_token' por compatibilidad
    if (error && (error.message?.includes('schema cache') || error.code === 'PGRST202')) {
      const retry = await supabase.rpc('accept_property_invitation', {
        invitation_token: token,
      });
      data = retry.data;
      error = retry.error;
    }

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

/**
 * Obtener las invitaciones pendientes dirigidas al usuario autenticado actual
 */
export async function fetchUserPendingInvitations(): Promise<UserPendingInvitation[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return [];
    }

    // Intentar primero con la función RPC optimizada
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_pending_invitations');

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData as UserPendingInvitation[];
    }

    // Fallback: consulta directa a property_invitations con join de properties
    const { data, error } = await supabase
      .from('property_invitations')
      .select('*, property:properties(id, name, city, address)')
      .ilike('email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching pending invitations directly:', error);
      return [];
    }

    interface RawInvitationRow {
      id: string;
      property_id: string;
      email: string;
      role: UserRole;
      invited_by: string | null;
      token: string;
      status: PropertyInvitation['status'];
      expires_at: string;
      created_at?: string;
      updated_at?: string;
      property?: {
        name?: string | null;
        city?: string | null;
        address?: string | null;
      } | null;
    }

    return ((data as unknown as RawInvitationRow[]) || []).map((row) => ({
      id: row.id,
      property_id: row.property_id,
      email: row.email,
      role: row.role,
      invited_by: row.invited_by,
      token: row.token,
      status: row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      property_name: row.property?.name ?? null,
      property_city: row.property?.city ?? null,
      property_address: row.property?.address ?? null,
    }));
  } catch (err) {
    console.error('Failed to fetch user pending invitations:', err);
    return [];
  }
}

/**
 * Rechazar una invitación por token
 */
export async function declinePropertyInvitation(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('decline_property_invitation', {
      p_token: token,
    });

    const rpcResult = data as { success?: boolean } | null;
    if (!error && rpcResult?.success) {
      return { success: true };
    }

    // Si el RPC falló con un error de negocio o permisos (no por ausencia de la función), reportarlo
    const isRpcMissing =
      error &&
      (error.code === 'PGRST202' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('Could not find the function'));

    if (error && !isRpcMissing) {
      console.warn('decline_property_invitation RPC returned error:', error);
      return { success: false, error: error.message };
    }

    // Fallback directo: actualizar estado si RPC no estaba configurada aún
    const { data: updatedRows, error: updateError } = await supabase
      .from('property_invitations')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('token', token)
      .eq('status', 'pending')
      .select('id');

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error: isRpcMissing
          ? 'No se pudo rechazar la invitación o ya no está pendiente.'
          : error?.message || 'No se pudo rechazar la invitación o ya no está pendiente.',
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al rechazar la invitación';
    return { success: false, error: message };
  }
}
