import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseclient";
import "bootstrap/dist/css/bootstrap.min.css";


supabase.auth.signOut();
localStorage.clear();
sessionStorage.clear();

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check for existing session on component mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
    } catch (err) {
      console.error("Error checking session:", err);
    }
  };

  // Fetch user profile with role from BOTH users and profiles tables
  const fetchUserProfile = async (userId) => {
    try {
      // First, get user from users table
      const { data: userProfile, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("Error fetching user:", userError);
      }

      // Then get role from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        alert("User profile not found. Please contact administrator.");
        return;
      }

      // Combine data from both tables
      const userObj = {
        id: userId,
        email: userProfile?.email || email,
        full_name: userProfile?.full_name || email.split('@')[0],
        role: profileData.role,
        profile_image: userProfile?.profile_image,
        phone_number: userProfile?.phone_number
      };

      console.log("User logged in:", userObj);

      // Call onLogin callback if provided
      if (typeof onLogin === "function") {
        onLogin(userObj);
      }

      // Redirect based on role
      redirectBasedOnRole(profileData.role);
    } catch (err) {
      console.error("Error in fetchUserProfile:", err);
      alert("Error loading profile: " + err.message);
    }
  };

  const redirectBasedOnRole = (role) => {
    console.log("Redirecting for role:", role);
    
    switch (role) {
      case "student":
        navigate("/student-dashboard");
        break;
      case "lecturer":
        navigate("/lecturer-dashboard");
        break;
      case "principal_lecturer":
      case "prl":
        navigate("/prl-dashboard");
        break;
      case "program_leader":
      case "pl":
        navigate("/pl-dashboard");
        break;
      default:
        alert("Unknown role: " + role);
        console.error("Unknown role:", role);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("Attempting login with:", email);

      // Sign in using Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        console.error("Auth error:", authError);
        alert("Invalid email or password. Please check your credentials.");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        alert("Login failed. No user data returned.");
        setLoading(false);
        return;
      }

      console.log("Auth successful, user ID:", authData.user.id);

      // Fetch user profile and redirect
      await fetchUserProfile(authData.user.id);
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <h2 className="mb-2">LUCT Reporting System</h2>
                <p className="text-muted">Sign in to your account</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Logging in...
                    </>
                  ) : (
                    "Login"
                  )}
                </button>
              </form>

              <div className="mt-4 p-3 bg-light rounded">
                <p className="mb-2 fw-bold small">Test Accounts:</p>
                <div className="small text-muted">
                  <div className="mb-1">
                    <strong>Student:</strong> student@luct.com / 1234
                  </div>
                  <div className="mb-1">
                    <strong>Lecturer:</strong> lecturer@luct.com / abcd
                  </div>
                  <div className="mb-1">
                    <strong>PRL:</strong> prl@luct.com / prlpass
                  </div>
                  <div>
                    <strong>PL:</strong> pl@luct.com / prpass
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-3">
            <small className="text-muted">
              Faculty of Information Communication Technology
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}