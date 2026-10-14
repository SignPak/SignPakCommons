/** Must match CONSENT_VERSION on the backend. Bump both when the notice changes materially. */
export const CONSENT_VERSION = '2026-10-15'

export const consentGiven = (user) => user?.consent?.version === CONSENT_VERSION && Boolean(user?.consent?.acceptedAt)

export const consentPoints = [
  { title: 'What your recordings are for', body: 'Your recordings are used to build the SignPAK Pakistan Sign Language (PSL) dataset and to train and test the sign recognition model. Each submission is linked to your account and the reference video, and stored using the storage service configured for this project (local storage or Google Drive).' },
  { title: 'Your video shows you', body: 'A recording of your hands, face and upper body can identify you. Only record what you are comfortable sharing, and make sure nobody else appears in the frame.' },
  { title: 'Non-commercial use', body: 'This is a non-profit, student-led project. Your recordings are not sold or shared with advertisers. When Google Drive storage is configured, Google processes and stores recordings as a service provider.' },
  { title: 'Account deletion and recording retention', body: 'Deleting your account removes your account and sign-in access, but does not delete submitted recordings or related contribution data. You can request deletion of that stored data through the contact form at any time, before or after deleting your account.' },
  { title: 'Recordings used in released models', body: 'Recordings already used in a released model cannot be removed from that released model, even if the stored recording and related data are deleted after a request.' },
  { title: 'Security', body: 'We take reasonable security measures. As a university research project we cannot accept full liability in the unlikely event of a breach.' },
]
