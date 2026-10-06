import { Agent } from '../models/Agent.js';
import { Policy } from '../models/Policy.js';
import { Resource } from '../models/Resource.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const listAgents = asyncHandler(async (req, res) => {
  return sendSuccess(res, await Agent.find().select('-__v').sort({ name: 1 }).lean());
});

export const listPolicies = asyncHandler(async (req, res) => {
  return sendSuccess(res, await Policy.find().select('-__v').sort({ key: 1 }).lean());
});

export const listResources = asyncHandler(async (req, res) => {
  const resources = await Resource.find()
    .select('key name dataClass recordCount -_id')
    .sort({ key: 1 })
    .lean();
  return sendSuccess(res, resources);
});
