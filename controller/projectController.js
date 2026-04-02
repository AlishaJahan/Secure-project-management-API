import { db } from '../config/db.js';

export const assignUserToProject = async (req, res, next) => {
  try {
    const { projectId, userIdsToAssign } = req.body;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
      return res.status(403).json({
        status: 403,
        message: "Access denied. Only managers and admins can assign users to projects.",
        error: "Forbidden"
      });
    }

    const [project] = await db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [projectId]);

    if (!project.length) {
      return res.status(404).json({
        status: 404,
        message: "Project not found or is deleted.",
        error: "Not Found"
      });
    }

    const results = {
      success: [],
      alreadyAssigned: [],
      notFound: []
    };

    await Promise.all(userIdsToAssign.map(async (userIdToAssign) => {
      const [user] = await db.query('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [userIdToAssign]);
      if (!user.length) {
        results.notFound.push(userIdToAssign);
        return;
      }

      const [existingAssignment] = await db.query('SELECT * FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToAssign]);
      if (existingAssignment.length) {
        results.alreadyAssigned.push(userIdToAssign);
        return;
      }

      await db.query('INSERT INTO project_assignments (project_id, user_id, assigned_by) VALUES (?, ?, ?)', [projectId, userIdToAssign, currentUserId]);
      results.success.push(userIdToAssign);
    }));

    if (!results.success.length) {

      if (results.notFound.length && !results.alreadyAssigned.length) {
        return res.status(404).json({
          status: 404,
          message: "No users assigned. The provided user ID(s) do not exist.",
          error: "Not Found",
          data: { results }
        });
      }

      if (results.alreadyAssigned.length && !results.notFound.length) {
        return res.status(409).json({
          status: 409,
          message: "No users assigned. All provided user(s) are already assigned to this project.",
          error: "Conflict",
          data: { results }
        });
      }

      return res.status(400).json({
        status: 400,
        message: "No users assigned. User(s) either do not exist or are already assigned to this project.",
        error: "Bad Request",
        data: { results }
      });
    }

    if (results.notFound.length || results.alreadyAssigned.length) {
      return res.status(207).json({
        status: 207,
        message: "Some users were assigned, but some could not be assigned.",
        data: { results }
      });
    }

    return res.status(201).json({
      status: 201,
      message: "Project assigned successfully to all users.",
      data: { results }
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
    }

    if (userRole === 'user') {
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

    const [[all_projects], [totalResult]] = await Promise.all([
      db.query(query, [...queryParams, Number(limit), Number(offset)]),
      db.query(countQuery, queryParams)
    ]);

    const total = totalResult[0].total;

    return res.status(200).json({
      status: 200,
      message: "Fetched projects successfully",
      data: {
        all_projects,
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

export const getAssignedProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [assigned_projects] = await db.query(`
            SELECT p.* FROM projects p
            JOIN project_assignments pa ON p.id = pa.project_id
            WHERE pa.user_id = ? 
            AND p.is_deleted = 0
        `, [userId]);

    if (!assigned_projects.length) {
      return res.status(404).json({
        status: 404,
        message: "No projects found assigned to you.",
        error: "Not Found"
      });
    }

    return res.status(200).json({
      status: 200,
      message: "Fetched assigned projects successfully",
      data: { assigned_projects }
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
    }
    if (userRole === 'user') {
      [project] = await db.query(`
                SELECT p.* FROM projects p
                JOIN project_assignments pa ON p.id = pa.project_id
                WHERE p.id = ? AND pa.user_id = ? AND p.is_deleted = 0
            `, [id, userId]);
    }

    if (!project.length) {
      return res.status(404).json({
        status: 404,
        message: "Project not found or you are not authorized",
        error: "Not Found"
      });
    }

    return res.status(200).json({
      status: 200,
      message: "Fetched project details successfully",
      data: { project: project[0] }
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
    if (existingProjects.length) {
      return res.status(409).json({
        status: 409,
        message: "Project with this name already exists!",
        error: "Conflict"
      });
    }

    await db.query('INSERT INTO projects(name, description, created_by) VALUES (?,?,?)',
      [name, description, created_by]);

    return res.status(201).json({
      status: 201,
      message: "Project created successfully",
      data: { created_by: created_by }
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
    if (!result.affectedRows) {
      return res.status(404).json({
        status: 404,
        message: "Project not found or you are not authorized to delete it.",
        error: "Not Found"
      });
    }

    await db.query('DELETE FROM tasks WHERE project_id = ?', [id]);

    return res.status(200).json({
      status: 200,
      message: "Project deleted successfully.",
      data: {}
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
        status: 403,
        message: "Access denied. Only managers and admins can unassign users from projects.",
        error: "Forbidden"
      });
    }

    const [project] = await db.query('SELECT id FROM projects WHERE id = ? AND is_deleted = 0', [projectId]);
    if (!project.length) {
      return res.status(404).json({
        status: 404,
        message: "Project not found or is deleted.",
        error: "Not Found"
      });
    }

    const results = {
      success: [],
      notAssigned: [],
      notFound: []
    };

    await Promise.all(userIdsToUnassign.map(async (userIdToUnassign) => {
      const [user] = await db.query('SELECT id FROM users WHERE id = ?', [userIdToUnassign]);
      if (!user.length) {
        results.notFound.push(userIdToUnassign);
        return;
      }

      const [existingAssignment] = await db.query('SELECT * FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToUnassign]);
      if (!existingAssignment.length) {
        results.notAssigned.push(userIdToUnassign);
        return;
      }

      await Promise.all([
        db.query('DELETE FROM project_assignments WHERE project_id = ? AND user_id = ?', [projectId, userIdToUnassign]),
        db.query('UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?', [projectId, userIdToUnassign])
      ]);

      results.success.push(userIdToUnassign);
    }));

    if (!results.success.length) {
      if (results.notFound.length && !results.notAssigned.length) {
        return res.status(404).json({
          status: 404,
          message: "No users unassigned. The provided user ID(s) do not exist.",
          error: "Not Found",
          data: { results }
        });
      }
      if (results.notAssigned.length && !results.notFound.length) {
        return res.status(404).json({
          status: 404,
          message: "No users unassigned. All provided user(s) were not assigned to this project.",
          error: "Not Found",
          data: { results }
        });
      }
      return res.status(400).json({
        status: 400,
        message: "No users unassigned. User(s) either do not exist or were not assigned to this project.",
        error: "Bad Request",
        data: { results }
      });
    }

    if (results.notFound.length || results.notAssigned.length) {
      return res.status(200).json({
        status: 200,
        message: "Some users were unassigned, but some were not (not found or not assigned).",
        data: { results }
      });
    }

    return res.status(200).json({
      status: 200,
      message: "Users unassigned successfully from the project and their project tasks.",
      data: { results }
    });

  } catch (error) {
    console.log(error);
    next(error);
  }
}
