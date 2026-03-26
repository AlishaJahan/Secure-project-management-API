import * as yup from 'yup';

export const registerSchema = yup.object({
  body: yup.object({
    name: yup.string()
      .required("Name is required")
      .matches(/^[A-Za-z\s]+$/, "Name must contain only alphabets and spaces"),
    email: yup.string()
      .required("Email is required")
      .email("Invalid email format"),
    password: yup.string()
      .required("Password is required")
      .min(8, "Password must be at least 8 characters"),
    role: yup.string().oneOf(['admin', 'manager', 'user']).optional()
  })
});

export const loginSchema = yup.object({
  body: yup.object({
    email: yup.string()
      .required("Email is required")
      .email("Invalid email format"),
    password: yup.string()
      .required("Password is required")
  })
});

export const refreshTokenSchema = yup.object({
  body: yup.object({
    refreshToken: yup.string().required("Refresh token missing !")
  })
});

export const logoutSchema = yup.object({
  body: yup.object({
    refresh_token: yup.string().required("Refresh token required")
  })
});

export const projectSchema = yup.object({
  body: yup.object({
    name: yup.string().trim().required("Name is required and cannot be empty!"),
    description: yup.string().trim().required("Description is required and cannot be empty!")
  })
});

export const projectAssignmentSchema = yup.object({
  body: yup.object({
    projectId: yup.number().required("Project ID is required"),
    userIdsToAssign: yup.array()
      .of(yup.number())
      .min(1, "An array of User IDs to assign project are required.")
      .required("User IDs array is required")
  })
});

export const projectUnassignmentSchema = yup.object({
  body: yup.object({
    projectId: yup.number().required("Project ID is required"),
    userIdsToUnassign: yup.array()
      .of(yup.number())
      .min(1, "An array of User IDs to unassign are required.")
      .required("User IDs array is required")
  })
});

export const taskSchema = yup.object({
  body: yup.object({
    title: yup.string().required("Title is required."),
    project_id: yup.number().required("Project ID is required."),
    assigned_to: yup.number().required("Assigned user ID is required."),
    description: yup.string().optional()
  })
});

export const taskUpdateSchema = yup.object({
  body: yup.object({
    status: yup.string()
      .oneOf(['todo', 'in_progress', 'done'], "Invalid status")
      .required("Status is required")
  }),
  params: yup.object({
    id: yup.number().required("Task ID is required")
  })
});

export const listQuerySchema = yup.object({
  query: yup.object({
    page: yup.number().integer().positive().default(1),
    limit: yup.number().integer().positive().default(10),
    sortBy: yup.string().optional(),
    order: yup.string().oneOf(['ASC', 'DESC']).default('DESC')
  })
});
