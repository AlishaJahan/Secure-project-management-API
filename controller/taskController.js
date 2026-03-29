import { db } from '../config/db.js'

export const createTask = async (req, res, next) => {
    try {
        const { title, description, project_id, assigned_to } = req.body;
        const createdBy = req.user.id;

        // Parallelize the checks for project existence and user assignment to this project
        const [[project], [assignment]] = await Promise.all([
            db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [project_id]),
            db.query(
                'SELECT pa.* FROM project_assignments pa JOIN users u ON pa.user_id = u.id WHERE pa.project_id = ? AND pa.user_id = ? AND u.is_deleted = 0',
                [project_id, assigned_to]
            )
        ]);

        if (!project.length) {
            return res.status(404).json({
                status: 404,
                message: "Project not found or is deleted.",
                error: "Not Found"
            });
        }

        if (!assignment.length) {
            return res.status(403).json({
                status: 403,
                message: "Cannot assign task: User is not assigned to this project.",
                error: "Forbidden"
            });
        }

        const [existingTask] = await db.query(
            'SELECT * FROM tasks WHERE title = ? AND project_id = ? AND is_deleted = 0',
            [title, project_id]
        );

        if (existingTask.length) {
            return res.status(400).json({
                status: 400,
                message: "Task with this name already exists in the project",
                error: "Bad Request"
            });
        }

        const [rows] = await db.query('INSERT INTO tasks (title, description, project_id, assigned_to, created_by) VALUES (?,?,?,?,?)',
            [title, description || null, project_id, assigned_to, createdBy]
        )
        return res.status(201).json({
            status: 201,
            message: "Task created successfully",
            data: { taskId: rows.id }
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
        }

        if (userRole === 'user') {
            query = 'SELECT * FROM tasks WHERE assigned_to = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
            countQuery = 'SELECT COUNT(*) as total FROM tasks WHERE assigned_to = ? AND is_deleted = 0';
            queryParams = [userId];
        }

        // Parallelize fetching tasks and the total count for pagination
        const [[all_tasks], [totalResult]] = await Promise.all([
            db.query(query, [...queryParams, Number(limit), Number(offset)]),
            db.query(countQuery, queryParams)
        ]);

        const total = totalResult[0].total;

        return res.status(200).json({
            status: 200,
            message: "Fetched tasks successfully",
            data: {
                all_tasks,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
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

        if (!tasks.length) {
            return res.status(404).json({
                status: 404,
                message: "Invalid id or no assigned tasks",
                error: "Not Found"
            });
        }

        const task = tasks[0];

        if (userRole !== 'admin' && userRole !== 'manager') {
            if (task.assigned_to !== userId) {
                return res.status(403).json({
                    status: 403,
                    message: 'You can only view your own tasks',
                    error: 'Forbidden'
                });
            }
        }
        return res.status(200).json({
            status: 200,
            message: "Fetched task details successfully",
            data: { tasks }
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

        if (!rows.length) {
            return res.status(404).json({
                status: 404,
                message: "Task not found",
                error: "Not Found"
            })
        }

        const task = rows[0];

        if (userRole !== 'admin') {
            if (task.assigned_to !== userId) {
                return res.status(403).json({
                    status: 403,
                    message: 'You can only update your own tasks',
                    error: 'Forbidden'
                });
            }
        }

        if (status === 'done') {
            await db.query('DELETE FROM tasks WHERE id = ? ', [id]);
        }
        if (status !== 'done') {
            await db.query('UPDATE tasks SET status = ? WHERE id = ? ', [status, id]);
        }

        return res.status(200).json({
            status: 200,
            message: status === 'done' ? "Task marked as done and permanently deleted from database" : "Task updated successfully",
            data: {}
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
        if (!rows.affectedRows) {
            return res.status(404).json({
                status: 404,
                message: "Task not found",
                error: "Not Found"
            })
        }
        return res.status(200).json({
            status: 200,
            message: "Tasks deleted successfully",
            data: {}
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
                status: 403,
                message: "Access denied. Only managers and admins can unassign tasks.",
                error: "Forbidden"
            });
        }

        const [task] = await db.query('SELECT * FROM tasks WHERE id = ? AND is_deleted = 0', [id]);

        if (!task.length) {
            return res.status(404).json({
                status: 404,
                message: "Task not found",
                error: "Not Found"
            });
        }

        if (task[0].assigned_to === null) {
            return res.status(400).json({
                status: 400,
                message: "Task is already unassigned.",
                error: "Bad Request"
            });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [id]);

        return res.status(200).json({
            status: 200,
            message: "Task deleted successfully.",
            data: {}
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
}
