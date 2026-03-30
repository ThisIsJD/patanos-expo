/** Supabase database types — generated from schema */

export type UserRole = 'admin' | 'cashier' | 'kitchen';
export type ItemStatus = 'published' | 'draft' | 'archived';
export type OrderType = 'dine-in' | 'takeout';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'gcash' | 'card';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          sort_order: number;
          status: ItemStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          sort_order?: number;
          status?: ItemStatus;
        };
        Update: {
          name?: string;
          slug?: string;
          icon?: string | null;
          sort_order?: number;
          status?: ItemStatus;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          price: number;
          size_label: string | null;
          category_id: string;
          image_url: string | null;
          status: ItemStatus;
          is_featured: boolean;
          available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          price: number;
          size_label?: string | null;
          category_id: string;
          image_url?: string | null;
          status?: ItemStatus;
          is_featured?: boolean;
          available?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          price?: number;
          size_label?: string | null;
          category_id?: string;
          image_url?: string | null;
          status?: ItemStatus;
          is_featured?: boolean;
          available?: boolean;
          sort_order?: number;
        };
        Relationships: [{
          foreignKeyName: 'menu_items_category_id_fkey';
          columns: ['category_id'];
          referencedRelation: 'categories';
          referencedColumns: ['id'];
        }];
      };
      gallery_photos: {
        Row: {
          id: number;
          image_url: string;
          caption: string;
          link_url: string | null;
          sort_order: number;
          status: ItemStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          image_url: string;
          caption: string;
          link_url?: string | null;
          sort_order?: number;
          status?: ItemStatus;
        };
        Update: {
          image_url?: string;
          caption?: string;
          link_url?: string | null;
          sort_order?: number;
          status?: ItemStatus;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: number;
          order_number: string;
          order_type: OrderType;
          status: OrderStatus;
          subtotal: number;
          discount_amount: number;
          total_amount: number;
          payment_method: PaymentMethod | null;
          payment_ref: string | null;
          amount_tendered: number | null;
          change_amount: number | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          completed_at: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
        };
        Insert: {
          order_number?: string;
          order_type: OrderType;
          status?: OrderStatus;
          subtotal: number;
          discount_amount?: number;
          total_amount: number;
          payment_method?: PaymentMethod | null;
          payment_ref?: string | null;
          amount_tendered?: number | null;
          change_amount?: number | null;
          notes?: string | null;
          created_by: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
        };
        Update: {
          order_type?: OrderType;
          status?: OrderStatus;
          subtotal?: number;
          discount_amount?: number;
          total_amount?: number;
          payment_method?: PaymentMethod | null;
          payment_ref?: string | null;
          amount_tendered?: number | null;
          change_amount?: number | null;
          notes?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
        };
        Relationships: [{
          foreignKeyName: 'orders_created_by_fkey';
          columns: ['created_by'];
          referencedRelation: 'profiles';
          referencedColumns: ['id'];
        }];
      };
      order_items: {
        Row: {
          id: number;
          order_id: number;
          menu_item_id: number;
          item_name: string;
          size_label: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          order_id: number;
          menu_item_id: number;
          item_name: string;
          size_label?: string | null;
          quantity: number;
          unit_price: number;
          notes?: string | null;
        };
        Update: {
          order_id?: number;
          menu_item_id?: number;
          item_name?: string;
          size_label?: string | null;
          quantity?: number;
          unit_price?: number;
          notes?: string | null;
        };
        Relationships: [{
          foreignKeyName: 'order_items_order_id_fkey';
          columns: ['order_id'];
          referencedRelation: 'orders';
          referencedColumns: ['id'];
        }, {
          foreignKeyName: 'order_items_menu_item_id_fkey';
          columns: ['menu_item_id'];
          referencedRelation: 'menu_items';
          referencedColumns: ['id'];
        }];
      };
      inventory: {
        Row: {
          id: number;
          menu_item_id: number;
          stock_count: number;
          low_stock_threshold: number;
          track_inventory: boolean;
          last_restocked_at: string | null;
          updated_at: string;
        };
        Insert: {
          menu_item_id: number;
          stock_count?: number;
          low_stock_threshold?: number;
          track_inventory?: boolean;
          last_restocked_at?: string | null;
        };
        Update: {
          menu_item_id?: number;
          stock_count?: number;
          low_stock_threshold?: number;
          track_inventory?: boolean;
          last_restocked_at?: string | null;
        };
        Relationships: [{
          foreignKeyName: 'inventory_menu_item_id_fkey';
          columns: ['menu_item_id'];
          referencedRelation: 'menu_items';
          referencedColumns: ['id'];
        }];
      };
    };
    Enums: {
      user_role: UserRole;
      item_status: ItemStatus;
      order_type: OrderType;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}

/** Shorthand row types */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type GalleryPhoto = Database['public']['Tables']['gallery_photos']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type Inventory = Database['public']['Tables']['inventory']['Row'];
