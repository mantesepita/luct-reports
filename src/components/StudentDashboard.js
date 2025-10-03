import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "../config/supabaseclient";
import Monitoring from "./MonitoringForm"; // Your existing monitoring component

const criteriaList = [
  "Respects students",
  "Class on time",
  "Speaks English",
  "Available for consultation",
  "Teaches at least 8 hours/week",
  "Explains concepts clearly",
  "Engages students in class",
  "Provides timely feedback",
];

const StudentDashboard = ({ user, onLogout }) => {
  const [ratingCourseName, setRatingCourseName] = useState("");
  const [ratingLecturerName, setRatingLecturerName] = useState("");
  const [ratingValues, setRatingValues] = useState(
    criteriaList.reduce((acc, c) => ({ ...acc, [c]: 0 }), {})
  );
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");

  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [myRatings, setMyRatings] = useState([]);
  const [monitoringRequests, setMonitoringRequests] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const downloadExcel = (data, fileName) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, fileName);
  };

  useEffect(() => {
    fetchAllData();
    subscribeToNotifications();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEnrolledClasses(),
        fetchMyRatings(),
        fetchMonitoringRequests(),
        fetchFeedback(),
        fetchNotifications(),
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrolledClasses = async () => {
    try {
      const { data, error } = await supabase
        .from("student_enrollments")
        .select(`
          *,
          class:classes(
            *,
            course:courses(course_name, course_code)
          )
        `)
        .eq("student_id", user.id)
        .eq("status", "active");

      if (error) throw error;

      const formattedClasses = data.map(enrollment => ({
        ...enrollment.class,
        course_name: enrollment.class.course.course_name,
        course_code: enrollment.class.course.course_code,
      }));

      setEnrolledClasses(formattedClasses);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  const fetchMyRatings = async () => {
    try {
      const { data, error } = await supabase
        .from("student_ratings")
        .select(`
          *,
          lecturer:users!student_ratings_lecturer_id_fkey(full_name),
          class:classes(
            class_name,
            course:courses(course_name)
          )
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedRatings = data.map(rating => ({
        ...rating,
        lecturer_name: rating.lecturer.full_name,
        course_name: rating.class.course.course_name,
        class_name: rating.class.class_name,
      }));

      setMyRatings(formattedRatings);
    } catch (err) {
      console.error("Error fetching ratings:", err);
    }
  };

  const fetchMonitoringRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("monitoring_logs")
        .select(`
          *,
          monitored_by_user:users!monitoring_logs_monitored_by_fkey(full_name),
          class:classes(
            class_name,
            course:courses(course_name)
          )
        `)
        .eq("monitored_user", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedRequests = data.map(req => ({
        ...req,
        course_name: req.class?.course?.course_name || "N/A",
        response: req.action_taken,
      }));

      setMonitoringRequests(formattedRequests);
    } catch (err) {
      console.error("Error fetching monitoring:", err);
    }
  };

  const fetchFeedback = async () => {
    try {
      const { data: enrollments } = await supabase
        .from("student_enrollments")
        .select("class_id")
        .eq("student_id", user.id);

      if (!enrollments || enrollments.length === 0) {
        setFeedbacks([]);
        return;
      }

      const classIds = enrollments.map(e => e.class_id);

      const { data, error } = await supabase
        .from("prl_feedback")
        .select(`
          *,
          report:lecture_reports!prl_feedback_report_id_fkey(
            course:courses(course_name),
            class_id
          )
        `)
        .in("report.class_id", classIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedFeedback = data.map(f => ({
        ...f,
        course_name: f.report.course.course_name,
      }));

      setFeedbacks(formattedFeedback);
    } catch (err) {
      console.error("Error fetching feedback:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel("student-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        payload => {
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const submitRating = async e => {
    e.preventDefault();

    if (!ratingLecturerName) {
      setRatingMessage("Please enter lecturer name");
      return;
    }

    try {
      const { data: lecturer, error } = await supabase
        .from("users")
        .select("id")
        .eq("full_name", ratingLecturerName)
        .eq("role", "lecturer")
        .single();

      if (error || !lecturer) {
        setRatingMessage("Lecturer not found");
        return;
      }

      const criteriaValues = Object.values(ratingValues);
      const avgRating = criteriaValues.reduce((a, b) => a + b, 0) / criteriaValues.length;

      await supabase
        .from("student_ratings")
        .upsert({
          student_id: user.id,
          lecturer_id: lecturer.id,
          class_id: null,
          rating: Math.round(avgRating),
          comment: `${ratingCourseName}\n\nCriteria Ratings:\n${Object.entries(ratingValues)
            .map(([k, v]) => `${k}: ${v}/5`)
            .join("\n")}\n\nFeedback: ${ratingFeedback}`,
        }, { onConflict: "student_id,lecturer_id,class_id" })
        .select();

      setRatingMessage("Rating successfully submitted!");
      setRatingCourseName("");
      setRatingLecturerName("");
      setRatingValues(criteriaList.reduce((acc, c) => ({ ...acc, [c]: 0 }), {}));
      setRatingFeedback("");
      await fetchMyRatings();
    } catch (err) {
      console.error(err);
      setRatingMessage("Failed to submit rating: " + err.message);
    }

    setTimeout(() => setRatingMessage(""), 4000);
  };

  if (loading) return <div style={{ padding: 20, textAlign: "center" }}><h2>Loading...</h2></div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1>Student Dashboard</h1>
          <p>Welcome, {user.full_name} ({user.email})</p>
        </div>
        <button onClick={onLogout} style={{ padding: "10px 20px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: 5, cursor: "pointer" }}>Logout</button>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={{ border: "1px solid #007bff", padding: 15, marginBottom: 20, borderRadius: 5, backgroundColor: "#e7f3ff" }}>
          <h3>Recent Notifications</h3>
          {notifications.slice(0, 3).map((notif, i) => (
            <div key={i} style={{ borderBottom: i < 2 ? "1px solid #ccc" : "none", paddingBottom: 5, marginBottom: 5 }}>
              <strong>{notif.title}</strong>
              <p style={{ margin: "5px 0", fontSize: 14 }}>{notif.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Enrolled Classes */}
      <div style={{ border: "1px solid #ddd", padding: 15, marginBottom: 20, borderRadius: 5 }}>
        <h2>My Enrolled Classes</h2>
        {enrolledClasses.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa" }}>
                <th style={{ padding: 10, border: "1px solid #ddd" }}>Class Name</th>
                <th style={{ padding: 10, border: "1px solid #ddd" }}>Course Code</th>
                <th style={{ padding: 10, border: "1px solid #ddd" }}>Course Name</th>
                <th style={{ padding: 10, border: "1px solid #ddd" }}>Venue</th>
                <th style={{ padding: 10, border: "1px solid #ddd" }}>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {enrolledClasses.map((cls, i) => (
                <tr key={i}>
                  <td style={{ padding: 10, border: "1px solid #ddd" }}>{cls.class_name}</td>
                  <td style={{ padding: 10, border: "1px solid #ddd" }}>{cls.course_code}</td>
                  <td style={{ padding: 10, border: "1px solid #ddd" }}>{cls.course_name}</td>
                  <td style={{ padding: 10, border: "1px solid #ddd" }}>{cls.venue}</td>
                  <td style={{ padding: 10, border: "1px solid #ddd" }}>{cls.scheduled_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No enrolled classes found.</p>}
      </div>

      {/* Rate Lecturer Form */}
      <div style={{ border: "1px solid #ddd", padding: 15, marginBottom: 20, borderRadius: 5, backgroundColor: "#f8f9fa" }}>
        <h2>Rate Lecturer</h2>
        <form onSubmit={submitRating}>
          <div style={{ marginBottom: 10 }}>
            <label>Lecturer Name:</label>
            <input
              type="text"
              placeholder="Enter lecturer full name"
              value={ratingLecturerName}
              onChange={e => setRatingLecturerName(e.target.value)}
              style={{ width: "100%", padding: 8, marginBottom: 5 }}
              required
            />
          </div>

          <input
            type="text"
            placeholder="Course Name"
            value={ratingCourseName}
            onChange={e => setRatingCourseName(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
            required
          />

          <div style={{ marginBottom: 10 }}>
            <p><strong>Rate the following criteria (0-5):</strong></p>
            {criteriaList.map(crit => (
              <div key={crit} style={{ marginBottom: 8 }}>
                <label style={{ display: "inline-block", width: 300 }}>{crit}: </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={ratingValues[crit]}
                  onChange={e => setRatingValues({ ...ratingValues, [crit]: parseInt(e.target.value) || 0 })}
                  style={{ width: 60, padding: 5 }}
                  required
                />
              </div>
            ))}
          </div>

          <textarea
            placeholder="Additional Feedback (optional)"
            value={ratingFeedback}
            onChange={e => setRatingFeedback(e.target.value)}
            style={{ width: "100%", height: 80, padding: 8, marginBottom: 10 }}
          />

          <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 5, cursor: "pointer" }}>Submit Rating</button>
        </form>
        {ratingMessage && (
          <p style={{ color: ratingMessage.includes("success") ? "green" : "red", marginTop: 10 }}>{ratingMessage}</p>
        )}
      </div>

      {/* Existing Monitoring Component */}
      <Monitoring user={user} />

      {/* My Submitted Ratings */}
      <div style={{ border: "1px solid #ddd", padding: 15, marginBottom: 20, borderRadius: 5 }}>
        <h2>My Submitted Ratings</h2>
        {myRatings.length > 0 ? (
          myRatings.map((rating, i) => (
            <div key={i} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
              <p><strong>Lecturer:</strong> {rating.lecturer_name}</p>
              <p><strong>Course:</strong> {rating.course_name}</p>
              <p><strong>Rating:</strong> {rating.rating}/5</p>
              <p><strong>Date:</strong> {new Date(rating.created_at).toLocaleDateString()}</p>
              <button onClick={() => downloadExcel([rating], `Rating_${rating.lecturer_name}.xlsx`)} style={{ marginTop: 5, padding: "5px 10px", cursor: "pointer" }}>Download Excel</button>
            </div>
          ))
        ) : <p>No ratings submitted yet.</p>}
      </div>

      {/* Monitoring Requests */}
      <div style={{ border: "1px solid #ddd", padding: 15, marginBottom: 20, borderRadius: 5 }}>
        <h2>My Monitoring Requests</h2>
        {monitoringRequests.length > 0 ? (
          monitoringRequests.map((req, i) => (
            <div key={i} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
              <p><strong>Course:</strong> {req.course_name}</p>
              <p><strong>Message:</strong> {req.observation}</p>
              <p><strong>Status:</strong> <span style={{ color: req.status === "resolved" ? "green" : req.status === "in_progress" ? "blue" : "orange" }}>{req.status}</span></p>
              <p><strong>Date:</strong> {new Date(req.created_at).toLocaleDateString()}</p>
              {req.response && (
                <div style={{ backgroundColor: "#e7f3ff", padding: 10, marginTop: 5, borderRadius: 3 }}>
                  <strong>Response:</strong> {req.response}
                </div>
              )}
            </div>
          ))
        ) : <p>No monitoring requests sent yet.</p>}
      </div>

      {/* Feedback from PRL */}
      <div style={{ border: "1px solid #ddd", padding: 15, marginBottom: 20, borderRadius: 5 }}>
        <h2>Feedback from Principal Lecturer</h2>
        {feedbacks.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {feedbacks.map((f, i) => (
              <li key={i} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
                <p><strong>Course:</strong> {f.course_name}</p>
                <p><strong>Feedback:</strong> {f.feedback_text}</p>
                <p><strong>Rating:</strong> {f.rating}/5</p>
                <p><strong>Date:</strong> {new Date(f.created_at).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        ) : <p>No feedback received yet.</p>}
      </div>
    </div>
  );
};

export default StudentDashboard;
