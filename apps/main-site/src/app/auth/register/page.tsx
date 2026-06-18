'use client';

import Link from "next/link";
import { UtensilsCrossed, Mail, Lock, User, Phone, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePersistentForm } from "../../../hooks/usePersistentForm";
import { auth, db, doc, setDoc, createUserWithEmailAndPassword, serverTimestamp } from "@repo/firebase-config";
import { COLLECTIONS } from "@repo/shared-types";

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
    case 'permission-denied': return "Database permission denied. Please check your Firestore security rules.";
    default: return `An error occurred: ${code}`;
  }
};

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [termsError, setTermsError] = useState("");

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const [formData, setFormData] = usePersistentForm('form_draft_register', {
    fullName: "",
    email: "",
    phone: "+998",
    password: "",
    termsAccepted: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setTermsError("");

    if (!formData.termsAccepted) {
      setTermsError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      setIsLoading(false);
      return;
    }

    if (formData.phone.length !== 13) {
      setError("Please enter a valid Uzbekistan phone number (9 digits).");
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        uid: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        role: "client",
        source: "website",
        createdAt: serverTimestamp()
      });

      sessionStorage.removeItem('form_draft_register');
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError(getHumanReadableAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
    if (e.target.name === "termsAccepted" && e.target.checked) {
      setTermsError("");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Prevent deleting the country code
    if (!val.startsWith('+998')) {
        val = '+998';
    }
    
    // Extract only numbers after the prefix and limit to 9 digits
    const numbersOnly = val.slice(4).replace(/[^0-9]/g, '');
    const truncated = numbersOnly.slice(0, 9);
    
    setFormData(prev => ({ ...prev, phone: `+998${truncated}` }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 mt-16 relative">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-br-full -z-10"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-secondary/5 rounded-tl-full -z-10"></div>
        
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6">
            <div className="bg-primary text-white p-2 rounded-xl shadow-md">
              <UtensilsCrossed size={28} />
            </div>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Create an account</h2>
          <p className="text-gray-500">Join us to start ordering delicious food</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm text-center font-medium border border-red-100">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input 
                type="text" 
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required 
                className="pl-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                required 
                className="pl-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                placeholder="you@example.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={18} className="text-gray-400" />
              </div>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                required 
                className="pl-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                placeholder="+998 90 123 45 67"
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
                name="password"
                value={formData.password}
                onChange={handleChange}
                required 
                className="pl-10 pr-10 w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-gray-50 focus:bg-white text-gray-900 outline-none" 
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input 
                id="terms" 
                name="termsAccepted"
                type="checkbox" 
                checked={formData.termsAccepted}
                onChange={handleChange}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300 cursor-pointer" 
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-500 cursor-pointer">
                I agree to the <button type="button" onClick={() => setIsTermsModalOpen(true)} className="font-medium text-primary hover:underline bg-transparent border-none p-0 cursor-pointer">Terms of Service</button> and <button type="button" onClick={() => setIsPrivacyModalOpen(true)} className="font-medium text-primary hover:underline bg-transparent border-none p-0 cursor-pointer">Privacy Policy</button>.
              </label>
            </div>
          </div>

          <div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-primary/20 text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Create account"}
            </button>
            
            {termsError && (
              <p className="mt-3 text-sm text-red-500 text-center font-medium">
                {termsError}
              </p>
            )}
          </div>
        </form>
        
        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {/* TERMS MODAL */}
      {isTermsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Terms of Service</h3>
              <button 
                onClick={() => setIsTermsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto prose prose-sm max-w-none text-gray-600">
              <p className="font-medium mb-4">Last updated: June 1, 2026</p>
              <h4 className="text-gray-900">1. Acceptance of Terms</h4>
              <p>By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.</p>
              <h4 className="text-gray-900">2. Description of Service</h4>
              <p>We provide a food delivery marketplace connecting users, couriers, and restaurants. We are not a restaurant or food preparation entity. The restaurants available on our platform operate independently of us and are required to comply with all federal, state, and local laws, rules, regulations, and standards pertaining to the preparation, sale, and marketing of food.</p>
              <h4 className="text-gray-900">3. User Accounts</h4>
              <p>To use certain features of the service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. We reserve the right to suspend or terminate your account if any information provided during the registration process or thereafter proves to be inaccurate, not current, or incomplete.</p>
              <h4 className="text-gray-900">4. Ordering and Payment</h4>
              <p>When you place an order through our platform, you agree to pay all amounts owed for such order, including delivery fees and any applicable taxes. Payments are processed securely via our designated third-party payment providers. All sales are final and non-refundable, except as expressly provided in our refund policy.</p>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsTermsModalOpen(false)}
                className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY MODAL */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Privacy Policy</h3>
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto prose prose-sm max-w-none text-gray-600">
              <p className="font-medium mb-4">Last updated: June 1, 2026</p>
              <h4 className="text-gray-900">1. Information We Collect</h4>
              <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, items requested (for delivery services), and other information you choose to provide.</p>
              <h4 className="text-gray-900">2. How We Use Your Information</h4>
              <p>We use the information we collect to provide, maintain, and improve our services, including to facilitate payments, send receipts, provide products and services you request, and send related information; perform internal operations, including, for example, to prevent fraud and abuse of our services; to troubleshoot software bugs and operational problems.</p>
              <h4 className="text-gray-900">3. Sharing of Information</h4>
              <p>We may share the information we collect about you as described in this Statement or as described at the time of collection or sharing, including as follows: With Delivery Partners and Restaurants to enable them to provide the services you request. For example, we share your name, phone number, and delivery location with Delivery Partners and Restaurants.</p>
              <h4 className="text-gray-900">4. Data Security</h4>
              <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. However, no security system is impenetrable, and we cannot guarantee the security of our databases.</p>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
