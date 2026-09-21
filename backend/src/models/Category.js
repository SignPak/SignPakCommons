import mongoose from 'mongoose'
import { TONES } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'

const categorySchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 60 },
  // Lower-cased copy of the label, so "Travel" and "travel" cannot both exist.
  labelKey: { type: String, required: true, unique: true },
  copy: { type: String, default: '', trim: true, maxlength: 240 },
  tone: { type: String, enum: TONES, default: TONES[0] },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => { delete ret.labelKey; delete ret.updatedAt; delete ret.createdAt; return ret }),
})

categorySchema.pre('validate', function setLabelKey() {
  if (this.label) this.labelKey = this.label.trim().toLowerCase()
})

export const Category = mongoose.model('Category', categorySchema)
