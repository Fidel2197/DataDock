export type View = "uploads" | "review" | "dashboard" | "history";
export type CleanOptions = {
  trim_whitespace: boolean;
  drop_duplicates: boolean;
  drop_empty_rows: boolean;
};
export type CleanSummary = {
  original_rows: number;
  cleaned_rows: number;
  duplicates_removed: number;
  empty_rows_removed: number;
  cells_trimmed: number;
  removed_rows: number;
};
export type ReportSummary = {
  id: string;
  name: string;
  created_at: string;
  byte_size: number;
  sample: boolean;
  row_count: number;
  column_count: number;
  quality_score: number;
  issue_rows: number;
  clean_summary: CleanSummary | null;
};
export type Column = {
  name: string;
  kind: "number" | "text";
  missing: number;
  unique: number;
  completeness: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  sum?: number;
  distribution: { label: string; count: number }[];
};
export type Profile = {
  row_count: number;
  column_count: number;
  missing_cells: number;
  duplicate_rows: number;
  issue_rows: number;
  clean_rows: number;
  quality_score: number;
  completeness: number;
  issue_counts: Record<string, number>;
  columns: Column[];
  analysis_ms: number;
  method: string;
};
export type Report = ReportSummary & {
  profile: Profile;
  clean_options: CleanOptions | null;
};
export type Issue = { kind: string; column: string; message: string };
export type Row = {
  row_number: number;
  values: Record<string, string>;
  issues: Issue[];
};
export type RowsResponse = {
  rows: Row[];
  total: number;
  page: number;
  page_size: number;
  columns: string[];
};
