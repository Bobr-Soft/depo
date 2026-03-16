/**
 * Database types for the warehouse management system
 * Based on school_inventory.sql schema
 *
 * USAGE EXAMPLES:
 *
 * // Fetching a complete task with all data
 * const task: TaskComplete = await api.getTask(taskId);
 * console.log(task.name);
 * console.log(task.assigned_user_data?.email);
 * task.items.forEach(item => {
 * console.log(item.item.name, item.requested_quantity);
 * });
 *
 * // Using task summary in a list
 * const tasks: TaskSummary[] = await api.getTasks();
 * tasks.forEach(task => {
 * console.log(`${task.name}: ${task.completion_percentage}%`);
 * });
 */

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'admin' | 'worker' | 'supervisor';

export type TaskType = 'inbound' | 'picking' | 'transfer';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TaskItemStatus = 'pending' | 'picked' | 'cancelled';

export type InventoryActionType = 'store' | 'pick' | 'loan' | 'return' | 'adjust' | 'damage';

export type SizeClass = 'kicsi' | 'közepes' | 'raklapos';

// ============================================================
// DATABASE TABLES
// ============================================================

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login: Date | null;
}

export interface Category {
  id: number;
  name: string;
  size_class: SizeClass;
  min_stock_level: number | null;
}

export interface Location {
  id: number;
  row_num: number;
  col_num: number;
  shelf_level: number;
  is_xl: boolean | number; // Support both backend implementations (SQLite often uses 1/0)
  location_code: string; // Format: "SS-OO-PP" (e.g., "01-02-01")
  is_active: boolean | number;
}

export interface Item {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  quantity: number;
  user_id: number | null; // User who has the item (if loaned)
  category_id: number | null;
  location_id: number | null;
  updated_at: Date;
  created_at: Date;
}

export interface Task {
  id: number;
  name: string;
  type: TaskType;
  source_id: string | null; // Work Order ID or Reference Number
  assigned_user: number | null;
  status: TaskStatus;
  priority: number; // 1-5, 1 = highest
  deadline: Date | null;
  updated_at: Date;
  created_at: Date;
}

export interface TaskItem {
  id: number;
  task_id: number;
  item_id: number;
  requested_quantity: number;
  picked_quantity: number;
  status: TaskItemStatus;
}

export interface InventoryLog {
  id: number;
  item_id: number;
  user_id: number;
  action_type: InventoryActionType;
  change_amount: number; // Negative for removal, positive for addition
  timestamp: Date;
}

// ============================================================
// EXTENDED TYPES (WITH RELATIONS)
// ============================================================

export interface ItemWithRelations extends Item {
  user?: User;
  category?: Category;
  location?: Location;
}

/**
 * Complete task data with all related information
 * Use this type when you need full task details for display
 */
export interface TaskComplete extends Task {
  assigned_user_data: User | null;
  items: TaskItemComplete[];
}

/**
 * Task item with complete item details.
 * Contains the joined location data necessary for Serpentine routing.
 */
export interface TaskItemComplete {
  id: number;
  task_id: number;
  requested_quantity: number;
  picked_quantity: number;
  status: TaskItemStatus;
  item: {
    id: number;
    name: string;
    barcode: string | null;
    description: string | null;
    quantity: number;
    category: Category | null;
    location: Location | null; // Required for displaying the destination on the Picking UI
  };
  location?: Location | null; // Top level location reference if the backend flattens the response
}

/**
 * @deprecated Use TaskComplete instead for full task data
 */
export interface TaskWithRelations extends Task {
  assigned_user_data?: User;
  task_items?: TaskItemWithRelations[];
}

export interface TaskItemWithRelations extends TaskItem {
  item?: ItemWithRelations;
  task?: Task;
}

export interface InventoryLogWithRelations extends InventoryLog {
  item?: Item;
  user?: User;
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface CreateItemRequest {
  name: string;
  barcode?: string;
  description?: string;
  quantity: number;
  category_id?: number;
  location_id?: number;
}

export interface UpdateItemRequest {
  name?: string;
  barcode?: string;
  description?: string;
  quantity?: number;
  category_id?: number;
  location_id?: number;
}

export interface CreateTaskRequest {
  name: string;
  type: TaskType;
  source_id?: string;
  assigned_user?: number;
  priority?: number;
  deadline?: Date;
  items: {
    item_id: number;
    requested_quantity: number;
  }[];
}

export interface UpdateTaskRequest {
  name?: string;
  assigned_user?: number;
  status?: TaskStatus;
  priority?: number;
  deadline?: Date;
}

export interface PickItemRequest {
  task_item_id: number;
  picked_quantity: number;
}

export interface AdjustInventoryRequest {
  item_id: number;
  change_amount: number;
  action_type: InventoryActionType;
  reason?: string;
}

export interface LoanItemRequest {
  item_id: number;
  user_id: number;
  quantity: number;
}

/**
 * Request payload for allocating a physical location to an incoming item
 */
export interface PutawayRequest {
  barcode: string;
  quantity: number;
  isXl: boolean;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Response when fetching a single task with all details
 */
export interface GetTaskResponse {
  task: TaskComplete;
}

/**
 * Response when fetching multiple tasks
 */
export interface GetTasksResponse {
  tasks: TaskSummary[];
  total: number;
}

/**
 * Response when creating or updating a task
 */
export interface TaskMutationResponse {
  task: TaskComplete;
  message: string;
}

/**
 * Response from the putaway allocation algorithm
 */
export interface PutawayResponse {
  location_code: string;
  location_id: number;
}

// ============================================================
// VIEW/DISPLAY TYPES
// ============================================================

/**
 * Task summary for list views
 * Contains computed fields for quick display
 */
export interface TaskSummary {
  id: number;
  name: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  deadline: Date | null;
  assigned_user_email: string | null;
  total_items: number;
  completed_items: number;
  is_overdue: boolean;
  completion_percentage: number;
  created_at: Date;
}

/**
 * Task progress details
 */
export interface TaskProgress {
  task_id: number;
  total_items: number;
  total_requested_quantity: number;
  total_picked_quantity: number;
  items_completed: number;
  items_pending: number;
  completion_percentage: number;
  estimated_time_remaining?: string; // e.g., "2h 30m"
}

// ============================================================
// QUERY FILTERS
// ============================================================

export interface ItemFilters {
  category_id?: number;
  location_id?: number;
  user_id?: number;
  barcode?: string;
  search?: string;
  low_stock?: boolean; // Items below min_stock_level
}

export interface TaskFilters {
  type?: TaskType;
  status?: TaskStatus;
  assigned_user?: number;
  priority_min?: number;
  priority_max?: number;
  overdue?: boolean;
}

export interface InventoryLogFilters {
  item_id?: number;
  user_id?: number;
  action_type?: InventoryActionType;
  date_from?: Date;
  date_to?: Date;
}

// ============================================================
// STATISTICS & REPORTS
// ============================================================

export interface InventoryStats {
  total_items: number;
  total_quantity: number;
  low_stock_items: number;
  categories_count: number;
  active_locations: number;
}

export interface TaskStats {
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_by_type: Record<TaskType, number>;
}

export interface UserActivity {
  user_id: number;
  user_email: string;
  total_actions: number;
  last_activity: Date;
  actions_by_type: Record<InventoryActionType, number>;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
