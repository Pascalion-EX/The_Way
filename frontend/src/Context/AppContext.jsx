import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "react-toastify";
import axios from "../utils/axios";
import globalAxios from "axios";
import { AppContent } from "./AppContent.js";

export const AppContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "";

  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const getUserData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/user/data`
      );

      if (data.success && data.userData) {
        setUserData(data.userData);
        setIsLoggedin(true);
        return data.userData;
      }

      setUserData(null);
      setIsLoggedin(false);
      return null;
    } catch (error) {
      setUserData(null);
      setIsLoggedin(false);

      // Avoid showing an error toast for normal authentication failures
      if (error.response?.status !== 401) {
        toast.error(
          error.response?.data?.message ||
            "Failed to load user information."
        );
      }

      return null;
    }
  }, [backendUrl]);

  const getAuthState = useCallback(async () => {
    try {
      // This endpoint already verifies the cookie and returns the profile.
      return await getUserData();
    } finally {
      setAuthLoading(false);
    }
  }, [getUserData]);

  useEffect(() => {
    getAuthState();
  }, [getAuthState]);

  useEffect(() => {
    const handleError = (error) => {
      if (error.response?.data?.code === "ACCOUNT_BANNED") {
        setIsLoggedin(false);
        setUserData(null);
        toast.error(error.response.data.message, { toastId: "account-banned" });
      }
      if (error.response?.data?.code === "EMAIL_VERIFICATION_REQUIRED") {
        setUserData((prev) => prev ? { ...prev, isAccountVerified: false } : prev);
      }
      return Promise.reject(error);
    };
    const clients = [axios, globalAxios];
    const interceptors = clients.map((client) => client.interceptors.response.use(undefined, handleError));
    return () => clients.forEach((client, index) => client.interceptors.response.eject(interceptors[index]));
  }, []);

  const value = {
    backendUrl,

    isLoggedin,
    setIsLoggedin,

    userData,
    setUserData,

    authLoading,

    getUserData,
    getAuthState,
  };

  return (
    <AppContent.Provider value={value}>
      {children}
    </AppContent.Provider>
  );
};
