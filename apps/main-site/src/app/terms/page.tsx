'use client';

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <button onClick={() => router.back()} className="inline-flex items-center text-primary font-medium hover:underline mb-8 gap-2 bg-transparent border-none cursor-pointer">
          <ArrowLeft size={18} />
          Go Back
        </button>
        
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-primary">
          <h1 className="text-4xl font-extrabold mb-8">Terms of Service</h1>
          <p className="text-gray-500 mb-8 font-medium">Last updated: June 1, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            We provide a food delivery marketplace connecting users, couriers, and restaurants. We are not a restaurant or food preparation entity. The restaurants available on our platform operate independently of us and are required to comply with all federal, state, and local laws, rules, regulations, and standards pertaining to the preparation, sale, and marketing of food.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            To use certain features of the service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. We reserve the right to suspend or terminate your account if any information provided during the registration process or thereafter proves to be inaccurate, not current, or incomplete.
          </p>

          <h2>4. Ordering and Payment</h2>
          <p>
            When you place an order through our platform, you agree to pay all amounts owed for such order, including delivery fees and any applicable taxes. Payments are processed securely via our designated third-party payment providers. All sales are final and non-refundable, except as expressly provided in our refund policy.
          </p>

          <h2>5. Prohibited Conduct</h2>
          <p>
            You agree not to use the service for any unlawful purpose or in any way that interrupts, damages, or impairs the service. You may not attempt to gain unauthorized access to our computer systems or engage in any activity that disrupts, diminishes the quality of, interferes with the performance of, or impairs the functionality of, the service.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            In no event shall we be liable for any direct, indirect, incidental, special, or consequential damages, resulting from the use or the inability to use the service, including but not limited to, damages for loss of profits, use, data, or other intangibles, even if we have been advised of the possibility of such damages.
          </p>

          <h2>7. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these terms from time to time at our sole discretion. Therefore, you should review these pages periodically. Your continued use of the website or our service after any such change constitutes your acceptance of the new Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
