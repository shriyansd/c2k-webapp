// Shared domain types mirroring the Supabase schema.

export interface Part {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Volunteer {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

export interface Contribution {
  id: string;
  volunteer_id: string;
  part_id: string;
  quantity: number;
  created_at: string;
}

// Shape returned by get_part_totals() / get_my_part_totals() RPCs.
export interface PartTotal {
  part_id: string;
  name: string;
  total: number;
}

// A contribution row joined with part name (personal history).
export interface HistoryEntry {
  id: string;
  created_at: string;
  part_name: string;
}

// A contribution row joined with volunteer + part names (admin live feed).
export interface ActivityEntry {
  id: string;
  created_at: string;
  part_name: string;
  volunteer_name: string;
}
