import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import { db } from '../config/db.js';
import { generateAccessToken } from '../utils/generateToken.js';
dotenv.config();

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);

        const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE user_id = ?', [decoded.id]);

        const tokenRecord = rows[0];
        if (!tokenRecord || tokenRecord.token !== refreshToken) {
            return res.status(401).json({
                msg: "Invalid token"
            })
        }

        const newAccessToken = generateAccessToken(decoded);

        const accessExpiresAt = new Date();
        accessExpiresAt.setMinutes(accessExpiresAt.getMinutes() + 15);

        await db.query('UPDATE access_tokens SET access_token = ?, expiry_at = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [newAccessToken, accessExpiresAt, decoded.id]);

        return res.status(200).json({
            newAccessToken: newAccessToken
        })
    } catch (error) {
        console.log(error);
        next(error);
    }
}