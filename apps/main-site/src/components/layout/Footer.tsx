import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-100 py-8 border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm font-medium">
            © 2026 2(13) Delivery. All rights reserved.
          </p>
          <div className="flex items-center gap-8 text-sm font-medium">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-gray-900 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
