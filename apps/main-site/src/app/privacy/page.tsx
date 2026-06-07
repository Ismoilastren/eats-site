'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <button onClick={() => router.back()} className="inline-flex items-center text-primary font-medium hover:underline mb-8 gap-2 bg-transparent border-none cursor-pointer">
          <ArrowLeft size={18} />
          Go Back
        </button>
        
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-primary">
          <h1 className="text-4xl font-extrabold mb-8">Privacy Policy</h1>
          <p className="text-gray-500 mb-8 font-medium">Last updated: June 1, 2026</p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, items requested (for delivery services), and other information you choose to provide.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, including to facilitate payments, send receipts, provide products and services you request, and send related information; perform internal operations, including, for example, to prevent fraud and abuse of our services; to troubleshoot software bugs and operational problems.
          </p>

          <h2>3. Sharing of Information</h2>
          <p>
            We may share the information we collect about you as described in this Statement or as described at the time of collection or sharing, including as follows: With Delivery Partners and Restaurants to enable them to provide the services you request. For example, we share your name, phone number, and delivery location with Delivery Partners and Restaurants.
          </p>

          <h2>4. Data Security</h2>
          <p>
            We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction. However, no security system is impenetrable, and we cannot guarantee the security of our databases.
          </p>

          <h2>5. Your Choices</h2>
          <p>
            You may correct your account information at any time by logging into your online or in-app account. If you wish to cancel your account, please email us. Please note that in some cases we may retain certain information about you as required by law, or for legitimate business purposes to the extent permitted by law.
          </p>

          <h2>6. Cookies and Tracking Technologies</h2>
          <p>
            We and our partners use cookies and other identification technologies on our apps, websites, emails, and online ads for purposes described in this policy, including: authenticating users, remembering user preferences and settings, determining the popularity of content, delivering and measuring the effectiveness of advertising campaigns.
          </p>

          <h2>7. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Statement, please contact us at privacy@example.com.
          </p>
        </div>
      </div>
    </div>
  );
}
