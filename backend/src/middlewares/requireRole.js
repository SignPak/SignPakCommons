import { forbidden } from '../utils/AppError.js'

/** Use after `authenticate`. */
export const requireRole = (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : next(forbidden()))
