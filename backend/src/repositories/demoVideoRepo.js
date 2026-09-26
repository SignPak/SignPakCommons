import { DemoVideo } from '../models/DemoVideo.js'

const CURRENT = 'current'

export const demoVideoRepo = {
  find: () => DemoVideo.findById(CURRENT),
  replace: (data) => DemoVideo.findOneAndReplace(
    { _id: CURRENT },
    { _id: CURRENT, ...data },
    { new: true, upsert: true, runValidators: true },
  ),
  remove: () => DemoVideo.findByIdAndDelete(CURRENT),
}
