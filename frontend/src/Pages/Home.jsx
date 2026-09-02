import React from "react";
import Navbar from "../Components/Navbar.jsx";
import Header from "../Components/Header.jsx";
import Waves from "../Components/Waves.jsx";

const Home = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(110, 110, 110, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={60}
          waveAmpY={40}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center">

        <Navbar />

        {/* Mobile spacing only */}
        <div className="sm:hidden">
          <br />
          <br />
        </div>

        <Header />
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/80 px-4 py-4 text-center text-sm text-gray-500 backdrop-blur-md">
        © {new Date().getFullYear()} The Way Service. All rights reserved.
      </footer>

    </div>
  );
};

export default Home;