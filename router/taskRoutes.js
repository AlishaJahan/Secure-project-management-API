import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { createTask, deleteTask, updateTask, viewTasks, viewTasksById, unassignTask } from "../controller/taskController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validation.js";
import { taskSchema, taskUpdateSchema, listQuerySchema } from "../utils/validationSchemas.js";


const route = Router();

route.post('/', verifyToken, authorizeRoles("admin", "manager"), validate(taskSchema), createTask);
route.get('/', verifyToken, validate(listQuerySchema), viewTasks);
route.get('/:id', verifyToken, viewTasksById);
route.patch('/:id', verifyToken, authorizeRoles("admin", "user", "manager"), validate(taskUpdateSchema), updateTask);
route.patch('/unassign/:id', verifyToken, authorizeRoles("admin", "manager"), unassignTask);
route.delete('/:id', verifyToken, authorizeRoles("admin"), deleteTask);

export default route;
