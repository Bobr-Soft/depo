import { SizeClass, TaskComplete, TaskItemStatus, TaskStatus, TaskType, UserRole } from "@/constants";
import mysql from "mysql2";

export default function loadTasks(): Promise<TaskComplete[]> {
  // returns an Task array of task objects with the following structure:
  // only loads in tasks assigned to current logged in email
  /*
  returns list of tasks with the following structure:
  TaskItemComplete {
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
      location: Location | null;
    };
  */
  //TODO - Implement direct sql queries to fetch tasks from the database and return them as an array of task objects

  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "school_inventory";

  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection({
      host,
      user,
      password,
      database,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Error connecting to the database:", err);
        reject(err);
        return;
      }
      console.log("Connected to the database.");

      // load tasks with items and related data, then group rows into TaskComplete
      const query = `
        SELECT
          t.id AS task_id,
          t.name AS task_name,
          t.type AS task_type,
          t.source_id AS task_source_id,
          t.assigned_user AS task_assigned_user,
          t.status AS task_status,
          t.priority AS task_priority,
          t.deadline AS task_deadline,
          t.updated_at AS task_updated_at,
          t.created_at AS task_created_at,
          u.id AS user_id,
          u.email AS user_email,
          u.role AS user_role,
          u.is_active AS user_is_active,
          u.last_login AS user_last_login,
          ti.id AS task_item_id,
          ti.task_id AS task_item_task_id,
          ti.requested_quantity,
          ti.picked_quantity,
          ti.status AS task_item_status,
          i.id AS item_id,
          i.name AS item_name,
          i.barcode,
          i.description,
          i.quantity AS item_quantity,
          c.id AS category_id,
          c.name AS category_name,
          c.size_class AS category_size_class,
          c.min_stock_level AS category_min_stock_level,
          l.id AS location_id,
          l.row_num AS location_row_num,
          l.col_num AS location_col_num,
          l.shelf_level AS location_shelf_level,
          l.is_xl AS location_is_xl,
          l.location_code AS location_code,
          l.is_active AS location_is_active
        FROM tasks t
        JOIN task_items ti ON ti.task_id = t.id
        JOIN items i ON ti.item_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN locations l ON i.location_id = l.id
        LEFT JOIN users u ON u.id = t.assigned_user
        WHERE ti.assigned_user_email = ?;
      `;

      const userEmail = process.env.CURRENT_USER_EMAIL || "hornyak.tibor@petrik.hu";

      connection.query(query, [userEmail], (err, results) => {
        if (err) {
          console.error("Error executing query:", err);
          reject(err);
          connection.end();
          return;
        }
        const rows = results as Array<{
          task_id: number;
          task_name: string;
          task_type: TaskType;
          task_source_id: string | null;
          task_assigned_user: number | null;
          task_status: TaskStatus;
          task_priority: number;
          task_deadline: Date | null;
          task_updated_at: Date;
          task_created_at: Date;
          user_id: number | null;
          user_email: string | null;
          user_role: UserRole | null;
          user_is_active: boolean | null;
          user_last_login: Date | null;
          task_item_id: number;
          task_item_task_id: number;
          requested_quantity: number;
          picked_quantity: number;
          task_item_status: TaskItemStatus;
          item_id: number;
          item_name: string;
          barcode: string | null;
          description: string | null;
          item_quantity: number;
          category_id: number | null;
          category_name: string | null;
          category_size_class: SizeClass | null;
          category_min_stock_level: number | null;
          location_id: number | null;
          location_row_num: number | null;
          location_col_num: number | null;
          location_shelf_level: number | null;
          location_is_xl: boolean | null;
          location_code: string | null;
          location_is_active: boolean | null;
        }>;

        const tasksById = new Map<number, TaskComplete>();

        rows.forEach((row) => {
          if (!tasksById.has(row.task_id)) {
            tasksById.set(row.task_id, {
              id: row.task_id,
              name: row.task_name,
              type: row.task_type,
              source_id: row.task_source_id,
              assigned_user: row.task_assigned_user,
              status: row.task_status,
              priority: row.task_priority,
              deadline: row.task_deadline,
              updated_at: row.task_updated_at,
              created_at: row.task_created_at,
              assigned_user_data:
                row.user_id && row.user_email && row.user_role && row.user_is_active !== null
                  ? {
                      id: row.user_id,
                      email: row.user_email,
                      role: row.user_role,
                      is_active: row.user_is_active,
                      last_login: row.user_last_login,
                    }
                  : null,
              items: [],
            });
          }

          const task = tasksById.get(row.task_id);
          if (!task) {
            return;
          }

          task.items.push({
            id: row.task_item_id,
            task_id: row.task_item_task_id,
            requested_quantity: row.requested_quantity,
            picked_quantity: row.picked_quantity,
            status: row.task_item_status,
            item: {
              id: row.item_id,
              name: row.item_name,
              barcode: row.barcode,
              description: row.description,
              quantity: row.item_quantity,
              category:
                row.category_id && row.category_name && row.category_size_class
                  ? {
                      id: row.category_id,
                      name: row.category_name,
                      size_class: row.category_size_class,
                      min_stock_level: row.category_min_stock_level,
                    }
                  : null,
              location:
                row.location_id && row.location_row_num !== null && row.location_col_num !== null
                  ? {
                      id: row.location_id,
                      row_num: row.location_row_num,
                      col_num: row.location_col_num,
                      shelf_level: row.location_shelf_level ?? 0,
                      is_xl: row.location_is_xl ?? false,
                      location_code: row.location_code ?? "",
                      is_active: row.location_is_active ?? false,
                    }
                  : null,
            },
          });
        });

        const tasks = Array.from(tasksById.values());
        console.log("Tasks fetched:", tasks);
        resolve(tasks);
        connection.end();
      });
    });
  });
}
