import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../config/supabaseclient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) setUser(profile);
      }

      setLoading(false);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile) setUser(profile);
        } else {
          setUser(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      // Get user data from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error("Error fetching user:", userError);
      }

      // Get role from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return null;
      }

      // Combine both
      return {
        id: userId,
        email: userData?.email,
        full_name: userData?.full_name,
        role: profileData.role,
        profile_image: userData?.profile_image,
        phone_number: userData?.phone_number
      };
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      return null;
    }
  };

  const login = (profile) => setUser(profile);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);