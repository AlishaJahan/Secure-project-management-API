import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { db } from '../config/db.js';
dotenv.config();

export const verifyToken = async (req, res, next) => {
    const token = req.headers.access_token
    if (!token) {
        return res.status(400).json({
            msg: 'Token missing'
        })
    }
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN)
        req.user = decoded;  //req.user.id, role(payload in generateToken)

        const [tokenRecord] = await db.query(
            'SELECT user_id FROM access_tokens WHERE access_token = ?', [token]
        );
        if (!tokenRecord || tokenRecord.length === 0) {
            return res.status(401).json({
                msg: 'Session expired or account deleted. Please login again.'
            });
        }

        const [userRecord] = await db.query('SELECT id FROM users WHERE id = ? AND is_deleted = 0', [decoded.id]);
        if (!userRecord || userRecord.length === 0) {
            return res.status(401).json({
                msg: 'Account no longer exists.'
            });
        }
        next()

    } catch (err) {
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                msg: 'Access token expired'
            });
        }

        return res.status(401).json({
            msg: 'Invalid token'
        });
    }
}