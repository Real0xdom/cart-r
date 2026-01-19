"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategoryLabel = getCategoryLabel;
exports.createSupportTicket = createSupportTicket;
exports.getUserTickets = getUserTickets;
exports.getTicketDetails = getTicketDetails;
exports.addTicketMessage = addTicketMessage;
exports.subscribeToTicket = subscribeToTicket;
exports.closeTicket = closeTicket;
// Support Ticket System
const supabase_1 = require("./supabase");
const CATEGORY_LABELS = {
    booking_issue: '📦 Booking Issue',
    payment_issue: '💳 Payment Issue',
    driver_complaint: '🚗 Driver Complaint',
    safety_concern: '🚨 Safety Concern',
    app_bug: '🐛 App Bug',
    account_issue: '👤 Account Issue',
    feedback: '💡 Feedback',
    other: '❓ Other',
};
function getCategoryLabel(category) {
    return CATEGORY_LABELS[category] || category;
}
/**
 * Create a new support ticket
 */
async function createSupportTicket(category, subject, description, bookingId) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: null, error: 'User not authenticated' };
        }
        // Determine priority based on category
        let priority = 'medium';
        if (category === 'safety_concern') {
            priority = 'urgent';
        }
        else if (category === 'payment_issue') {
            priority = 'high';
        }
        else if (category === 'feedback') {
            priority = 'low';
        }
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { data: null, error: err.message };
    }
}
/**
 * Get user's support tickets
 */
async function getUserTickets() {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: [], error: 'User not authenticated' };
        }
        const { data, error } = await supabase_1.supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) {
            return { data: [], error: error.message };
        }
        return { data: data || [], error: null };
    }
    catch (err) {
        return { data: [], error: err.message };
    }
}
/**
 * Get a single ticket with messages
 */
async function getTicketDetails(ticketId) {
    try {
        const { data: ticket, error: ticketError } = await supabase_1.supabase
            .from('support_tickets')
            .select('*')
            .eq('id', ticketId)
            .single();
        if (ticketError) {
            return { ticket: null, messages: [], error: ticketError.message };
        }
        const { data: messages, error: messagesError } = await supabase_1.supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        if (messagesError) {
            return { ticket, messages: [], error: messagesError.message };
        }
        return { ticket, messages: messages || [], error: null };
    }
    catch (err) {
        return { ticket: null, messages: [], error: err.message };
    }
}
/**
 * Add a message to a ticket
 */
async function addTicketMessage(ticketId, message, attachmentUrl) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: null, error: 'User not authenticated' };
        }
        const { data, error } = await supabase_1.supabase
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
        await supabase_1.supabase
            .from('support_tickets')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', ticketId);
        return { data, error: null };
    }
    catch (err) {
        return { data: null, error: err.message };
    }
}
/**
 * Subscribe to ticket updates
 */
function subscribeToTicket(ticketId, onNewMessage, onStatusChange) {
    // Subscribe to new messages
    const messagesChannel = supabase_1.supabase
        .channel(`ticket-messages-${ticketId}`)
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`,
    }, (payload) => {
        onNewMessage(payload.new);
    })
        .subscribe();
    // Subscribe to ticket status changes
    const ticketChannel = supabase_1.supabase
        .channel(`ticket-status-${ticketId}`)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `id=eq.${ticketId}`,
    }, (payload) => {
        if (payload.new.status !== payload.old.status) {
            onStatusChange(payload.new.status);
        }
    })
        .subscribe();
    return () => {
        messagesChannel.unsubscribe();
        ticketChannel.unsubscribe();
    };
}
/**
 * Close a ticket (user marking as resolved)
 */
async function closeTicket(ticketId) {
    try {
        const { error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
