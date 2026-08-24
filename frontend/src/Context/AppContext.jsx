import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "react-toastify";
import axios from "../utils/axios";

export const AppContent = createContext();

export const AppContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const getUserData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/user/data`
      );

      if (data.success) {
        setUserData(data.userData);
        return data.userData;
      }

      setUserData(null);
      return null;
    } catch (error) {
      setUserData(null);

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
      const { data } = await axios.get(
        `${backendUrl}/api/auth/is-auth`
      );

      if (data.success) {
        setIsLoggedin(true);

        const user = await getUserData();

        if (!user) {
          setIsLoggedin(false);
          setUserData(null);
        }
      } else {
        setIsLoggedin(false);
        setUserData(null);
      }
    } catch (error) {
      setIsLoggedin(false);
      setUserData(null);

      // Missing/expired token is expected when the user is logged out
      if (
        error.response?.status !== 401 &&
        error.response?.status !== 403
      ) {
        toast.error(
          error.response?.data?.message ||
            "Unable to verify authentication."
        );
      }
    } finally {
      setAuthLoading(false);
    }
  }, [backendUrl, getUserData]);

  useEffect(() => {
    getAuthState();
  }, [getAuthState]);

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