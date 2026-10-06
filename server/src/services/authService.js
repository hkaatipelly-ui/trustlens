import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export function publicUser(user) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sessionFor(user, config) {
  const token = jwt.sign({}, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'trustlens',
    expiresIn: config.JWT_EXPIRES_IN,
  });
  return { token, user: publicUser(user) };
}

export async function registerUser({ name, email, password }, config) {
  if (await User.exists({ email })) {
    throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  return sessionFor(user, config);
}

export async function loginUser({ email, password }, config) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return sessionFor(user, config);
}
