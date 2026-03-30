import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const generateAccessToken = (user) => {
  return jwt.sign({
    id: user.id,
    role: user.role
  },
    process.env.ACCESS_TOKEN,
    { expiresIn: process.env.ACCESS_TOKEN_EXP_TIME }
  )
}

export const generateRefreshToken = (user) => {
  return jwt.sign({
    id: user.id,
    role: user.role
  },
    process.env.REFRESH_TOKEN,
    { expiresIn: process.env.REFRESH_TOKEN_EXP_TIME }
  )
}
