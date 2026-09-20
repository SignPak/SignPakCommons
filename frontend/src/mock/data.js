export const mockUser = {
  firstName: 'Maya',
  surname: 'Rivera',
  initials: 'MR',
  joined: 'September 2026',
}

export const mockCategories = [
  { id: 'daily', label: 'Daily phrases', count: '24 lessons', tone: 'yellow', copy: 'Build a confident vocabulary for the moments that make up your day.' },
  { id: 'work', label: 'Work & career', count: '18 lessons', tone: 'blue', copy: 'Make meetings, introductions and collaboration feel more natural.' },
  { id: 'travel', label: 'Travel', count: '12 lessons', tone: 'red', copy: 'Move through new places with a few thoughtful phrases in your pocket.' },
  { id: 'stories', label: 'Stories & culture', count: '16 lessons', tone: 'green', copy: 'Explore expression, storytelling and the texture of signed language.' },
]

export const mockLessons = [
  { id: 1, title: 'Nice to meet you', level: 'Beginner', duration: '02:14', category: 'daily', image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85' },
  { id: 2, title: 'A warm introduction', level: 'Beginner', duration: '03:08', category: 'daily', image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85' },
  { id: 3, title: 'Where are you from?', level: 'Practice', duration: '01:42', category: 'daily', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=85' },
  { id: 4, title: 'The team check-in', level: 'Practice', duration: '04:20', category: 'work', image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85' },
  { id: 5, title: 'Could you show me?', level: 'Intermediate', duration: '02:51', category: 'work', image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=900&q=85' },
  { id: 6, title: 'Finding your way', level: 'Beginner', duration: '03:32', category: 'travel', image: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=85' },
  { id: 7, title: 'A story in motion', level: 'Advanced', duration: '05:10', category: 'stories', image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=900&q=85' },
]

export const mockAdminStats = [
  ['Total learners', '2,481', '+12.4% this month'],
  ['Lessons watched', '18,392', '+8.2% this month'],
  ['Recordings shared', '6,204', '+21.6% this month'],
]
