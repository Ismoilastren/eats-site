'use client';

import Link from "next/link";
import { UtensilsCrossed, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePersistentForm } from "../../../hooks/usePersistentForm";
import { 
  auth, db, doc, getDoc, setDoc, serverTimestamp,
  signInWithEmailAndPassword, sendPasswordResetEmail, 
  signInWithPopup, GoogleAuthProvider, FacebookAuthProvider,
  getAdditionalUserInfo
} from "@repo/firebase-config";
import { COLLECTIONS } from "@repo/shared-types";
import toast from "react-hot-toast";

const getHumanReadableAuthError = (error: any) => {
  const code = error.code || error.message;
  switch (code) {
    case 'auth/email-already-in-use': return "This email is already registered. Please sign in instead.";
    case 'auth/invalid-email': return "Please enter a valid email address.";
    case 'auth/weak-password': return "Your password is too weak. Please use at least 6 characters.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return "Incorrect email or password. Please try again.";
    case 'auth/user-not-found': return "No account found with this email.";
    case 'auth/missing-password': return "Please enter your password.";
    case 'auth/missing-email': return "Please enter your email address.";
    case 'auth/network-request-failed': return "Check your internet connection and try again.";
    case 'auth/operation-not-allowed': return "This login method is disabled. Please try another method.";
    case 'auth/user-not-found-in-db': return "User profile data is missing. Please contact support.";
    case 'permission-denied': return "Database permission denied. Please check your Firestore security rules.";
    default: return `An error occurred: ${code}`;
  }
};

export default function LoginPage() {
  const router = useRouter();
  
  const [emailForm, setEmailForm] = usePersistentForm('form_draft_login', { email: "" });
  const email = emailForm.email;
  const setEmail = (val: string) => setEmailForm({ email: val });
  
  const [password, setPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

      if (!userDoc.exists()) {
        throw new Error("auth/user-not-found-in-db");
      }

      sessionStorage.removeItem('form_draft_login');
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(getHumanReadableAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setMessage("");
    
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset link sent to your email.");
    } catch (err: any) {
      console.error(err);
      setError(getHumanReadableAuthError(err));
    }
  };

  const handleOAuthLogin = async (provider: any) => {
    setIsOAuthLoading(true);
    setError("");
    setMessage("");

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const details = getAdditionalUserInfo(userCredential);

      // STRICT GUARD: If this is a Login page, reject New Users
      if (details?.isNewUser) {
        await user.delete();
        toast.error("You are not registered! Please go to Sign Up first.");
        return;
      }

      sessionStorage.removeItem('form_draft_login');
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(getHumanReadableAuthError(err));
    } finally {
      setIsOAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-br-full -z-10"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-secondary/5 rounded-tl-full -z-10"></div>
        
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6">
            <div className="bg-primary text-white p-2 rounded-xl shadow-md">
              <UtensilsCrossed size={28} />
            </div>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome back</h2>
          <p className="text-gray-500">Sign in to your account to order food</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm text-center font-medium border border-red-100">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm text-center font-medium border border-green-100">
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="pl-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                  placeholder="you@example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="pl-10 pr-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input id="remember-me" type="checkbox" className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer" />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <div>
            <button 
              type="submit" 
              disabled={isLoading || isOAuthLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-primary/20 text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleOAuthLogin(new GoogleAuthProvider())}
              disabled={isLoading || isOAuthLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-70"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button 
              onClick={() => handleOAuthLogin(new FacebookAuthProvider())}
              disabled={isLoading || isOAuthLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-70"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
              </svg>
              Facebook
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/auth/register" className="font-bold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
