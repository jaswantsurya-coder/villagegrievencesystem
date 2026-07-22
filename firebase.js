import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBEjFdqBGcVn_fce-bLFjacJBltNQiCRjA',
  authDomain: 'grievance-system-e72c5.firebaseapp.com',
  projectId: 'grievance-system-e72c5',
  storageBucket: 'grievance-system-e72c5.firebasestorage.app',
  messagingSenderId: '588141633888',
  appId: '1:588141633888:web:516a05530cbf4322af7e05',
  measurementId: 'G-H5YDV1YPDS',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export { signInWithPopup }
