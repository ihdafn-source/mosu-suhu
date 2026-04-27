export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

// Fallback typing for Supabase when generated schema types are unavailable.
export type Database = {
	public: {
		Tables: {
			[tableName: string]: {
				Row: Record<string, any>;
				Insert: Record<string, any>;
				Update: Record<string, any>;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
