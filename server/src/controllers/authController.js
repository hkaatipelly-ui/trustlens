import { loginUser, publicUser, registerUser } from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export function createAuthController(config) {
  return {
    register: asyncHandler(async (req, res) => {
      return sendSuccess(res, await registerUser(req.body, config), 201);
    }),
    login: asyncHandler(async (req, res) => {
      return sendSuccess(res, await loginUser(req.body, config));
    }),
    me(req, res) {
      return sendSuccess(res, { user: publicUser(req.user) });
    },
  };
}
