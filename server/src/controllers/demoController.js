import { resetDemo } from '../services/demo.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const reset = asyncHandler(async (req, res) => sendSuccess(res, await resetDemo()));
