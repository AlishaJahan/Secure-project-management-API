import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { db } from '../config/db.js';
dotenv.config();

export const verifyToken = async (req, res, next) => {
  const token = req.headers.access_token
  console.log(token);
  if (!token) {
    return res.status(400).json({
      status: 400,
      message: 'Token missing',
      error: 'Bad Request'
    })
  }
  try {
    console.log(process.env.ACCESS_TOKEN);
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN)
    req.user = decoded;  //req.user.id, role(payload in generateToken)
    console.log(req.user, 'token')


    const [tokenRecord] = await db.query(
      'SELECT user_id FROM access_tokens WHERE access_token = ?', [token]
    );
    if (!tokenRecord.length) {
      return res.status(401).json({
        status: 401,
        message: 'Session expired or account deleted. Please login again.',
        error: 'Unauthorized'
      });
    }

    const [userRecord] = await db.query('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [decoded.id]);
    if (!userRecord.length) {
      return res.status(401).json({
        status: 401,
        message: 'Account no longer exists.',
        error: 'Unauthorized'
      });
    }
    next()

  } catch (err) {
    console.log(err, 'ERROR')
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 401,
        message: 'Access token expired',
        error: 'Unauthorized'
      });
    }

    return res.status(401).json({
      status: 401,
      message: 'Invalid token',
      error: 'Unauthorized'
    });
  }
}