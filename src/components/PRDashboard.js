import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "bootstrap/dist/css/bootstrap.min.css";
import { supabase } from "../config/supabaseclient";

const PLDashboard = ({ user, onLogout }) => {
  const [myPrograms, setMyPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [summaryReports, setSummaryReports] = useState([]);
  const [lecturerAssignments, setLecturerAssignments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);

  const [assignmentData, setAssignmentData] = useState({
    lecturer_id: "",
    course_id: "",
    class_id: ""
  });

  const [feedbackData, setFeedbackData] = useState({
    feedback_text: "",
    action_items: ""
  });

  const plName = user.full_name || user.email?.split('@')[0].replace('.', ' ').toUpperCase() || 'PL';

  useEffect(() => {
    fetchAllData();
    subscribeToNotifications();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMyPrograms(),
        fetchCourses(),
        fetchLecturers(),
        fetchClasses(),
        fetchSummaryReports(),
        fetchLecturerAssignments(),
        fetchNotifications()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch programs where user is Program Leader
  const fetchMyPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          faculty:faculties(name),
          courses:courses(count)
        `)
        .eq('program_leader_id', user.id);

      if (error) throw error;
      setMyPrograms(data || []);
    } catch (err) {
      console.error("Error fetching programs:", err);
    }
  };

  // Fetch courses in PL's programs
  const fetchCourses = async () => {
    try {
      const { data: programs } = await supabase
        .from('programs')
        .select('id')
        .eq('program_leader_id', user.id);

      if (!programs || programs.length === 0) {
        setCourses([]);
        return;
      }

      const programIds = programs.map(p => p.id);

      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          program:programs(name, code),
          principal_lecturer:users!courses_principal_lecturer_id_fkey(full_name, email)
        `)
        .in('program_id', programIds);

      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  // Fetch all lecturers
  const fetchLecturers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lecturer');

      if (error) throw error;
      setLecturers(data || []);
    } catch (err) {
      console.error("Error fetching lecturers:", err);
    }
  };

  // Fetch classes
  const fetchClasses = async () => {
    try {
      const { data: programs } = await supabase
        .from('programs')
        .select('id')
        .eq('program_leader_id', user.id);

      if (!programs || programs.length === 0) {
        setClasses([]);
        return;
      }

      const programIds = programs.map(p => p.id);

      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          course:courses!inner(
            course_name,
            course_code,
            program_id
          )
        `)
        .in('course.program_id', programIds);

      if (error) throw error;

      const formattedClasses = data.map(cls => ({
        ...cls,
        course_name: cls.course.course_name,
        course_code: cls.course.course_code
      }));

      setClasses(formattedClasses);
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  };

  // Fetch summary reports from PRLs
  const fetchSummaryReports = async () => {
    try {
      const { data: programs } = await supabase
        .from('programs')
        .select('id')
        .eq('program_leader_id', user.id);

      if (!programs || programs.length === 0) {
        setSummaryReports([]);
        return;
      }

      const { data, error } = await supabase
        .from('summary_reports')
        .select(`
          *,
          prl:users!summary_reports_prl_id_fkey(full_name, email),
          course:courses(course_name, course_code),
          feedback:pl_feedback(
            feedback_text,
            action_items,
            created_at
          )
        `)
        .eq('program_leader_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReports = data.map(report => ({
        ...report,
        prl_name: report.prl.full_name,
        prl_email: report.prl.email,
        course_name: report.course.course_name,
        has_feedback: report.feedback.length > 0,
        feedback_data: report.feedback[0] || null
      }));

      setSummaryReports(formattedReports);
    } catch (err) {
      console.error("Error fetching summary reports:", err);
    }
  };

  // Fetch lecturer assignments made by PL
  const fetchLecturerAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('lecturer_assignments')
        .select(`
          *,
          lecturer:users!lecturer_assignments_lecturer_id_fkey(full_name, email),
          course:courses(course_name, course_code),
          class:classes(class_name)
        `)
        .eq('assigned_by', user.id)
        .order('assigned_date', { ascending: false });

      if (error) throw error;

      const formattedAssignments = data.map(assignment => ({
        ...assignment,
        lecturer_name: assignment.lecturer.full_name,
        lecturer_email: assignment.lecturer.email,
        course_name: assignment.course.course_name,
        course_code: assignment.course.course_code,
        class_name: assignment.class.class_name
      }));

      setLecturerAssignments(formattedAssignments);
    } catch (err) {
      console.error("Error fetching assignments:", err);
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
      .channel('pl-notifications')
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

  // Assign module to lecturer
  const handleAssignModule = async (e) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('lecturer_assignments')
        .insert({
          lecturer_id: assignmentData.lecturer_id,
          course_id: assignmentData.course_id,
          class_id: assignmentData.class_id,
          assigned_by: user.id,
          status: 'active'
        })
        .select();

      if (error) throw error;

      alert("Module assigned successfully!");
      setShowAssignForm(false);
      setAssignmentData({ lecturer_id: "", course_id: "", class_id: "" });
      await fetchLecturerAssignments();
    } catch (err) {
      console.error("Error assigning module:", err);
      alert("Failed to assign module: " + err.message);
    }
  };

  // Add feedback to summary report
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSummary) {
      alert("No summary selected");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pl_feedback')
        .upsert({
          summary_report_id: selectedSummary.id,
          pl_id: user.id,
          feedback_text: feedbackData.feedback_text,
          action_items: feedbackData.action_items
        }, {
          onConflict: 'summary_report_id'
        })
        .select();

      if (error) throw error;

      alert("Feedback sent successfully!");
      setShowFeedbackForm(false);
      setSelectedSummary(null);
      setFeedbackData({ feedback_text: "", action_items: "" });
      await fetchSummaryReports();
    } catch (err) {
      console.error("Error submitting feedback:", err);
      alert("Failed to submit feedback: " + err.message);
    }
  };

  // Download Excel
  const downloadExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet([data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), filename);
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
          <h1>Program Leader Dashboard</h1>
          <p className="mb-0">Welcome, {plName}</p>
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

      {/* My Programs */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">My Programs</h2>
        </div>
        <div className="card-body">
          {myPrograms.length > 0 ? (
            <ul className="list-group">
              {myPrograms.map(program => (
                <li key={program.id} className="list-group-item">
                  <strong>{program.name} ({program.code})</strong>
                  <br />
                  <small>Faculty: {program.faculty.name}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No programs assigned as Program Leader.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 d-flex gap-2 flex-wrap">
        <button className="btn btn-success" onClick={() => setShowAssignForm(!showAssignForm)}>
          {showAssignForm ? "Hide" : "Assign"} Module to Lecturer
        </button>
        <button className="btn btn-info" onClick={fetchAllData}>
          Refresh Data
        </button>
      </div>

      {/* Assign Module Form */}
      {showAssignForm && (
        <div className="card mb-4">
          <div className="card-header bg-success text-white">
            <h4 className="mb-0">Assign Module to Lecturer</h4>
          </div>
          <div className="card-body">
            <form onSubmit={handleAssignModule}>
              <div className="mb-3">
                <label className="form-label">Select Lecturer *</label>
                <select 
                  className="form-select"
                  value={assignmentData.lecturer_id}
                  onChange={(e) => setAssignmentData({...assignmentData, lecturer_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Lecturer --</option>
                  {lecturers.map(lecturer => (
                    <option key={lecturer.id} value={lecturer.id}>
                      {lecturer.full_name} ({lecturer.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Select Course *</label>
                <select 
                  className="form-select"
                  value={assignmentData.course_id}
                  onChange={(e) => setAssignmentData({...assignmentData, course_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Select Class *</label>
                <select 
                  className="form-select"
                  value={assignmentData.class_id}
                  onChange={(e) => setAssignmentData({...assignmentData, class_id: e.target.value})}
                  required
                >
                  <option value="">-- Select Class --</option>
                  {classes.filter(cls => cls.course_id === assignmentData.course_id).map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} (Venue: {cls.venue})
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">Assign Module</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courses Overview */}
      <div className="card mb-4">
        <div className="card-header bg-info text-white">
          <h3 className="mb-0">Courses in My Programs</h3>
        </div>
        <div className="card-body">
          {courses.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Program</th>
                    <th>Principal Lecturer</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => (
                    <tr key={course.id}>
                      <td>{course.course_code}</td>
                      <td>{course.course_name}</td>
                      <td>{course.program.name}</td>
                      <td>{course.principal_lecturer?.full_name || 'Not assigned'}</td>
                      <td>{course.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No courses in your programs yet.</p>
          )}
        </div>
      </div>

      {/* Lecturer Assignments */}
      <div className="card mb-4">
        <div className="card-header bg-warning text-dark">
          <h3 className="mb-0">Module Assignments ({lecturerAssignments.length})</h3>
        </div>
        <div className="card-body">
          {lecturerAssignments.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Lecturer</th>
                    <th>Course</th>
                    <th>Class</th>
                    <th>Assigned Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturerAssignments.map(assignment => (
                    <tr key={assignment.id}>
                      <td>{assignment.lecturer_name}</td>
                      <td>{assignment.course_code} - {assignment.course_name}</td>
                      <td>{assignment.class_name}</td>
                      <td>{new Date(assignment.assigned_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge bg-${assignment.status === 'active' ? 'success' : 'secondary'}`}>
                          {assignment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No module assignments yet.</p>
          )}
        </div>
      </div>

      {/* Summary Reports from PRLs */}
      <div className="card mb-4">
        <div className="card-header bg-success text-white">
          <h3 className="mb-0">Summary Reports from Principal Lecturers</h3>
        </div>
        <div className="card-body">
          {summaryReports.length > 0 ? (
            <ul className="list-group">
              {summaryReports.map(report => (
                <li key={report.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <strong>{report.course_name}</strong> - From: {report.prl_name}
                      <br />
                      <small>
                        Period: {new Date(report.reporting_period_start).toLocaleDateString()} - {new Date(report.reporting_period_end).toLocaleDateString()}
                      </small>
                      <br />
                      <small>Total Lectures: {report.total_lectures} | Avg Attendance: {report.average_attendance}%</small>
                      <br />
                      <div className="mt-2">
                        <strong>Highlights:</strong> {report.key_highlights}
                      </div>
                      {report.concerns && (
                        <div className="mt-1">
                          <strong>Concerns:</strong> {report.concerns}
                        </div>
                      )}
                      <div className="mt-1">
                        <strong>Recommendations:</strong> {report.recommendations}
                      </div>
                      {report.has_feedback && (
                        <div className="mt-2 p-2 bg-light rounded">
                          <strong>Your Feedback:</strong>
                          <p className="mb-1">{report.feedback_data.feedback_text}</p>
                          {report.feedback_data.action_items && (
                            <p className="mb-0"><strong>Action Items:</strong> {report.feedback_data.action_items}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedSummary(report);
                          setShowFeedbackForm(true);
                          if (report.has_feedback) {
                            setFeedbackData({
                              feedback_text: report.feedback_data.feedback_text,
                              action_items: report.feedback_data.action_items || ""
                            });
                          }
                        }}
                      >
                        {report.has_feedback ? 'Edit' : 'Add'} Feedback
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => downloadExcel(report, `Summary_${report.course_name}.xlsx`)}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No summary reports received yet.</p>
          )}
        </div>
      </div>

      {/* Feedback Form Modal */}
      {showFeedbackForm && selectedSummary && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Provide Feedback to PRL</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setSelectedSummary(null);
                    setFeedbackData({ feedback_text: "", action_items: "" });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>PRL:</strong> {selectedSummary.prl_name}<br />
                  <strong>Course:</strong> {selectedSummary.course_name}<br />
                  <strong>Period:</strong> {new Date(selectedSummary.reporting_period_start).toLocaleDateString()} - {new Date(selectedSummary.reporting_period_end).toLocaleDateString()}
                </div>

                <form onSubmit={handleFeedbackSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Feedback *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={feedbackData.feedback_text}
                      onChange={(e) => setFeedbackData({...feedbackData, feedback_text: e.target.value})}
                      placeholder="Provide your feedback on this summary report..."
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Action Items</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={feedbackData.action_items}
                      onChange={(e) => setFeedbackData({...feedbackData, action_items: e.target.value})}
                      placeholder="List any specific action items or next steps..."
                    />
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowFeedbackForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit Feedback
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PLDashboard;