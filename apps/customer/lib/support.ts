// Support Ticket System
import { supabase } from './supabase';

export type TicketCategory = 
  | 'booking_issue'
  | 'payment_issue'
  | 'driver_complaint'
  | 'safety_concern'
  | 'app_bug'
  | 'account_issue'
  | 'feedback'
  | 'other';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  user_id: string;
  booking_id: string | null;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: 'user' | 'support';
  message: string;
  attachment_url: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  booking_issue: '📦 Booking Issue',
  payment_issue: '💳 Payment Issue',
  driver_complaint: '🚗 Driver Complaint',
  safety_concern: '🚨 Safety Concern',
  app_bug: '🐛 App Bug',
  account_issue: '👤 Account Issue',
  feedback: '💡 Feedback',
  other: '❓ Other',
};

export function getCategoryLabel(category: TicketCategory): string {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Create a new support ticket
 */
export async function createSupportTicket(
  category: TicketCategory,
  subject: string,
  description: string,
  bookingId?: string
): Promise<{ data: SupportTicket | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Determine priority based on category
    let priority: TicketPriority = 'medium';
    if (category === 'safety_concern') {
      priority = 'urgent';
    } else if (category === 'payment_issue') {
      priority = 'high';
    } else if (category === 'feedback') {
      priority = 'low';
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        booking_id: bookingId || null,
        category,
        subject,
        description,
        status: 'open',
        priority,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get user's support tickets
 */
export async function getUserTickets(): Promise<{ data: SupportTicket[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Get a single ticket with messages
 */
export async function getTicketDetails(
  ticketId: string
): Promise<{ ticket: SupportTicket | null; messages: TicketMessage[]; error: string | null }> {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      return { ticket: null, messages: [], error: ticketError.message };
    }

    const { data: messages, error: messagesError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return { ticket, messages: [], error: messagesError.message };
    }

    return { ticket, messages: messages || [], error: null };
  } catch (err: any) {
    return { ticket: null, messages: [], error: err.message };
  }
}

/**
 * Add a message to a ticket
 */
export async function addTicketMessage(
  ticketId: string,
  message: string,
  attachmentUrl?: string
): Promise<{ data: TicketMessage | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: 'user',
        message,
        attachment_url: attachmentUrl || null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Update ticket updated_at
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Subscribe to ticket updates
 */
export function subscribeToTicket(
  ticketId: string,
  onNewMessage: (message: TicketMessage) => void,
  onStatusChange: (status: TicketStatus) => void
): () => void {
  // Subscribe to new messages
  const messagesChannel = supabase
    .channel(`ticket-messages-${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload: any) => {
        onNewMessage(payload.new);
      }
    )
    .subscribe();

  // Subscribe to ticket status changes
  const ticketChannel = supabase
    .channel(`ticket-status-${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `id=eq.${ticketId}`,
      },
      (payload: any) => {
        if (payload.new.status !== payload.old.status) {
          onStatusChange(payload.new.status);
        }
      }
    )
    .subscribe();

  return () => {
    messagesChannel.unsubscribe();
    ticketChannel.unsubscribe();
  };
}

/**
 * Close a ticket (user marking as resolved)
 */
export async function closeTicket(ticketId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: 'closed',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
