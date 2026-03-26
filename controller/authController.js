import bcrypt from 'bcrypt';

import { db } from '../config/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length) {
      return res.status(400).json({
        msg: "User already exist"
      })
    }
    const hashPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (name, email, password_hash, role) VALUES(?,?,?,?)', [name, email, hashPassword, role])
    return res.status(201).json({
      msg: "User register successfully"
    })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ? AND is_deleted = 0', [email]);

    if (users.length === 0) {
      return res.status(400).json({
        msg: "User not found"
      })
    }

    const user = users[0]
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        msg: "Invalid credentials"
      })
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const accessExpiresAt = new Date();
    accessExpiresAt.setMinutes(accessExpiresAt.getMinutes() + 15);


    const [existingRefresh] = await db.query('SELECT id FROM refresh_tokens WHERE user_id = ?', [user.id]);

    if (existingRefresh.length > 0) {
      await db.query('UPDATE refresh_tokens SET token = ?, expires_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [refreshToken, expiresAt, user.id]);
    } else {
      await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?,?)',
        [user.id, refreshToken, expiresAt]);
    }

    const [existingAccess] = await db.query('SELECT id FROM access_tokens WHERE user_id = ?', [user.id]);

    if (existingAccess.length > 0) {
      await db.query('UPDATE access_tokens SET access_token = ?, expiry_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [accessToken, accessExpiresAt, user.id]);
    } else {
      await db.query('INSERT INTO access_tokens (user_id, access_token, expiry_at) VALUES (?,?,?)',
        [user.id, accessToken, accessExpiresAt]);
    }

    return res.status(200).json({
      msg: "login successfull",
      accessToken,
      refreshToken
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

    const [users] = await db.query(
      `SELECT id, name, email, role, created_at FROM users 
             WHERE is_deleted = 0 AND id != ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
      [req.user.id, Number(limit), Number(offset)]
    );

    const [totalResult] = await db.query(
      'SELECT COUNT(*) as total FROM users WHERE is_deleted = 0 AND id != ?',
      [req.user.id]
    );
    const total = totalResult[0].total;

    return res.status(200).json({
      users,
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

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    if (parseInt(id) === currentUserId) {
      return res.status(403).json({
        msg: "You cannot delete your own account."
      });
    }

    const [targetUser] = await db.query('SELECT role FROM users WHERE id = ? AND is_deleted = 0', [id]);
    if (!targetUser || targetUser.length === 0) {
      return res.status(404).json({
        msg: "User already deleted."
      });
    }

    if (targetUser[0].role === 'admin') {
      return res.status(403).json({
        msg: "You cannot delete another admin."
      });
    }

    const [result] = await db.query('UPDATE users SET is_deleted = 1 WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [id]);
    await db.query('DELETE FROM access_tokens WHERE user_id = ?', [id]);

    await db.query('DELETE FROM project_assignments WHERE user_id = ?', [id]);
    await db.query('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [id]);

    return res.status(200).json({
      msg: "User deleted successfully."
    })
  } catch (error) {
    console.log(error);
    next(error);
  }
}

export const logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const token = refresh_token;

    const [tokenRecord] = await db.query('SELECT user_id FROM refresh_tokens WHERE token = ?', [token]);
    if (tokenRecord.length === 0) {
      return res.status(401).json({
        msg: "Invalid token"
      })
    }
    const userId = tokenRecord[0].user_id;

    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM access_tokens WHERE user_id = ?', [userId]);

    return res.status(200).json({
      msg: "Logout successful"
    })

  } catch (error) {
    console.log(error);
    next(error)
  }
}