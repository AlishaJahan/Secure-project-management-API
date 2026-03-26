import { db } from '../config/db.js';

export const assignUserToProject = async (req, res, next) => {
    try {
        const { projectId, userIdsToAssign } = req.body;
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return res.status(403).json({
                msg: "Access denied. Only managers and admins can assign users to projects."
            });
        }

        const [project] = await db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [projectId]);

        if (!project || project.length === 0) {
            return res.status(404).json({
                msg: "Project not found or is deleted."
            });
        }

        const results = {
            success: [],
            alreadyAssigned: [],
            notFound: []
        };

        for (const userIdToAssign of userIdsToAssign) {
            const [user] = await db.query('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [userIdToAssign]);
            if (!user || user.length === 0) {
                results.notFound.push(userIdToAssign);
                continue;
            }

            const [existingAssignment] = await db.query('SELECT * FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToAssign]);

            if (existingAssignment.length > 0) {
                results.alreadyAssigned.push(userIdToAssign);
                continue;
            }

            await db.query('INSERT INTO project_assignments (project_id, user_id, assigned_by) VALUES (?, ?, ?)', [projectId, userIdToAssign, currentUserId]);
            results.success.push(userIdToAssign);
        }

        if (results.success.length === 0) {

            if (results.notFound.length > 0 && results.alreadyAssigned.length === 0) {
                return res.status(404).json({
                    msg: "No users assigned. The provided user ID(s) do not exist.",
                    results
                });
            }
            
            if (results.alreadyAssigned.length > 0 && results.notFound.length === 0) {
                return res.status(409).json({
                    msg: "No users assigned. All provided user(s) are already assigned to this project.",
                    results
                });
            }

            return res.status(400).json({
                msg: "No users assigned. User(s) either do not exist or are already assigned to this project.",
                results
            });
        }

        if (results.notFound.length > 0 || results.alreadyAssigned.length > 0) {
            return res.status(207).json({
                msg: "Some users were assigned, but some could not be assigned.",
                results
            });
        }

        return res.status(201).json({
            msg: "Project assigned successfully to all users.",
            results
        });

    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const viewProject = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;
        const userRole = req.user.role;

        let query, countQuery, queryParams;

        if (userRole === 'admin' || userRole === 'manager') {
            query = 'SELECT * FROM projects WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
            countQuery = 'SELECT COUNT(*) as total FROM projects WHERE is_deleted = 0';
            queryParams = [];
        } else {
            query = `
                SELECT p.* FROM projects p
                JOIN project_assignments pa ON p.id = pa.project_id
                WHERE pa.user_id = ? 
                AND p.is_deleted = 0
                ORDER BY p.created_at DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = `
                SELECT COUNT(*) as total FROM projects p
                JOIN project_assignments pa ON p.id = pa.project_id
                WHERE pa.user_id = ? 
                AND p.is_deleted = 0
            `;
            queryParams = [userId];
        }

        const [all_projects] = await db.query(query, [...queryParams, Number(limit), Number(offset)]);
        const [totalResult] = await db.query(countQuery, queryParams);
        const total = totalResult[0].total;

        return res.status(200).json({
            all_projects,
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

export const getAssignedProjects = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [assigned_projects] = await db.query(`
            SELECT p.* FROM projects p
            JOIN project_assignments pa ON p.id = pa.project_id
            WHERE pa.user_id = ? 
            AND p.is_deleted = 0
        `, [userId]);

        if (!assigned_projects || assigned_projects.length === 0) {
            return res.status(404).json({
                msg: "No projects found assigned to you."
            });
        }

        return res.status(200).json({
            assigned_projects
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const viewProjectById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        let project;
        if (userRole === 'admin' || userRole === 'manager') {
            [project] = await db.query('SELECT * FROM projects WHERE id = ? AND is_deleted = 0', [id]);
        } else {
            [project] = await db.query(`
                SELECT p.* FROM projects p
                JOIN project_assignments pa ON p.id = pa.project_id
                WHERE p.id = ? AND pa.user_id = ? AND p.is_deleted = 0
            `, [id, userId]);
        }

        if (!project || project.length === 0) {
            return res.status(404).json({
                msg: "Project not found or you are not authorized"
            });
        }

        return res.status(200).json({
            project: project[0]
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const createProject = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const created_by = req.user.id;

        const [existingProjects] = await db.query('SELECT id FROM projects WHERE name = ? AND is_deleted = 0', [name]);
        if (existingProjects.length > 0) {
            return res.status(409).json({
                msg: "Project with this name already exists!"
            });
        }

        await db.query('INSERT INTO projects(name, description, created_by) VALUES (?,?,?)',
            [name, description, created_by]);

        return res.status(201).json({
            msg: "Project created successfully",
            created_by: created_by
        })
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const deleteProject = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('UPDATE projects SET is_deleted = 1 WHERE id = ? AND created_by = ?', [id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({
                msg: "Project not found or you are not authorized to delete it."
            });
        }

        await db.query('DELETE FROM tasks WHERE project_id = ?', [id]);

        return res.status(200).json({
            msg: "Project deleted successfully."
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
}

export const unassignUserFromProject = async (req, res, next) => {
    try {
        const { projectId, userIdsToUnassign } = req.body;
        const currentUserRole = req.user.role;

        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return res.status(403).json({
                msg: "Access denied. Only managers and admins can unassign users from projects."
            });
        }

        const [project] = await db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [projectId]);
        if (!project || project.length === 0) {
            return res.status(404).json({
                msg: "Project not found or is deleted."
            });
        }

        const results = {
            success: [],
            notAssigned: [],
            notFound: []
        };

        for (const userIdToUnassign of userIdsToUnassign) {
            const [user] = await db.query('SELECT id FROM users WHERE id = ?', [userIdToUnassign]);
            if (!user || user.length === 0) {
                results.notFound.push(userIdToUnassign);
                continue;
            }

            const [existingAssignment] = await db.query('SELECT * FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToUnassign]);
            if (existingAssignment.length === 0) {
                results.notAssigned.push(userIdToUnassign);
                continue;
            }

            await db.query('DELETE FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToUnassign]);

            await db.query('UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?', [projectId, userIdToUnassign]);

            results.success.push(userIdToUnassign);
        }

        if (results.success.length === 0) {
            if (results.notFound.length > 0 && results.notAssigned.length === 0) {
                return res.status(404).json({
                    msg: "No users unassigned. The provided user ID(s) do not exist.",
                    results
                });
            }
            if (results.notAssigned.length > 0 && results.notFound.length === 0) {
                return res.status(404).json({
                    msg: "No users unassigned. All provided user(s) were not assigned to this project.",
                    results
                });
            }
            return res.status(400).json({
                msg: "No users unassigned. User(s) either do not exist or were not assigned to this project.",
                results
            });
        }

        if (results.notFound.length > 0 || results.notAssigned.length > 0) {
            return res.status(200).json({
                msg: "Some users were unassigned, but some were not (not found or not assigned).",
                results
            });
        }

        return res.status(200).json({
            msg: "Users unassigned successfully from the project and their project tasks.",
            results
        });

    } catch (error) {
        console.log(error);
        next(error);
    }
}
