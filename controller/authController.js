import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

import { db } from '../config/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length) {
      return res.status(400).json({
        status: 400,
        message: "User already exist",
        error: "Bad Request"
      })
    }
    const hashPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (name, email, password_hash, role) VALUES(?,?,?,?)', [name, email, hashPassword, role])
    return res.status(201).json({
      status: 201,
      message: "User register successfully",
      data: {}
    })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ? AND is_deleted = 0', [email]);

    if (!users.length) {
      return res.status(400).json({
        status: 400,
        message: "User not found",
        error: "Bad Request"
      })
    }

    const user = users[0]
    const comparePassword = await bcrypt.compare(password, user.password_hash);

    if (!comparePassword) {
      return res.status(401).json({
        status: 401,
        message: "Invalid credentials",
        error: "Unauthorized"
      })
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    const refreshExpDays = parseInt(process.env.REFRESH_TOKEN_EXP_DAYS) || 7;
    expiresAt.setDate(expiresAt.getDate() + refreshExpDays);

    const accessExpiresAt = new Date();
    const accessExpMinutes = parseInt(process.env.ACCESS_TOKEN_EXP_MINUTES) || 15;
    accessExpiresAt.setMinutes(accessExpiresAt.getMinutes() + accessExpMinutes);


    // Parallelize initial check for existing tokens
    const [[existingRefreshToken], [existingAccessToken]] = await Promise.all([
      db.query('SELECT id FROM refresh_tokens WHERE user_id = ?', [user.id]),
      db.query('SELECT id FROM access_tokens WHERE user_id = ?', [user.id])
    ]);

    const updateQueries = [];

    // Handle Refresh Token
    if (existingRefreshToken.length) {
      updateQueries.push(db.query('UPDATE refresh_tokens SET token = ?, expires_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [refreshToken, expiresAt, user.id]));
    }
    if (!existingRefreshToken.length) {
      updateQueries.push(db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
        [user.id, refreshToken, expiresAt]));
    }

    // Handle Access Token
    if (existingAccessToken.length) {
      updateQueries.push(db.query('UPDATE access_tokens SET access_token = ?, expiry_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [accessToken, accessExpiresAt, user.id]));
    }
    if (!existingAccessToken.length) {
      updateQueries.push(db.query('INSERT INTO access_tokens (user_id, access_token, expiry_at) VALUES (?,?,?)',
        [user.id, accessToken, accessExpiresAt]));
    }

    // Execute all updates in parallel
    await Promise.all(updateQueries);

    return res.status(200).json({
      status: 200,
      message: "login successfull",
      data: {
        accessToken,
        refreshToken
      }
    })

  } catch (error) {
    console.log(error);
    next(error)
  }
}

export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Parallelize fetching users and the total count for pagination
    const [[users], [totalResult]] = await Promise.all([
      db.query(`SELECT id, name, email, role, created_at FROM users WHERE is_deleted = 0 AND id != ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [req.user.id, Number(limit), Number(offset)]),
      db.query('SELECT COUNT(*) as total FROM users WHERE is_deleted = 0 AND id != ?',
        [req.user.id])
    ]);

    const total = totalResult[0].total;

    return res.status(200).json({
      status: 200,
      message: "Fetched all users",
      data: {
        users,
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

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    if (parseInt(id) === currentUserId) {
      return res.status(403).json({
        status: 403,
        message: "You cannot delete your own account.",
        error: "Forbidden"
      });
    }

    const [targetUser] = await db.query('SELECT role FROM users WHERE id = ? AND is_deleted = 0', [id]);
    if (!targetUser || !targetUser.length) {
      return res.status(400).json({
        status: 400,
        message: "User already deleted.",
        error: "Bad Request"
      });
    }

    if (targetUser[0].role === 'admin') {
      return res.status(400).json({
        status: 400,
        message: "You cannot delete another admin.",
        error: "Bad Request"
      });
    }

    const [result] = await db.query('UPDATE users SET is_deleted = 1 WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
        error: "Not Found"
      });
    }

    // Parallelize the cleanup of all related user records
    await Promise.all([
      db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [id]),
      db.query('DELETE FROM access_tokens WHERE user_id = ?', [id]),
      db.query('DELETE FROM project_assignments WHERE user_id = ?', [id]),
      db.query('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [id])
    ]);

    return res.status(200).json({
      status: 200,
      message: "User deleted successfully.",
      data: {}
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
}

export const logout = async (req, res, next) => {
  try {
    const token = req.headers.refresh_token;

    if (!token) {
      return res.status(400).json({
        status: 400,
        message: "Refresh token missing in headers",
        error: "Bad Request"
      });
    }

    const [tokenRecord] = await db.query('SELECT user_id FROM refresh_tokens WHERE token = ?', [token]);
    if (!tokenRecord.length) {
      return res.status(401).json({
        status: 401,
        message: "Invalid token",
        error: "Unauthorized"
      });
    }
    const userId = tokenRecord[0].user_id;

    // Parallelize the deletion of both refresh and access tokens
    await Promise.all([
      db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]),
      db.query('DELETE FROM access_tokens WHERE user_id = ?', [userId])
    ]);

    return res.status(200).json({
      status: 200,
      message: "Logout successful",
      data: {}
    })

  } catch (error) {
    console.log(error);
    next(error)
  }
}

export const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.headers.refresh_token;

    if (!refreshToken) {
      return res.status(400).json({
        status: 400,
        message: "Refresh token missing in headers",
        error: "Bad Request"
      });
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);

    const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE user_id = ?', [decoded.id]);

    const tokenRecord = rows[0];
    if (!tokenRecord || tokenRecord.token !== refreshToken) {
      return res.status(401).json({
        status: 401,
        message: "Invalid token",
        error: "Unauthorized"
      })
    }

    const newAccessToken = generateAccessToken(decoded);

    const accessExpiresAt = new Date();
    accessExpiresAt.setMinutes(accessExpiresAt.getMinutes() + 15);

    await db.query('UPDATE access_tokens SET access_token = ?, expiry_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newAccessToken, accessExpiresAt, decoded.id]);

    return res.status(200).json({
      status: 200,
      message: "Token refreshed successfully",
      data: {
        newAccessToken: newAccessToken
      }
    })
  } catch (error) {
    console.log(error);
    next(error);
  }
}