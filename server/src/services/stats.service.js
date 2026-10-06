import { Action } from '../models/Action.js';
import { Agent } from '../models/Agent.js';

const HOUR_MS = 60 * 60 * 1000;
const roundedAverage = (value) => Number((value || 0).toFixed(2));
const countLevel = (level) => ({ $sum: { $cond: [{ $eq: ['$evaluation.level', level] }, 1, 0] } });

export async function getStats(now = new Date()) {
  const since = new Date(now.getTime() - 24 * HOUR_MS);
  const counts = { $cond: [{ $eq: [{ $type: '$privacy.counts' }, 'object'] }, '$privacy.counts', {}] };
  const [result] = await Action.aggregate([{ $facet: {
    summary: [{ $group: {
      _id: null, evaluated: { $sum: 1 },
      trusted: countLevel('TRUSTED'), suspicious: countLevel('SUSPICIOUS'),
      unsafe: countLevel('UNSAFE'), blocked: countLevel('BLOCKED'),
      avgScore: { $avg: '$evaluation.score' },
      piiItemsShielded: { $sum: { $sum: { $map: {
        input: { $objectToArray: counts }, as: 'entity', in: '$$entity.v',
      } } } },
    } }],
    byAgent: [
      { $group: { _id: '$agent', count: { $sum: 1 }, avgScore: { $avg: '$evaluation.score' } } },
      { $lookup: { from: Agent.collection.name, localField: '_id', foreignField: '_id', as: 'agentInfo' } },
      { $project: { _id: 0, agent: { $ifNull: [{ $arrayElemAt: ['$agentInfo.name', 0] }, 'Unknown agent'] }, count: 1, avgScore: 1 } },
      { $sort: { count: -1, agent: 1 } },
    ],
    hourly: [
      { $match: { createdAt: { $gte: since, $lt: now } } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', since] }, HOUR_MS] } }, count: { $sum: 1 } } },
    ],
  } }]);
  const summary = result.summary[0] || {};
  const hourly = new Map(result.hourly.map((bucket) => [bucket._id, bucket.count]));
  return {
    totals: {
      evaluated: summary.evaluated || 0, trusted: summary.trusted || 0, suspicious: summary.suspicious || 0,
      unsafe: summary.unsafe || 0, blocked: summary.blocked || 0,
    },
    avgScore: roundedAverage(summary.avgScore),
    piiItemsShielded: summary.piiItemsShielded || 0,
    byAgent: result.byAgent.map((row) => ({ ...row, avgScore: roundedAverage(row.avgScore) })),
    last24h: Array.from({ length: 24 }, (_, index) => ({
      hour: new Date(since.getTime() + index * HOUR_MS).toISOString(), count: hourly.get(index) || 0,
    })),
  };
}
