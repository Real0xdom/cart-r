export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      addon_services: {
        Row: {
          applicable_vehicle_types:
            | Database["public"]["Enums"]["vehicle_type"][]
            | null
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          applicable_vehicle_types?:
            | Database["public"]["Enums"]["vehicle_type"][]
            | null
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          applicable_vehicle_types?:
            | Database["public"]["Enums"]["vehicle_type"][]
            | null
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      admin: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          password_hash: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          password_hash: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          password_hash?: string
          role?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      booking_addons: {
        Row: {
          addon_id: string
          booking_id: string
          created_at: string | null
          id: string
          notes: string | null
          quantity: number | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          addon_id: string
          booking_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          addon_id?: string
          booking_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addon_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_at: string | null
          actual_distance: number | null
          actual_duration: number | null
          addon_charges: number | null
          applied_waiting_rate: number | null
          base_fare: number
          booking_number: string
          cancellation_fee: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string | null
          customer_id: string
          customer_notes: string | null
          customer_reported_payment_method: string | null
          delivery_confirmed_at: string | null
          delivery_otp: string | null
          delivery_proof_url: string | null
          destination_address: string
          destination_landmark: string | null
          destination_latitude: number
          destination_longitude: number
          discount_amount: number | null
          distance_fare: number | null
          driver_arrived_at: string | null
          driver_id: string | null
          driver_notes: string | null
          driver_payout: number | null
          estimated_distance: number | null
          estimated_duration: number | null
          expires_at: string | null
          fare_multiplier: number | null
          free_waiting_minutes: number | null
          free_waiting_time_minutes: number | null
          goods_description: string | null
          goods_weight_kg: number | null
          id: string
          idempotency_key: string | null
          online_payment_order_id: string | null
          origin_address: string
          origin_landmark: string | null
          origin_latitude: number
          origin_longitude: number
          payment_confirmed_by_customer: boolean | null
          payment_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_session_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pickup_otp: string | null
          receiver_name: string | null
          receiver_phone: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          surge_multiplier: number | null
          time_fare: number | null
          tip_amount: number | null
          total_fare: number
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          waiting_charge_per_minute: number | null
          waiting_charges: number | null
          waiting_duration_minutes: number | null
          waiting_end_time: string | null
          waiting_fare: number | null
          waiting_start_time: string | null
          wallet_amount_used: number | null
        }
        Insert: {
          accepted_at?: string | null
          actual_distance?: number | null
          actual_duration?: number | null
          addon_charges?: number | null
          applied_waiting_rate?: number | null
          base_fare: number
          booking_number: string
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          customer_notes?: string | null
          customer_reported_payment_method?: string | null
          delivery_confirmed_at?: string | null
          delivery_otp?: string | null
          delivery_proof_url?: string | null
          destination_address: string
          destination_landmark?: string | null
          destination_latitude: number
          destination_longitude: number
          discount_amount?: number | null
          distance_fare?: number | null
          driver_arrived_at?: string | null
          driver_id?: string | null
          driver_notes?: string | null
          driver_payout?: number | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          expires_at?: string | null
          fare_multiplier?: number | null
          free_waiting_minutes?: number | null
          free_waiting_time_minutes?: number | null
          goods_description?: string | null
          goods_weight_kg?: number | null
          id?: string
          idempotency_key?: string | null
          online_payment_order_id?: string | null
          origin_address: string
          origin_landmark?: string | null
          origin_latitude: number
          origin_longitude: number
          payment_confirmed_by_customer?: boolean | null
          payment_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_session_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pickup_otp?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          surge_multiplier?: number | null
          time_fare?: number | null
          tip_amount?: number | null
          total_fare: number
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          waiting_charge_per_minute?: number | null
          waiting_charges?: number | null
          waiting_duration_minutes?: number | null
          waiting_end_time?: string | null
          waiting_fare?: number | null
          waiting_start_time?: string | null
          wallet_amount_used?: number | null
        }
        Update: {
          accepted_at?: string | null
          actual_distance?: number | null
          actual_duration?: number | null
          addon_charges?: number | null
          applied_waiting_rate?: number | null
          base_fare?: number
          booking_number?: string
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          customer_notes?: string | null
          customer_reported_payment_method?: string | null
          delivery_confirmed_at?: string | null
          delivery_otp?: string | null
          delivery_proof_url?: string | null
          destination_address?: string
          destination_landmark?: string | null
          destination_latitude?: number
          destination_longitude?: number
          discount_amount?: number | null
          distance_fare?: number | null
          driver_arrived_at?: string | null
          driver_id?: string | null
          driver_notes?: string | null
          driver_payout?: number | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          expires_at?: string | null
          fare_multiplier?: number | null
          free_waiting_minutes?: number | null
          free_waiting_time_minutes?: number | null
          goods_description?: string | null
          goods_weight_kg?: number | null
          id?: string
          idempotency_key?: string | null
          online_payment_order_id?: string | null
          origin_address?: string
          origin_landmark?: string | null
          origin_latitude?: number
          origin_longitude?: number
          payment_confirmed_by_customer?: boolean | null
          payment_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_session_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pickup_otp?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          surge_multiplier?: number | null
          time_fare?: number | null
          tip_amount?: number | null
          total_fare?: number
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          waiting_charge_per_minute?: number | null
          waiting_charges?: number | null
          waiting_duration_minutes?: number | null
          waiting_end_time?: string | null
          waiting_fare?: number | null
          waiting_start_time?: string | null
          wallet_amount_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          booking_id: string | null
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          booking_id?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          booking_id?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "driver_locations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_rejections: {
        Row: {
          booking_id: string
          driver_id: string
          id: string
          rejected_at: string | null
        }
        Insert: {
          booking_id: string
          driver_id: string
          id?: string
          rejected_at?: string | null
        }
        Update: {
          booking_id?: string
          driver_id?: string
          id?: string
          rejected_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_rejections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rejections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "driver_rejections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_rejections_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_verification_history: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          document_snapshot: Json | null
          driver_id: string
          id: string
          rejection_reason: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          document_snapshot?: Json | null
          driver_id: string
          id?: string
          rejection_reason?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          document_snapshot?: Json | null
          driver_id?: string
          id?: string
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_verification_history_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_verification_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallet_transactions: {
        Row: {
          amount: number
          balance_type: string
          booking_id: string | null
          created_at: string | null
          description: string | null
          direction: string
          driver_id: string
          id: string
          metadata: Json | null
          reference_id: string | null
          status: string
          type: string
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          balance_type: string
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          direction: string
          driver_id: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: string
          type: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          balance_type?: string
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string
          driver_id?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: string
          type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallets: {
        Row: {
          available_balance: number
          created_at: string | null
          driver_id: string
          id: string
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string | null
        }
        Insert: {
          available_balance?: number
          created_at?: string | null
          driver_id: string
          id?: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
        }
        Update: {
          available_balance?: number
          created_at?: string | null
          driver_id?: string
          id?: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          bank_details: Json | null
          beneficiary_id: string | null
          beneficiary_status: string | null
          created_at: string | null
          current_latitude: number | null
          current_longitude: number | null
          id: string
          insurance_image_url: string | null
          is_online: boolean | null
          is_verified: boolean | null
          last_location_update: string | null
          license_expiry: string
          license_image_url: string | null
          license_number: string
          payment_flags: number | null
          rating: number | null
          rc_image_url: string | null
          rejection_reason: string | null
          status: string | null
          suspension_reason: string | null
          suspension_type: string | null
          suspension_until: string | null
          total_earnings: number | null
          total_trips: number | null
          updated_at: string | null
          user_id: string | null
          vehicle_color: string | null
          vehicle_image_url: string | null
          vehicle_model: string
          vehicle_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_details?: Json | null
          beneficiary_id?: string | null
          beneficiary_status?: string | null
          created_at?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          insurance_image_url?: string | null
          is_online?: boolean | null
          is_verified?: boolean | null
          last_location_update?: string | null
          license_expiry: string
          license_image_url?: string | null
          license_number: string
          payment_flags?: number | null
          rating?: number | null
          rc_image_url?: string | null
          rejection_reason?: string | null
          status?: string | null
          suspension_reason?: string | null
          suspension_type?: string | null
          suspension_until?: string | null
          total_earnings?: number | null
          total_trips?: number | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_image_url?: string | null
          vehicle_model: string
          vehicle_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_details?: Json | null
          beneficiary_id?: string | null
          beneficiary_status?: string | null
          created_at?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          insurance_image_url?: string | null
          is_online?: boolean | null
          is_verified?: boolean | null
          last_location_update?: string | null
          license_expiry?: string
          license_image_url?: string | null
          license_number?: string
          payment_flags?: number | null
          rating?: number | null
          rc_image_url?: string | null
          rejection_reason?: string | null
          status?: string | null
          suspension_reason?: string | null
          suspension_type?: string | null
          suspension_until?: string | null
          total_earnings?: number | null
          total_trips?: number | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_image_url?: string | null
          vehicle_model?: string
          vehicle_number?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          alert_type: string | null
          booking_id: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          notified_contacts: string[] | null
          resolved_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          alert_type?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          notified_contacts?: string[] | null
          resolved_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          notified_contacts?: string[] | null
          resolved_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "emergency_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expansion_interests: {
        Row: {
          address: string | null
          id: string
          latitude: number
          longitude: number
          requested_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          id?: string
          latitude: number
          longitude: number
          requested_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          id?: string
          latitude?: number
          longitude?: number
          requested_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expansion_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_active: boolean | null
          question: string
          target_audience: string | null
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          target_audience?: string | null
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          target_audience?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fare_config: {
        Row: {
          base_fare: number
          cancellation_fee: number | null
          created_at: string | null
          driver_search_radius_km: number | null
          id: string
          is_active: boolean | null
          minimum_fare: number
          per_km_rate: number
          per_minute_rate: number
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          base_fare: number
          cancellation_fee?: number | null
          created_at?: string | null
          driver_search_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          minimum_fare: number
          per_km_rate: number
          per_minute_rate: number
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          base_fare?: number
          cancellation_fee?: number | null
          created_at?: string | null
          driver_search_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          minimum_fare?: number
          per_km_rate?: number
          per_minute_rate?: number
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      fare_discrepancies: {
        Row: {
          actual_distance_km: number
          booking_id: string
          created_at: string
          deviation_percentage: number
          estimated_distance_km: number
          id: string
        }
        Insert: {
          actual_distance_km: number
          booking_id: string
          created_at?: string
          deviation_percentage: number
          estimated_distance_km: number
          id?: string
        }
        Update: {
          actual_distance_km?: number
          booking_id?: string
          created_at?: string
          deviation_percentage?: number
          estimated_distance_km?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fare_discrepancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_discrepancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "fare_discrepancies_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          target_audience: string
          title: string
          type: string
          updated_at: string | null
          version: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          target_audience?: string
          title: string
          type: string
          updated_at?: string | null
          version?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          target_audience?: string
          title?: string
          type?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          notification_type: string | null
          processed_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type?: string | null
          processed_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type?: string | null
          processed_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          is_active: boolean | null
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          is_active?: boolean | null
          platform?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          booking_id: string
          created_at: string | null
          from_user_id: string
          id: string
          is_from_customer: boolean
          rated_by: string
          rated_user: string
          rater_type: string
          rating: number
          review: string | null
          tags: string[] | null
          to_user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          from_user_id: string
          id?: string
          is_from_customer: boolean
          rated_by: string
          rated_user: string
          rater_type: string
          rating: number
          review?: string | null
          tags?: string[] | null
          to_user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          from_user_id?: string
          id?: string
          is_from_customer?: boolean
          rated_by?: string
          rated_user?: string
          rater_type?: string
          rating?: number
          review?: string | null
          tags?: string[] | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_user_fkey"
            columns: ["rated_user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code_used: string
          referred_id: string
          referrer_id: string
          source_app: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code_used: string
          referred_id: string
          referrer_id: string
          source_app: string
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code_used?: string
          referred_id?: string
          referrer_id?: string
          source_app?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          completed_at: string | null
          created_at: string | null
          driver_id: string | null
          dropoff: string | null
          id: string
          pickup: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          driver_id?: string | null
          dropoff?: string | null
          id?: string
          pickup?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          driver_id?: string | null
          dropoff?: string | null
          id?: string
          pickup?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          address: string
          created_at: string | null
          icon_type: string | null
          id: string
          label: string
          latitude: number
          longitude: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string | null
          icon_type?: string | null
          id?: string
          label: string
          latitude: number
          longitude: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          address?: string
          created_at?: string | null
          icon_type?: string | null
          id?: string
          label?: string
          latitude?: number
          longitude?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_routes: {
        Row: {
          created_at: string | null
          destination_address: string
          destination_latitude: number
          destination_longitude: number
          id: string
          name: string
          origin_address: string
          origin_latitude: number
          origin_longitude: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          destination_address: string
          destination_latitude: number
          destination_longitude: number
          id?: string
          name: string
          origin_address: string
          origin_latitude: number
          origin_longitude: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          destination_address?: string
          destination_latitude?: number
          destination_longitude?: number
          id?: string
          name?: string
          origin_address?: string
          origin_latitude?: number
          origin_longitude?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          center_latitude: number
          center_longitude: number
          city: string
          country: string | null
          created_at: string | null
          geometry: unknown
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          priority: number | null
          radius_km: number | null
          state: string
          updated_at: string | null
        }
        Insert: {
          center_latitude: number
          center_longitude: number
          city: string
          country?: string | null
          created_at?: string | null
          geometry?: unknown
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          priority?: number | null
          radius_km?: number | null
          state: string
          updated_at?: string | null
        }
        Update: {
          center_latitude?: number
          center_longitude?: number
          city?: string
          country?: string | null
          created_at?: string | null
          geometry?: unknown
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          priority?: number | null
          radius_km?: number | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_queue: {
        Row: {
          attempts: number | null
          booking_id: string | null
          created_at: string | null
          error_message: string | null
          id: number
          last_attempt_at: string | null
          message: string
          phone_number: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          last_attempt_at?: string | null
          message: string
          phone_number: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          last_attempt_at?: string | null
          message?: string
          phone_number?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          resolved_at: string | null
          source_app: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          source_app?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          source_app?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_terms_acceptance: {
        Row: {
          accepted_at: string
          device_info: Json | null
          id: string
          ip_address: unknown
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          terms_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_terms_acceptance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string | null
          email: string
          expo_push_token: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          rating: number | null
          referral_code: string
          role: Database["public"]["Enums"]["user_role"] | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_version: string | null
          total_ratings: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          email: string
          expo_push_token?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          rating?: number | null
          referral_code?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          total_ratings?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          email?: string
          expo_push_token?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          rating?: number | null
          referral_code?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          total_ratings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicle_specifications: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          icon_emoji: string | null
          id: string
          max_volume_cubic_meters: number | null
          max_weight_kg: number | null
          passenger_capacity: number | null
          suitable_for: string[] | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          icon_emoji?: string | null
          id?: string
          max_volume_cubic_meters?: number | null
          max_weight_kg?: number | null
          passenger_capacity?: number | null
          suitable_for?: string[] | null
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon_emoji?: string | null
          id?: string
          max_volume_cubic_meters?: number | null
          max_weight_kg?: number | null
          passenger_capacity?: number | null
          suitable_for?: string[] | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      waiting_charges_config: {
        Row: {
          charge_per_minute: number
          created_at: string | null
          free_waiting_minutes: number
          id: string
          is_active: boolean | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          charge_per_minute?: number
          created_at?: string | null
          free_waiting_minutes?: number
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          charge_per_minute?: number
          created_at?: string | null
          free_waiting_minutes?: number
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          description: string | null
          id: string
          payment_order_id: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          payment_order_id?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          payment_order_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          driver_id: string
          id: string
          idempotency_key: string | null
          notes: string | null
          payout_error: string | null
          payout_reference: string | null
          payout_status: string | null
          processed_at: string | null
          status: string
          transaction_id: string | null
          updated_at: string | null
          wallet_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          driver_id: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payout_error?: string | null
          payout_reference?: string | null
          payout_status?: string | null
          processed_at?: string | null
          status: string
          transaction_id?: string | null
          updated_at?: string | null
          wallet_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          driver_id?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payout_error?: string | null
          payout_reference?: string | null
          payout_status?: string | null
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          addon_charges: number | null
          base_fare: number | null
          booking_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          distance_fare: number | null
          distance_km: number | null
          driver_name: string | null
          driver_payout: number | null
          driver_phone: string | null
          dropoff_address: string | null
          dropoff_time: string | null
          gst_amount: number | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          online_payment_order_id: string | null
          payment_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_session_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pickup_address: string | null
          pickup_time: string | null
          platform_fee: number | null
          surge_multiplier: number | null
          time_fare: number | null
          tip_amount: number | null
          total_amount: number | null
          vehicle_model: string | null
          vehicle_number: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_charges: number | null
          wallet_amount_used: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_booking_atomic: {
        Args: { p_booking_id: string; p_driver_id: string }
        Returns: Json
      }
      accept_latest_terms: { Args: { doc_type: string }; Returns: boolean }
      add_addon_to_booking: {
        Args: {
          p_addon_code: string
          p_booking_id: string
          p_quantity?: number
        }
        Returns: boolean
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      approve_withdrawal: {
        Args: { p_admin_notes?: string; p_withdrawal_id: string }
        Returns: Json
      }
      atomic_credit_wallet: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      atomic_credit_wallet_idempotent: {
        Args: { p_amount: number; p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      calculate_addon_charges: {
        Args: { p_booking_id: string }
        Returns: number
      }
      calculate_cancellation_fee: {
        Args: { p_booking_id: string }
        Returns: number
      }
      calculate_waiting_charges: {
        Args: { p_booking_id: string }
        Returns: number
      }
      calculate_waiting_fee: { Args: { p_booking_id: string }; Returns: number }
      can_view_user_profile_secure: {
        Args: { observer_user_id: string; target_user_id: string }
        Returns: boolean
      }
      cancel_booking_by_customer: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_booking_by_customer_v2: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_booking_by_driver: {
        Args: { p_booking_id: string; p_driver_id: string; p_reason?: string }
        Returns: Json
      }
      check_phone_exists: { Args: { phone_number: string }; Returns: boolean }
      complete_partial_payment: {
        Args: {
          p_amount_paid: number
          p_booking_id: string
          p_payment_order_id: string
        }
        Returns: Json
      }
      complete_withdrawal_payout: {
        Args: {
          p_admin_notes?: string
          p_transaction_ref?: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      confirm_customer_payment: {
        Args: { p_booking_id: string; p_payment_method: string }
        Returns: Json
      }
      credit_driver_earning: {
        Args: {
          p_booking_id: string
          p_driver_id: string
          p_is_cash?: boolean
          p_total_fare: number
        }
        Returns: Json
      }
      decline_booking: { Args: { p_booking_id: string }; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_driver_wallet: { Args: { p_driver_id: string }; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_nearby_drivers: {
        Args: {
          pickup_lat: number
          pickup_lng: number
          radius_km?: number
          required_vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: {
          current_latitude: number
          current_longitude: number
          distance_km: number
          id: string
          rating: number
          user_avatar: string
          user_id: string
          user_name: string
          user_phone: string
          vehicle_model: string
          vehicle_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }[]
      }
      generate_invoice: { Args: { p_booking_id: string }; Returns: Json }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_service_areas: {
        Args: never
        Returns: {
          center_lat: number
          center_lng: number
          city: string
          id: string
          name: string
          radius_km: number
          state: string
        }[]
      }
      get_applicable_addons: {
        Args: { p_vehicle_type: Database["public"]["Enums"]["vehicle_type"] }
        Returns: {
          code: string
          description: string
          icon_emoji: string
          id: string
          name: string
          price: number
        }[]
      }
      get_available_bookings_v2: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_radius_km?: number
          p_vehicle_type: string
        }
        Returns: {
          booking_number: string
          created_at: string
          destination_address: string
          distance_km: number
          driver_payout: number
          estimated_distance: number
          estimated_duration: number
          expires_at: string
          fare_multiplier: number
          id: string
          origin_address: string
          payment_method: string
          tip_amount: number
          total_fare: number
          vehicle_type: string
        }[]
      }
      get_current_driver_id: { Args: never; Returns: string }
      get_driver_balance: { Args: { p_driver_id: string }; Returns: number }
      get_driver_id_by_user_id: { Args: { p_user_id: string }; Returns: string }
      get_driver_wallet_info: { Args: { p_driver_id: string }; Returns: Json }
      get_platform_setting: { Args: { p_key: string }; Returns: Json }
      get_service_area_for_location: {
        Args: { lat: number; lng: number }
        Returns: {
          area_id: string
          area_name: string
          city: string
          country: string
          state: string
        }[]
      }
      get_user_consent_status: {
        Args: { doc_type: string }
        Returns: {
          doc_content: string
          doc_title: string
          last_accepted_at: string
          last_accepted_version: string
          latest_version: string
          needs_acceptance: boolean
        }[]
      }
      get_vehicle_types_with_fare: {
        Args: never
        Returns: {
          base_fare: number
          description: string
          display_name: string
          icon_emoji: string
          max_weight_kg: number
          minimum_fare: number
          per_km_rate: number
          suitable_for: string[]
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_accepted_latest_terms: {
        Args: { p_required_version?: string; p_user_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_driver_for_customer: {
        Args: { p_customer_user_id: string; p_driver_id: string }
        Returns: boolean
      }
      is_booking_available: { Args: { p_booking_id: string }; Returns: boolean }
      is_location_in_service_area: {
        Args: { lat: number; lng: number }
        Returns: boolean
      }
      is_location_supported: {
        Args: { lat: number; lng: number }
        Returns: {
          area_name: string
          supported: boolean
        }[]
      }
      is_online_approved_driver: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      pay_with_wallet: {
        Args: {
          p_booking_id: string
          p_payment_session_id?: string
          p_use_full_wallet?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      record_terms_acceptance: {
        Args: {
          p_device_info?: Json
          p_ip_address?: unknown
          p_terms_version?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: boolean
      }
      reject_withdrawal: {
        Args: { p_reason: string; p_withdrawal_id: string }
        Returns: Json
      }
      release_pending_earning: { Args: { p_booking_id: string }; Returns: Json }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_driver_id: string
          p_idempotency_key?: string
        }
        Returns: Json
      }
      rollback_partial_wallet_payment: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      start_ride: {
        Args: { p_booking_id: string; p_otp: string }
        Returns: Json
      }
      start_waiting_timer: { Args: { p_booking_id: string }; Returns: boolean }
      stop_waiting_timer: { Args: { p_booking_id: string }; Returns: number }
      submit_feedback: {
        Args: {
          p_booking_id: string
          p_is_from_customer: boolean
          p_rating: number
          p_review: string
          p_tags: string[]
        }
        Returns: boolean
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      generate_fast2sms_otp: {
        Args: {
          p_phone_number: string
          p_purpose: string
          p_user_id?: string
          p_booking_id?: string
          p_metadata?: Json
        }
        Returns: string
      }
      verify_fast2sms_otp: {
        Args: {
          p_phone_number: string
          p_otp_code: string
          p_purpose?: string
        }
        Returns: {
          success: boolean
          message: string
          user_id: string | null
          booking_id: string | null
        }
      }
      create_or_update_user_after_otp: {
        Args: {
          p_phone: string
          p_role?: string
          p_name?: string
          p_metadata?: Json
        }
        Returns: {
          user_id: string
          is_new_user: boolean
          email: string
        }
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "accepted"
        | "driver_arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "scheduled"
        | "payment_pending"
        | "payment_confirmed"
      payment_method:
        | "cash"
        | "online"
        | "wallet"
        | "partial_wallet"
        | "wallet_plus_online"
      payment_status: "pending" | "paid" | "refunded" | "partial_paid"
      user_role: "customer" | "driver" | "admin"
      vehicle_type:
        | "bike"
        | "auto"
        | "mini"
        | "sedan"
        | "suv"
        | "truck"
        | "tempo"
        | "three_wheeler"
        | "chota_hathi"
        | "pickup"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "pending",
        "accepted",
        "driver_arrived",
        "in_progress",
        "completed",
        "cancelled",
        "scheduled",
        "payment_pending",
        "payment_confirmed",
      ],
      payment_method: [
        "cash",
        "online",
        "wallet",
        "partial_wallet",
        "wallet_plus_online",
      ],
      payment_status: ["pending", "paid", "refunded", "partial_paid"],
      user_role: ["customer", "driver", "admin"],
      vehicle_type: [
        "bike",
        "auto",
        "mini",
        "sedan",
        "suv",
        "truck",
        "tempo",
        "three_wheeler",
        "chota_hathi",
        "pickup",
      ],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
