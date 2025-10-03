import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ allowedRoles, user, children }) {
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
