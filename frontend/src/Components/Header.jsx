import React, { useContext } from "react";
import { assets } from "../assets/assets";
import { AppContent } from "../Context/AppContext";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent);
  const allowedAdminRoles = ["admin", "pamela", "pascal"];

  const hasAdminAccess = userData
    ? Array.isArray(userData.role)
      ? userData.role.some((role) => allowedAdminRoles.includes(role))
      : allowedAdminRoles.includes(userData.role)
    : false;

  return (
<div className="flex flex-col items-center mt-20 px-160 py-8 text-center text-gray-800 font-bold 
bg-white/10 backdrop-blur-md rounded-2xl border border-white shadow-lg">     


      <h1 className="flex items-center gap-2 text-xl sm:text-3xl font-semibold mb-2">
        Hey {userData ? userData.name : "Servant"}{" "}
        
      </h1>

      <h2 className="text-3xl sm:text-5xl font-bold mb-4">
        Welcome to The Way's Website
      </h2>

      <p className="mb-8 max-w-md">
        Everything that you will need for the service is here!
      </p>

      {/* --- Button Container Start --- */}
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => navigate("/lessons")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Lessons
        </button>
        
        <button 
        onClick={() => navigate("/games")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Games
        </button>
        <button 
         onClick={() => navigate("/activities")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Activities
        </button>
        <button 
         onClick={() => navigate("/camps")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Trips & Camps
        </button>
        <button
          onClick={() => navigate("/chants")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Chants
        </button>
                <button
          onClick={() => navigate("/info")}
        className="border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-100 transition-all">
          Info
        </button>

                {hasAdminAccess && (
          <button
            onClick={() => navigate("/admin")}
            className="border border-gray-500 rounded-full px-8 py-2.5 bg-gray-800 text-white hover:bg-gray-700 transition-all"
          >
            Admin
          </button>
        )}
        
      </div>
      {/* --- Button Container End --- */}
    </div>
  );
};

export default Header;

