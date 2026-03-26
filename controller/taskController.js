import { db } from '../config/db.js'

export const createTask = async (req, res, next) => {
    try {
        const { title, description, project_id, assigned_to } = req.body;
        const createdBy = req.user.id;

        const [project] = await db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [project_id]);
        if (!project || project.length === 0) {
            return res.status(404).json({
                msg: "Project not found or is deleted."
            });
        }

        const [assignment] = await db.query(
            'SELECT pa.* FROM project_assignments pa JOIN users u ON pa.user_id = u.id WHERE pa.project_id = ? AND pa.user_id = ? AND u.is_deleted = 0',
            [project_id, assigned_to]
        );

        if (assignment.length === 0) {
            return res.status(403).json({
                msg: "Cannot assign task: User is not assigned to this project."
            });
        }

        const [existingTask] = await db.query(
            'SELECT * FROM tasks WHERE title = ? AND project_id = ? AND is_deleted = 0',
            [title, project_id]
        );

        if (existingTask.length > 0) {
            return res.status(400).json({
                msg: "Task with this name already exists in the project"
            });
        }

        const [rows] = await db.query('INSERT INTO tasks (title, description, project_id, assigned_to, created_by) VALUES (?,?,?,?,?)',
            [title, description || null, project_id, assigned_to, createdBy]
        )
        return res.status(201).json({
            msg: "Task created successfully",
            taskId: rows.id
        })

    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const viewTasks = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;
        const userRole = req.user.role;

        let query, countQuery, queryParams;

        if (userRole === 'admin' || userRole === 'manager') {
            query = 'SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
            countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE is_deleted = 0';
            queryParams = [];
        } else {
            query = 'SELECT * FROM tasks WHERE assigned_to = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
            countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE assigned_to = ? AND is_deleted = 0';
            queryParams = [userId];
        }

        const [all_tasks] = await db.query(query, [...queryParams, Number(limit), Number(offset)]);
        const [totalResult] = await db.query(countQuery, queryParams);
        const total = totalResult[0].total;

        return res.status(200).json({
            all_tasks,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        next(error);
    }
}

export const viewTasksById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ? AND is_deleted = 0', [id]);

        if (tasks.length === 0) {
            return res.status(404).json({
                msg: "Invalid id or no assigned tasks"
            });
        }

        const task = tasks[0];

        if (userRole !== 'admin' && userRole !== 'manager') {
            if (task.assigned_to !== userId) {
                return res.status(403).json({
                    error: 'You can only view your own tasks'
                });
            }
        }
        return res.status(200).json({
            tasks
        })
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const updateTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const { status } = req.body;

        const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                msg: "Task not found"
            })
        }

        const task = rows[0];

        if (userRole !== 'admin') {
            if (task.assigned_to !== userId) {
                return res.status(403).json({
                    error: 'You can only update your own tasks'
                });
            }
        }

        if (status === 'done') {
            await db.query('DELETE FROM tasks WHERE id = ? ', [id]);
        } else {
            await db.query('UPDATE tasks SET status = ? WHERE id = ? ', [status, id]);
        }

        return res.status(200).json({
            msg: status === 'done' ? "Task marked as done and permanently deleted from database" : "Task updated successfully"
        })
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const deleteTask = async (req, res, next) => {
    try {
        const { id } = req.params
        const [rows] = await db.query('UPDATE tasks SET is_deleted = 1 WHERE id = ?', [id]);
        if (rows.affectedRows === 0) {
            return res.status(404).json({
                msg: "Task not found"
            })
        }
        return res.status(200).json({
            msg: "Tasks deleted successfully"
        })
    } catch (error) {
        console.log(error);
        next(error);
    }
}
export const unassignTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentUserRole = req.user.role;

        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return res.status(403).json({
                msg: "Access denied. Only managers and admins can unassign tasks."
            });
        }

        const [task] = await db.query('SELECT * FROM tasks WHERE id = ? AND is_deleted = 0', [id]);

        if (task.length === 0) {
            return res.status(404).json({
                msg: "Task not found"
            });
        }

        if (task[0].assigned_to === null) {
            return res.status(400).json({
                msg: "Task is already unassigned."
            });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [id]);

        return res.status(200).json({
            msg: "Task deleted successfully."
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
}
