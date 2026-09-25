import mongoose from 'mongoose'
import { ROLES, ROLE_LIST } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  surname: { type: String, required: true, trim: true, maxlength: 60 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLE_LIST, default: ROLES.USER },
  connections: {
    github: { type: String, default: null },
    linkedin: { type: String, default: null },
  },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => { delete ret.passwordHash; delete ret.updatedAt; return ret }),
})

export const User = mongoose.model('User', userSchema)
