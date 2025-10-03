import React, { useState, useEffect } from "react";
import MonitoringForm from "./MonitoringForm";
import LecturerReportForm from "./LecturerReportForm";
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "../config/supabaseclient";

const LecturerDashboard = ({ user, onLogout }) => {
  const [assignedModules, setAssignedModules] = useState([]);
  const [reports, setReports] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [studentRatings, setStudentRatings] = useState([]);
  const [monitoringLogs, setMonitoringLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showMonitoringForm, setShowMonitoringForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const lecturerName = user.full_name || user.email?.split('@')[0].replace('.', ' ').toUpperCase() || 'USER';

  // Download Excel helper
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
        fetchAssignedModules(),
        fetchReports(),
        fetchFeedbacks(),
        fetchStudentRatings(),
        fetchMonitoringLogs(),
        fetchNotifications()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch assigned modules (courses/classes assigned by PL)
  const fetchAssignedModules = async () => {
    try {
      const { data, error } = await supabase
        .from('lecturer_assignments')
        .select(`
          *,
          course:courses(
            course_name,
            course_code,
            credits
          ),
          class:classes(
            class_name,
            venue,
            scheduled_time,
            scheduled_days,
            total_registered_students
          ),
          assigned_by_user:users!lecturer_assignments_assigned_by_fkey(
            full_name,
            email
          )
        `)
        .eq('lecturer_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const formattedModules = data.map(assignment => ({
        id: assignment.id,
        course_code: assignment.course.course_code,
        course_name: assignment.course.course_name,
        class_name: assignment.class.class_name,
        venue: assignment.class.venue,
        scheduled_time: assignment.class.scheduled_time,
        scheduled_days: assignment.class.scheduled_days,
        total_students: assignment.class.total_registered_students,
        assigned_by: assignment.assigned_by_user?.full_name || 'N/A',
        assigned_date: assignment.assigned_date,
        course_id: assignment.course_id,
        class_id: assignment.class_id
      }));

      setAssignedModules(formattedModules);
    } catch (err) {
      console.error("Error fetching modules:", err);
    }
  };

  // Fetch lecturer's reports
  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('lecture_reports')
        .select(`
          *,
          course:courses(course_name, course_code),
          class:classes(class_name),
          feedback:prl_feedback(
            feedback_text,
            rating,
            status,
            created_at
          )
        `)
        .eq('lecturer_id', user.id)
        .order('date_of_lecture', { ascending: false });

      if (error) throw error;

      const formattedReports = data.map(report => ({
        ...report,
        course_name: report.course.course_name,
        course_code: report.course.course_code,
        class_name: report.class.class_name,
        has_feedback: report.feedback.length > 0,
        feedback_data: report.feedback[0] || null
      }));

      setReports(formattedReports);
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  // Fetch PRL feedbacks on reports
  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('prl_feedback')
        .select(`
          *,
          report:lecture_reports!prl_feedback_report_id_fkey(
            course:courses(course_name),
            week_of_reporting,
            date_of_lecture
          ),
          prl:users!prl_feedback_prl_id_fkey(full_name)
        `)
        .eq('report.lecturer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedFeedbacks = data.map(fb => ({
        ...fb,
        course_name: fb.report.course.course_name,
        week_of_reporting: fb.report.week_of_reporting,
        prl_name: fb.prl.full_name
      }));

      setFeedbacks(formattedFeedbacks);
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
    }
  };

  // Fetch student ratings received by lecturer
  const fetchStudentRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('student_ratings')
        .select(`
          *,
          student:users!student_ratings_student_id_fkey(full_name, email),
          class:classes(
            class_name,
            course:courses(course_name)
          )
        `)
        .eq('lecturer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRatings = data.map(rating => ({
        ...rating,
        student_name: rating.student.full_name,
        student_email: rating.student.email,
        course_name: rating.class.course.course_name,
        class_name: rating.class.class_name
      }));

      setStudentRatings(formattedRatings);
    } catch (err) {
      console.error("Error fetching ratings:", err);
    }
  };

  // Fetch monitoring logs (requests from students)
  const fetchMonitoringLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('monitoring_logs')
        .select(`
          *,
          monitored_user_profile:users!monitoring_logs_monitored_user_fkey(
            full_name,
            email
          ),
          class:classes(
            class_name,
            course:courses(course_name)
          )
        `)
        .eq('monitored_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLogs = data.map(log => ({
        ...log,
        student_name: log.monitored_user_profile.full_name,
        student_email: log.monitored_user_profile.email,
        course_name: log.class?.course?.course_name || 'N/A'
      }));

      setMonitoringLogs(formattedLogs);
    } catch (err) {
      console.error("Error fetching monitoring:", err);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  // Subscribe to real-time notifications
  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('lecturer-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Add report
  const addReport = async (report) => {
    try {
      const { data, error } = await supabase
        .from('lecture_reports')
        .insert({
          lecturer_id: user.id,
          class_id: report.class_id,
          course_id: report.course_id,
          faculty_name: report.faculty_name,
          week_of_reporting: report.week_of_reporting,
          date_of_lecture: report.date_of_lecture,
          venue: report.venue,
          scheduled_time: report.scheduled_time,
          actual_students_present: report.actual_students_present,
          total_registered_students: report.total_registered_students,
          topic_taught: report.topic_taught,
          learning_outcomes: report.learning_outcomes,
          lecturer_recommendations: report.lecturer_recommendations,
          status: 'submitted'
        })
        .select()
        .single();

      if (error) throw error;

      alert("Report submitted successfully!");
      fetchReports();
      setShowReportForm(false);
    } catch (err) {
      console.error("Error adding report:", err);
      alert("Failed to submit report: " + err.message);
    }
  };

  // Respond to monitoring request
  const respondToMonitoring = async (logId, response, newStatus) => {
    try {
      const { error } = await supabase
        .from('monitoring_logs')
        .update({
          action_taken: response,
          status: newStatus
        })
        .eq('id', logId);

      if (error) throw error;

      alert("Response sent successfully!");
      fetchMonitoringLogs();
    } catch (err) {
      console.error("Error responding:", err);
      alert("Failed to send response: " + err.message);
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notifId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error("Error marking notification:", err);
    }
  };

  // Toggle forms
  const toggleReportForm = () => {
    setShowReportForm(!showReportForm);
    setShowMonitoringForm(false);
  };

  const toggleMonitoringForm = () => {
    setShowMonitoringForm(!showMonitoringForm);
    setShowReportForm(false);
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Lecturer Dashboard</h1>
          <p className="mb-0">Welcome, {lecturerName}</p>
          <small className="text-muted">{user.email}</small>
        </div>
        <button className="btn btn-danger" onClick={onLogout}>Logout</button>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="alert alert-info">
          <h5>🔔 New Notifications ({notifications.length})</h5>
          {notifications.slice(0, 3).map((notif, i) => (
            <div key={i} className="mb-2 pb-2 border-bottom">
              <strong>{notif.title}</strong>
              <p className="mb-1 small">{notif.message}</p>
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={() => markNotificationRead(notif.id)}
              >
                Mark as Read
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assigned Modules */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">My Assigned Modules</h2>
        </div>
        <div className="card-body">
          {assignedModules.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Class</th>
                    <th>Venue</th>
                    <th>Schedule</th>
                    <th>Students</th>
                    <th>Assigned By</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedModules.map(module => (
                    <tr key={module.id}>
                      <td>{module.course_code}</td>
                      <td>{module.course_name}</td>
                      <td>{module.class_name}</td>
                      <td>{module.venue}</td>
                      <td>{module.scheduled_days} at {module.scheduled_time}</td>
                      <td>{module.total_students}</td>
                      <td><small>{module.assigned_by}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No modules assigned yet. Contact your Program Leader.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-4">
        <button className="btn btn-primary me-2" onClick={toggleReportForm}>
          {showReportForm ? "Hide Report Form" : "Submit New Report"}
        </button>
        <button className="btn btn-success me-2" onClick={toggleMonitoringForm}>
          {showMonitoringForm ? "Hide Monitoring" : "View Monitoring Requests"}
        </button>
        <button className="btn btn-info" onClick={fetchAllData}>
          Refresh Data
        </button>
      </div>

      {/* Conditional Forms */}
      {showReportForm && (
        <LecturerReportForm 
          user={user}
          assignedModules={assignedModules}
          onSubmit={addReport}
          onCancel={() => setShowReportForm(false)}
        />
      )}

      {showMonitoringForm && (
        <MonitoringForm 
          user={user}
          monitoringLogs={monitoringLogs}
          onRespond={respondToMonitoring}
        />
      )}

      {/* Submitted Reports */}
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <h3 className="mb-0">My Submitted Reports</h3>
        </div>
        <div className="card-body">
          {reports.length > 0 ? (
            <ul className="list-group">
              {reports.map(r => (
                <li key={r.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{r.course_code} - {r.course_name}</strong>
                      <br />
                      <small>Week {r.week_of_reporting} | {new Date(r.date_of_lecture).toLocaleDateString()}</small>
                      <br />
                      <small>Attendance: {r.actual_students_present}/{r.total_registered_students}</small>
                      <br />
                      <small>Status: <span className={`badge bg-${r.status === 'approved' ? 'success' : r.status === 'submitted' ? 'warning' : 'secondary'}`}>
                        {r.status}
                      </span></small>
                      {r.has_feedback && (
                        <div className="mt-2 p-2 bg-light rounded">
                          <strong>PRL Feedback:</strong>
                          <p className="mb-1">{r.feedback_data.feedback_text}</p>
                          <small>Rating: {r.feedback_data.rating}/5 | Status: {r.feedback_data.status}</small>
                        </div>
                      )}
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => downloadExcel([r], `${r.course_code}_Report_Week${r.week_of_reporting}.xlsx`)}
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No reports submitted yet.</p>
          )}
        </div>
      </div>

      {/* PRL Feedbacks */}
      <div className="card mb-4">
        <div className="card-header bg-info text-white">
          <h3 className="mb-0">Feedback from Principal Lecturer</h3>
        </div>
        <div className="card-body">
          {feedbacks.length > 0 ? (
            <ul className="list-group">
              {feedbacks.map(fb => (
                <li key={fb.id} className="list-group-item">
                  <strong>{fb.course_name} - Week {fb.week_of_reporting}</strong>
                  <p className="mb-1 mt-2">{fb.feedback_text}</p>
                  <small className="text-muted">
                    Rating: {fb.rating}/5 | By: {fb.prl_name} | {new Date(fb.created_at).toLocaleDateString()}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No feedback received yet.</p>
          )}
        </div>
      </div>

      {/* Student Ratings Received */}
      <div className="card mb-4">
        <div className="card-header bg-warning text-dark">
          <h3 className="mb-0">Student Ratings</h3>
        </div>
        <div className="card-body">
          {studentRatings.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRatings.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.student_name}</td>
                      <td>{r.course_name}</td>
                      <td>
                        <span className="badge bg-primary">{r.rating}/5</span>
                      </td>
                      <td><small>{r.comment || 'No comment'}</small></td>
                      <td><small>{new Date(r.created_at).toLocaleDateString()}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No ratings received yet.</p>
          )}
        </div>
      </div>

      {/* Monitoring Requests Summary */}
      <div className="card mb-4">
        <div className="card-header bg-secondary text-white">
          <h3 className="mb-0">Monitoring Requests ({monitoringLogs.length})</h3>
        </div>
        <div className="card-body">
          {monitoringLogs.length > 0 ? (
            <p>You have {monitoringLogs.filter(l => l.status === 'open').length} open requests. 
               Click "View Monitoring Requests" button above to manage them.</p>
          ) : (
            <p className="text-muted">No monitoring requests.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;