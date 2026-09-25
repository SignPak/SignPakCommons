/** Shared toJSON transform: `_id` becomes `id`, internals disappear. `extra` can reshape further. */
export const jsonOptions = (extra) => ({
  versionKey: false,
  transform(doc, ret) {
    ret.id = String(ret._id)
    delete ret._id
    return extra ? extra(doc, ret) : ret
  },
})

export const isDuplicateKeyError = (error) => error?.code === 11000
