import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const LecturerReportForm = ({ apiBaseUrl = 'http://localhost:5000/api', user = {} }) => {
  const [formData, setFormData] = useState({
    facultyName: 'Faculty of Information Communication Technology',
    className: '',
    weekOfReporting: '',
    dateOfLecture: '',
    courseName: '',
    courseCode: '',
    lecturerName: user.name || '',
    actualPresent: '',
    totalRegistered: '',
    venue: '',
    scheduledTime: '',
    topicTaught: '',
    learningOutcomes: '',
    recommendations: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const classOptions = [
    'DIWA2110 - Web Application Development',
    'PROG2111 - Programming Fundamentals', 
    'DBMS2112 - Database Management Systems',
    'NETS2113 - Computer Networks',
    'SOFT2114 - Software Engineering',
    'PROJ3115 - Final Year Project'
  ];

  const courseOptions = [
    { code: 'DIWA2110', name: 'Web Application Development' },
    { code: 'PROG2111', name: 'Programming Fundamentals' },
    { code: 'DBMS2112', name: 'Database Management Systems' },
    { code: 'NETS2113', name: 'Computer Networks' },
    { code: 'SOFT2114', name: 'Software Engineering' },
    { code: 'PROJ3115', name: 'Final Year Project' }
  ];

  const venueOptions = [
    "MM1","MM2","MM3","MM4","MM5",
    "Hall1","Hall2","Hall3","Hall4","Hall5",
    "Room1","Room2","Room3"
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'className') {
      const courseCode = value.split(' - ')[0];
      const course = courseOptions.find(c => c.code === courseCode);
      if (course) {
        setFormData(prev => ({ ...prev, courseCode: course.code, courseName: course.name }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const submitData = {
        ...formData,
        lecturerId: user.user_id,
        submittedAt: new Date().toISOString()
      };

      const response = await fetch(`${apiBaseUrl}/lecturer/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        setSubmitStatus({ type: 'success', message: 'Report submitted successfully!' });
      } else {
        setSubmitStatus({ type: 'error', message: 'Error submitting report. Please try again.' });
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus({ type: 'error', message: 'Network error. Please check your connection.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const data = [formData]; // single report export
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lecturer_Report");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Lecturer_Report_${new Date().toISOString()}.xlsx`);
  };

  return (
    <div className="container-fluid mt-3">
      <div className="row justify-content-center">
        <div className="col-lg-10 col-xl-8">
          <div className="card shadow-lg">
            <div className="card-header bg-primary text-white">
              <h3 className="mb-0">Lecturer Report Form</h3>
              <small>Week {formData.weekOfReporting || 'X'} - {formData.courseName || 'Course Name'}</small>
            </div>

            <div className="card-body">
              {submitStatus && (
                <div className={`alert ${submitStatus.type === 'success' ? 'alert-success' : 'alert-danger'} alert-dismissible`}>
                  <strong>{submitStatus.type === 'success' ? 'Success!' : 'Error!'}</strong> {submitStatus.message}
                  <button type="button" className="btn-close" onClick={() => setSubmitStatus(null)}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>

                {/* Basic Info */}
                <div className="row mb-3">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Faculty Name</label>
                    <input type="text" className="form-control" name="facultyName" value={formData.facultyName} readOnly />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Lecturer Name</label>
                    <input type="text" className="form-control" name="lecturerName" value={formData.lecturerName} onChange={handleChange} required />
                  </div>
                </div>

                {/* Class, Course, Week */}
                <div className="row mb-3">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Class Name</label>
                    <select className="form-select" name="className" value={formData.className} onChange={handleChange} required>
                      <option value="">Select class</option>
                      {classOptions.map((c,i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Course Code</label>
                    <input type="text" className="form-control" name="courseCode" value={formData.courseCode} readOnly />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Week of Reporting</label>
                    <select className="form-select" name="weekOfReporting" value={formData.weekOfReporting} onChange={handleChange} required>
                      <option value="">Select week</option>
                      {[...Array(16)].map((_,i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}
                    </select>
                  </div>
                </div>

                {/* Lecture Details */}
                <div className="row mb-3">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Date of Lecture</label>
                    <input type="date" className="form-control" name="dateOfLecture" value={formData.dateOfLecture} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Scheduled Time</label>
                    <input type="time" className="form-control" name="scheduledTime" value={formData.scheduledTime} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Venue</label>
                    <select className="form-select" name="venue" value={formData.venue} onChange={handleChange} required>
                      <option value="">Select venue</option>
                      {venueOptions.map((v,i) => <option key={i} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {/* Attendance */}
                <div className="row mb-3">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Students Present</label>
                    <input type="number" className="form-control" name="actualPresent" value={formData.actualPresent} onChange={handleChange} min="0" required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Total Registered Students</label>
                    <input type="number" className="form-control" name="totalRegistered" value={formData.totalRegistered} onChange={handleChange} min="0" required />
                  </div>
                </div>

                {formData.actualPresent && formData.totalRegistered && (
                  <div className="alert alert-info">
                    Attendance Rate: {Math.round((formData.actualPresent / formData.totalRegistered) * 100)}%
                    ({formData.actualPresent}/{formData.totalRegistered})
                  </div>
                )}

                {/* Academic Content */}
                <div className="mb-3">
                  <label className="form-label">Topic Taught</label>
                  <textarea className="form-control" name="topicTaught" rows="2" value={formData.topicTaught} onChange={handleChange} required></textarea>
                </div>
                <div className="mb-3">
                  <label className="form-label">Learning Outcomes</label>
                  <textarea className="form-control" name="learningOutcomes" rows="2" value={formData.learningOutcomes} onChange={handleChange} required></textarea>
                </div>
                <div className="mb-3">
                  <label className="form-label">Lecturer's Recommendations</label>
                  <textarea className="form-control" name="recommendations" rows="2" value={formData.recommendations} onChange={handleChange}></textarea>
                </div>

                {/* Buttons */}
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-success" onClick={exportToExcel}>
                    <i className="bi bi-download me-1"></i> Export to Excel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LecturerReportForm;
