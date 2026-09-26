const Footer = () => {
  return (
    <footer className="border-t border-gray-200 bg-white/80 px-4 py-4 text-center text-sm text-gray-500 backdrop-blur-md">
      © {new Date().getFullYear()} The Way Service. All rights reserved.
    </footer>
  );
};

export default Footer;