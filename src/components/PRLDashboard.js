import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "bootstrap/dist/css/bootstrap.min.css";
import { supabase } from "../config/supabaseclient";

const PRLDashboard = ({ user, onLogout }) => {
  const [lecturerReports, setLecturerReports] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [summaryReports, setSummaryReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showSummaryForm, setShowSummaryForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  const [feedbackData, setFeedbackData] = useState({
    feedback_text: "",
    rating: 5,
    status: "reviewed"
  });

  const [summaryData, setSummaryData] = useState({
    program_leader_id: "",
    course_id: "",
    reporting_period_start: "",
    reporting_period_end: "",
    key_highlights: "",
    concerns: "",
    recommendations: ""
  });

  const prlName = user.full_name || user.email?.split('@')[0].replace('.', ' ').toUpperCase() || 'PRL';

  useEffect(() => {
    fetchAllData();
    subscribeToNotifications();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMyCourses(),
        fetchLecturerReports(),
        fetchSummaryReports(),
        fetchNotifications()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch courses where user is PRL
  const fetchMyCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          program:programs(
            name,
            program_leader_id,
            program_leader:users!programs_program_leader_id_fkey(full_name, email)
          )
        `)
        .eq('principal_lecturer_id', user.id);

      if (error) throw error;
      setMyCourses(data || []);
    } catch (err) {
      console.error("Error fetching courses:", err);
    }
  };

  // Fetch all lecture reports for PRL's courses
  const fetchLecturerReports = async () => {
    try {
      // Get course IDs where user is PRL
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('principal_lecturer_id', user.id);

      if (!courses || courses.length === 0) {
        setLecturerReports([]);
        return;
      }

      const courseIds = courses.map(c => c.id);

      const { data, error } = await supabase
        .from('lecture_reports')
        .select(`
          *,
          lecturer:users!lecture_reports_lecturer_id_fkey(full_name, email),
          course:courses(course_name, course_code),
          class:classes(class_name),
          feedback:prl_feedback(
            id,
            feedback_text,
            rating,
            status,
            created_at
          )
        `)
        .in('course_id', courseIds)
        .order('date_of_lecture', { ascending: false });

      if (error) throw error;

      const formattedReports = data.map(report => ({
        ...report,
        lecturer_name: report.lecturer.full_name,
        lecturer_email: report.lecturer.email,
        course_name: report.course.course_name,
        course_code: report.course.course_code,
        class_name: report.class.class_name,
        has_feedback: report.feedback.length > 0,
        feedback_data: report.feedback[0] || null
      }));

      setLecturerReports(formattedReports);
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  // Fetch PRL's summary reports
  const fetchSummaryReports = async () => {
    try {
      const { data, error } = await supabase
        .from('summary_reports')
        .select(`
          *,
          program_leader:users!summary_reports_program_leader_id_fkey(full_name, email),
          course:courses(course_name, course_code),
          feedback:pl_feedback(
            feedback_text,
            action_items,
            created_at
          )
        `)
        .eq('prl_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReports = data.map(report => ({
        ...report,
        pl_name: report.program_leader.full_name,
        course_name: report.course.course_name,
        has_feedback: report.feedback.length > 0,
        feedback_data: report.feedback[0] || null
      }));

      setSummaryReports(formattedReports);
    } catch (err) {
      console.error("Error fetching summary reports:", err);
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
      .channel('prl-notifications')
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

  // Add feedback to lecturer report
  const submitFeedback = async (e) => {
    e.preventDefault();

    if (!selectedReport) {
      alert("No report selected");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('prl_feedback')
        .upsert({
          report_id: selectedReport.id,
          prl_id: user.id,
          feedback_text: feedbackData.feedback_text,
          rating: parseInt(feedbackData.rating),
          status: feedbackData.status
        }, {
          onConflict: 'report_id'
        })
        .select();

      if (error) throw error;

      alert("Feedback submitted successfully!");
      setShowFeedbackForm(false);
      setSelectedReport(null);
      setFeedbackData({ feedback_text: "", rating: 5, status: "reviewed" });
      await fetchLecturerReports();
    } catch (err) {
      console.error("Error submitting feedback:", err);
      alert("Failed to submit feedback: " + err.message);
    }
  };

  // Create summary report for PL
  const submitSummaryReport = async (e) => {
    e.preventDefault();

    try {
      // Calculate statistics from lecturer reports
      const totalLectures = lecturerReports.length;
      const avgAttendance = totalLectures > 0
        ? lecturerReports.reduce((sum, r) => sum + (r.actual_students_present / r.total_registered_students * 100), 0) / totalLectures
        : 0;

      const { data, error } = await supabase
        .from('summary_reports')
        .insert({
          prl_id: user.id,
          program_leader_id: summaryData.program_leader_id,
          course_id: summaryData.course_id,
          reporting_period_start: summaryData.reporting_period_start,
          reporting_period_end: summaryData.reporting_period_end,
          total_lectures: totalLectures,
          average_attendance: avgAttendance.toFixed(2),
          key_highlights: summaryData.key_highlights,
          concerns: summaryData.concerns,
          recommendations: summaryData.recommendations,
          status: 'submitted'
        })
        .select();

      if (error) throw error;

      alert("Summary report sent to Program Leader successfully!");
      setShowSummaryForm(false);
      setSummaryData({
        program_leader_id: "",
        course_id: "",
        reporting_period_start: "",
        reporting_period_end: "",
        key_highlights: "",
        concerns: "",
        recommendations: ""
      });
      await fetchSummaryReports();
    } catch (err) {
      console.error("Error submitting summary:", err);
      alert("Failed to submit summary: " + err.message);
    }
  };

  // Download Excel
  const downloadExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
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
          <h1>Principal Lecturer Dashboard</h1>
          <p className="mb-0">Welcome, {prlName}</p>
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

      {/* My Courses */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h2 className="mb-0">My Courses (as Principal Lecturer)</h2>
        </div>
        <div className="card-body">
          {myCourses.length > 0 ? (
            <ul className="list-group">
              {myCourses.map(course => (
                <li key={course.id} className="list-group-item">
                  <strong>{course.course_code} - {course.course_name}</strong>
                  <br />
                  <small>Program: {course.program.name} | Credits: {course.credits}</small>
                  <br />
                  <small>Program Leader: {course.program.program_leader?.full_name}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No courses assigned as Principal Lecturer.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 d-flex gap-2 flex-wrap">
        <button className="btn btn-success" onClick={() => setShowSummaryForm(!showSummaryForm)}>
          {showSummaryForm ? "Hide" : "Create"} Summary Report for PL
        </button>
        <button className="btn btn-info" onClick={fetchAllData}>
          Refresh Data
        </button>
      </div>

      {/* Summary Report Form */}
      {showSummaryForm && (
        <div className="card mb-4">
          <div className="card-header bg-success text-white">
            <h4 className="mb-0">Create Summary Report for Program Leader</h4>
          </div>
          <div className="card-body">
            <form onSubmit={submitSummaryReport}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Select Course *</label>
                  <select 
                    className="form-select"
                    value={summaryData.course_id}
                    onChange={(e) => {
                      const courseId = e.target.value;
                      const course = myCourses.find(c => c.id === courseId);
                      setSummaryData({
                        ...summaryData,
                        course_id: courseId,
                        program_leader_id: course?.program.program_leader_id || ""
                      });
                    }}
                    required
                  >
                    <option value="">-- Select Course --</option>
                    {myCourses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.course_code} - {course.course_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">Period Start *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={summaryData.reporting_period_start}
                    onChange={(e) => setSummaryData({...summaryData, reporting_period_start: e.target.value})}
                    required
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label">Period End *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={summaryData.reporting_period_end}
                    onChange={(e) => setSummaryData({...summaryData, reporting_period_end: e.target.value})}
                    required
                  />
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Key Highlights *</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={summaryData.key_highlights}
                    onChange={(e) => setSummaryData({...summaryData, key_highlights: e.target.value})}
                    placeholder="Summarize key achievements and positive developments"
                    required
                  />
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Concerns</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={summaryData.concerns}
                    onChange={(e) => setSummaryData({...summaryData, concerns: e.target.value})}
                    placeholder="Any concerns or issues that need attention"
                  />
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Recommendations *</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={summaryData.recommendations}
                    onChange={(e) => setSummaryData({...summaryData, recommendations: e.target.value})}
                    placeholder="Your recommendations for improvement"
                    required
                  />
                </div>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">Submit to Program Leader</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSummaryForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lecturer Reports */}
      <div className="card mb-4">
        <div className="card-header bg-warning text-dark">
          <h3 className="mb-0">Lecturer Reports ({lecturerReports.length})</h3>
        </div>
        <div className="card-body">
          {lecturerReports.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Lecturer</th>
                    <th>Course</th>
                    <th>Week</th>
                    <th>Date</th>
                    <th>Topic</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturerReports.map(report => (
                    <tr key={report.id}>
                      <td>{report.lecturer_name}</td>
                      <td>{report.course_code}</td>
                      <td>{report.week_of_reporting}</td>
                      <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                      <td><small>{report.topic_taught?.substring(0, 50)}...</small></td>
                      <td>{report.actual_students_present}/{report.total_registered_students}</td>
                      <td>
                        <span className={`badge ${report.has_feedback ? 'bg-success' : 'bg-warning'}`}>
                          {report.has_feedback ? 'Reviewed' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-primary me-1"
                          onClick={() => {
                            setSelectedReport(report);
                            setShowFeedbackForm(true);
                            if (report.has_feedback) {
                              setFeedbackData({
                                feedback_text: report.feedback_data.feedback_text,
                                rating: report.feedback_data.rating,
                                status: report.feedback_data.status
                              });
                            }
                          }}
                        >
                          {report.has_feedback ? 'Edit' : 'Add'} Feedback
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => downloadExcel([report], `Report_${report.course_code}_Week${report.week_of_reporting}.xlsx`)}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No lecturer reports received yet.</p>
          )}
        </div>
      </div>

      {/* Feedback Form Modal */}
      {showFeedbackForm && selectedReport && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Provide Feedback</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setSelectedReport(null);
                    setFeedbackData({ feedback_text: "", rating: 5, status: "reviewed" });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Lecturer:</strong> {selectedReport.lecturer_name}<br />
                  <strong>Course:</strong> {selectedReport.course_name} ({selectedReport.course_code})<br />
                  <strong>Week:</strong> {selectedReport.week_of_reporting} | <strong>Date:</strong> {new Date(selectedReport.date_of_lecture).toLocaleDateString()}<br />
                  <strong>Topic:</strong> {selectedReport.topic_taught}
                </div>

                <form onSubmit={submitFeedback}>
                  <div className="mb-3">
                    <label className="form-label">Feedback *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={feedbackData.feedback_text}
                      onChange={(e) => setFeedbackData({...feedbackData, feedback_text: e.target.value})}
                      placeholder="Provide your feedback on this lecture report..."
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Rating (1-5) *</label>
                    <select 
                      className="form-select"
                      value={feedbackData.rating}
                      onChange={(e) => setFeedbackData({...feedbackData, rating: e.target.value})}
                      required
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Satisfactory</option>
                      <option value="2">2 - Needs Improvement</option>
                      <option value="1">1 - Poor</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Status *</label>
                    <select 
                      className="form-select"
                      value={feedbackData.status}
                      onChange={(e) => setFeedbackData({...feedbackData, status: e.target.value})}
                      required
                    >
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                      <option value="needs_improvement">Needs Improvement</option>
                    </select>
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

      {/* My Summary Reports */}
      <div className="card mb-4">
        <div className="card-header bg-info text-white">
          <h3 className="mb-0">My Summary Reports to Program Leader</h3>
        </div>
        <div className="card-body">
          {summaryReports.length > 0 ? (
            <ul className="list-group">
              {summaryReports.map(report => (
                <li key={report.id} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>{report.course_name}</strong><br />
                      <small>
                        Period: {new Date(report.reporting_period_start).toLocaleDateString()} - {new Date(report.reporting_period_end).toLocaleDateString()}
                      </small><br />
                      <small>Sent to: {report.pl_name} | Status: <span className={`badge bg-${report.status === 'approved' ? 'success' : 'warning'}`}>{report.status}</span></small>
                      {report.has_feedback && (
                        <div className="mt-2 p-2 bg-light rounded">
                          <strong>PL Feedback:</strong>
                          <p className="mb-1">{report.feedback_data.feedback_text}</p>
                          {report.feedback_data.action_items && (
                            <p className="mb-0"><strong>Action Items:</strong> {report.feedback_data.action_items}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => downloadExcel([report], `Summary_${report.course_name}.xlsx`)}
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No summary reports created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PRLDashboard;