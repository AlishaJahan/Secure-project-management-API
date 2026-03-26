import express from 'express';
import dotenv from 'dotenv';

import route from './router/authRoute.js'
import projectRoute from './router/projectRoute.js';
import tasksRoute from './router/taskRoute.js'
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