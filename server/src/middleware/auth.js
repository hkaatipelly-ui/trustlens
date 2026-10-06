import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function authenticate(config) {
  return asyncHandler(async (req, res, next) => {
    const match = req.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      throw new ApiError(401, 'UNAUTHORIZED', 'A Bearer token is required.');
    }

    let payload;
    try {
      payload = jwt.verify(match[1], config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'trustlens',
      });
    } catch {
      throw new ApiError(401, 'INVALID_TOKEN', 'Your token is invalid or expired.');
    }

    if (typeof payload !== 'object' || !mongoose.isObjectIdOrHexString(payload.sub)) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Your token is invalid or expired.');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new ApiError(401, 'INVALID_TOKEN', 'The account for this token no longer exists.');
    }

    req.user = user;
    return next();
  });
}

export function requireRole(...roles) {
  return asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Your role cannot perform this operation.');
    }
    return next();
  });
}
