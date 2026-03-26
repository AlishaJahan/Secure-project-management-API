import { Router } from "express";
import { authorizeRoles } from '../middleware/roleMiddleware.js'
import { viewProject, viewProjectById, createProject, deleteProject, assignUserToProject, getAssignedProjects, unassignUserFromProject } from "../controller/projectController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validation.js";
import { projectSchema, projectAssignmentSchema, projectUnassignmentSchema, listQuerySchema } from "../utils/schemas.js";

const route = Router();

route.get('/', verifyToken, authorizeRoles("admin", "manager", "user"), validate(listQuerySchema), viewProject);
route.get('/assigned', verifyToken, validate(listQuerySchema), getAssignedProjects);
route.get('/:id', verifyToken, viewProjectById);
route.post('/', verifyToken, authorizeRoles("admin", "manager"), validate(projectSchema), createProject);
route.post('/assign', verifyToken, authorizeRoles("admin", "manager"), validate(projectAssignmentSchema), assignUserToProject);
route.post('/unassign', verifyToken, authorizeRoles("admin", "manager"), validate(projectUnassignmentSchema), unassignUserFromProject);
route.delete('/:id', verifyToken, authorizeRoles("admin"), deleteProject);

export default route;
