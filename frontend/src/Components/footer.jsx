import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative z-0 mt-auto shrink-0 border-t border-gray-200 bg-white/80 px-4 py-4 text-center text-sm text-gray-500 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <p>© {new Date().getFullYear()} The Way Service. All rights reserved.</p>
        <Link
          to="/privacy-policy"
          className="font-semibold text-gray-600 underline underline-offset-4 hover:text-amber-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600"
        >
          Privacy policy
        </Link>
        <Link
          to="/terms-of-service"
          className="font-semibold text-gray-600 underline underline-offset-4 hover:text-amber-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600"
        >
          Terms of Service
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
