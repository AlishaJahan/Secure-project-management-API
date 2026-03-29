import express from 'express';
import dotenv from 'dotenv';

import route from './router/authRoutes.js'
import projectRoute from './router/projectRoutes.js';
import tasksRoute from './router/taskRoutes.js'
import { error } from './middleware/errorMiddleware.js';
dotenv.config();

const app = express();
app.use(express.json());
app.use('/auth', route);
app.use('/users', route);
app.use('/projects', projectRoute);
app.use('/tasks', tasksRoute);
app.use(error);

app.listen(process.env.PORT, () => {
  console.log(`server is running on port ${process.env.PORT}`);
});