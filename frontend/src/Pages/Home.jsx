import React from "react";
import Navbar from "../Components/Navbar.jsx";
import Header from "../Components/Header.jsx";

const Home = () => {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden text-gray-900 bg-transparent">

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center bg-transparent">
               <Navbar />

        {/* Mobile spacing only */}
        <div className="sm:hidden">
          <br />
          <br />
        </div>

        <Header />
      </div>

    </div>
  );
};

export default Home;
