/** Must match CONSENT_VERSION on the backend. Bump both when the notice changes materially. */
export const CONSENT_VERSION = '2026-10'

export const consentGiven = (user) => user?.consent?.version === CONSENT_VERSION && Boolean(user?.consent?.acceptedAt)

export const consentPoints = [
  { title: 'What your recordings are for', body: 'Your recordings are used to build the SignPAK Pakistan Sign Language (PSL) dataset and to train and test the sign recognition model. Each submission is linked to your account and the reference video, and stored using the storage service configured for this project (local storage or Google Drive).' },
  { title: 'Your video shows you', body: 'A recording of your hands, face and upper body can identify you. Only record what you are comfortable sharing, and make sure nobody else appears in the frame.' },
  { title: 'Non-commercial use', body: 'This is a non-profit, student-led project. Your recordings are not sold or shared with advertisers. When Google Drive storage is configured, Google processes and stores recordings as a service provider.' },
  { title: 'No watching or editing after submitting', body: 'Once submitted, a recording can no longer be watched or edited by you. You can ask the site admins through the contact form to delete your account and recordings.' },
  { title: 'Models already trained', body: 'If a recording has already been used to train a released model, it remains part of that model even after the file is deleted.' },
  { title: 'Security', body: 'We take reasonable security measures. As a university research project we cannot accept full liability in the unlikely event of a breach.' },
]
