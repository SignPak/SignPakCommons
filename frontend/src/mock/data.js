// Seed data used by services/api.js the first time the app runs in a browser.
// Once the Express/MongoDB backend exists, this file can be deleted.

// Public CC0 clip from MDN, used as a stand-in for every base video.
export const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
// Replace with your own file, e.g. '/demo/how-it-works.mp4' placed in frontend/public/demo/
export const DEMO_VIDEO = SAMPLE_VIDEO

export const LEVELS = ['Beginner', 'Practice', 'Intermediate', 'Advanced']
export const TONES = ['yellow', 'blue', 'red', 'green']

export const DEMO_ADMIN = { email: 'admin@signpak.dev', password: 'Admin@123' }

const day = 24 * 60 * 60 * 1000
const now = Date.now()

export const seedUsers = [
  { id: 'user_admin', email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, firstName: 'Admin', surname: 'Signpak', role: 'admin', createdAt: now - 60 * day, connections: {} },
  { id: 'user_maya', email: 'maya@example.com', password: 'Learner@123', firstName: 'Maya', surname: 'Rivera', role: 'user', createdAt: now - 40 * day, connections: {} },
  { id: 'user_omar', email: 'omar@example.com', password: 'Learner@123', firstName: 'Omar', surname: 'Khan', role: 'user', createdAt: now - 25 * day, connections: {} },
  { id: 'user_ayesha', email: 'ayesha@example.com', password: 'Learner@123', firstName: 'Ayesha', surname: 'Malik', role: 'user', createdAt: now - 12 * day, connections: {} },
]

export const seedCategories = [
  { id: 'daily', label: 'Daily phrases', tone: 'yellow', copy: 'Build a confident vocabulary for the moments that make up your day.' },
  { id: 'work', label: 'Work & career', tone: 'blue', copy: 'Make meetings, introductions and collaboration feel more natural.' },
  { id: 'travel', label: 'Travel', tone: 'red', copy: 'Move through new places with a few thoughtful phrases in your pocket.' },
  { id: 'stories', label: 'Stories & culture', tone: 'green', copy: 'Explore expression, storytelling and the texture of signed language.' },
]

const poster = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`
const video = (id, order, title, level, durationSec, categoryId, image) => ({
  id: `video_${id}`, title, level, durationSec, categoryId, order,
  poster: poster(image), videoUrl: SAMPLE_VIDEO, status: 'published', createdAt: now - (30 - id) * day,
})

export const seedVideos = [
  video(1, 1, 'Nice to meet you', 'Beginner', 134, 'daily', 'photo-1551836022-d5d88e9218df'),
  video(2, 2, 'A warm introduction', 'Beginner', 188, 'daily', 'photo-1521737711867-e3b97375f902'),
  video(3, 3, 'Where are you from?', 'Practice', 102, 'daily', 'photo-1529156069898-49953e39b3ac'),
  video(4, 1, 'The team check-in', 'Practice', 260, 'work', 'photo-1556761175-b413da4baf72'),
  video(5, 2, 'Could you show me?', 'Intermediate', 171, 'work', 'photo-1543269865-cbf427effbad'),
  video(6, 1, 'Finding your way', 'Beginner', 212, 'travel', 'photo-1530789253388-582c481c54b0'),
  video(7, 1, 'A story in motion', 'Advanced', 310, 'stories', 'photo-1531058020387-3be344556be6'),
]

// A few past submissions from the demo learners so the admin dashboard has something to chart.
export function buildSeedSubmissions() {
  const plan = [
    ['user_maya', 'video_1', 13], ['user_maya', 'video_2', 11], ['user_maya', 'video_3', 8], ['user_maya', 'video_4', 6],
    ['user_omar', 'video_1', 12], ['user_omar', 'video_6', 9], ['user_omar', 'video_2', 9], ['user_omar', 'video_5', 5], ['user_omar', 'video_7', 2],
    ['user_ayesha', 'video_1', 7], ['user_ayesha', 'video_3', 5], ['user_ayesha', 'video_4', 4], ['user_ayesha', 'video_6', 3], ['user_ayesha', 'video_2', 1],
  ]
  return plan.map(([userId, videoId, daysAgo], index) => ({
    id: `sub_seed_${index}`, userId, videoId, submittedAt: now - daysAgo * day - index * 3600000,
    trimStart: 0, trimEnd: 12, mirrored: false, duration: 12, size: 1_200_000 + index * 40_000, mimeType: 'video/webm',
  }))
}
