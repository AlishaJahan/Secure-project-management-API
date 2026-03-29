import { Router } from 'express';
import { login, register, logout, deleteUser, getUsers, refreshToken } from '../controller/authController.js';
import { verifyToken } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validate } from '../middleware/validation.js';
import { registerSchema, loginSchema, logoutSchema, refreshTokenSchema, listQuerySchema } from '../utils/validationSchemas.js';

const route = Router();

route.post('/login', validate(loginSchema), login);
route.post('/logout', validate(logoutSchema), logout);
route.post('/refresh', validate(refreshTokenSchema), refreshToken);

route.post('/register', validate(registerSchema), register);
route.get('/users/list-all-users', verifyToken, authorizeRoles('admin', 'manager'), validate(listQuerySchema), getUsers);
route.delete('/users/:id', verifyToken, authorizeRoles('admin'), deleteUser);

export default route;