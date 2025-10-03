import React, { useState, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import SignatureCanvas from 'react-signature-canvas';

const MonitoringForm = ({ apiBaseUrl = 'http://localhost:5000/api', user = {} }) => {
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
    classRepName: '',
    classRepNumber: '',
    absenceReasons: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const lecturerSigRef = useRef({});
  const classRepSigRef = useRef({});

  const classOptions = [
    'DIWA2110 - Web Application Development',
    'PROG2111 - Programming Fundamentals', 
    'DBMS2112 - Database Management Systems',
    'NETS2113 - Computer Networks',
    'SOFT2114 - Software Engineering',
    'PROJ3115 - Final Year Project'
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
      const courseName = value.split(' - ')[1] || '';
      setFormData(prev => ({ ...prev, courseCode, courseName }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const submitData = {
        ...formData,
        lecturerSignature: lecturerSigRef.current.toDataURL(),
        classRepSignature: classRepSigRef.current.toDataURL(),
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
    const data = [formData];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monitoring_Report");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Monitoring_Report_${new Date().toISOString()}.xlsx`);
  };

  const clearSignature = (sigRef) => sigRef.current.clear();

  return (
    <div className="monitoring-form">
      <h3>Content Monitoring Form</h3>
      <form onSubmit={handleSubmit}>
        {submitStatus && (
          <div className={`alert ${submitStatus.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {submitStatus.message}
          </div>
        )}

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Faculty Name</label>
            <input type="text" className="form-control" name="facultyName" value={formData.facultyName} readOnly />
          </div>
          <div className="col-md-6">
            <label className="form-label">Lecturer Name</label>
            <input type="text" className="form-control" name="lecturerName" value={formData.lecturerName} onChange={handleChange} required />
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Class Name</label>
            <select className="form-select" name="className" value={formData.className} onChange={handleChange} required>
              <option value="">Select class</option>
              {classOptions.map((c,i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Course Code</label>
            <input type="text" className="form-control" name="courseCode" value={formData.courseCode} readOnly />
          </div>
          <div className="col-md-3">
            <label className="form-label">Week of Reporting</label>
            <select className="form-select" name="weekOfReporting" value={formData.weekOfReporting} onChange={handleChange} required>
              <option value="">Select week</option>
              {[...Array(16)].map((_,i) => <option key={i+1} value={i+1}>Week {i+1}</option>)}
            </select>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Date of Lecture</label>
            <input type="date" className="form-control" name="dateOfLecture" value={formData.dateOfLecture} onChange={handleChange} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Scheduled Time</label>
            <input type="time" className="form-control" name="scheduledTime" value={formData.scheduledTime} onChange={handleChange} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Venue</label>
            <select className="form-select" name="venue" value={formData.venue} onChange={handleChange} required>
              <option value="">Select venue</option>
              {venueOptions.map((v,i) => <option key={i} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Students Present</label>
            <input type="number" className="form-control" name="actualPresent" value={formData.actualPresent} onChange={handleChange} min="0" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Total Registered Students</label>
            <input type="number" className="form-control" name="totalRegistered" value={formData.totalRegistered} onChange={handleChange} min="0" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Lecturer's Signature</label>
            <SignatureCanvas
              ref={lecturerSigRef}
              penColor="black"
              canvasProps={{ className: "signature-canvas" }}
            />
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={() => clearSignature(lecturerSigRef)}>Clear</button>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Class Representative Name</label>
            <input type="text" className="form-control" name="classRepName" value={formData.classRepName} onChange={handleChange} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Student Number</label>
            <input type="text" className="form-control" name="classRepNumber" value={formData.classRepNumber} onChange={handleChange} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Class Rep Signature</label>
            <SignatureCanvas
              ref={classRepSigRef}
              penColor="black"
              canvasProps={{ className: "signature-canvas" }}
            />
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={() => clearSignature(classRepSigRef)}>Clear</button>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Reasons Provided by Students for Not Attending Class</label>
          <textarea className="form-control" name="absenceReasons" rows="3" value={formData.absenceReasons} onChange={handleChange}></textarea>
        </div>

        <div className="mb-3">
          <label className="form-label">Content Delivered</label>
          <textarea className="form-control" name="topicTaught" rows="2" value={formData.topicTaught} onChange={handleChange} required></textarea>
        </div>

        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-success" onClick={exportToExcel}>Export to Excel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Report'}</button>
        </div>

      </form>
    </div>
  );
};

export default MonitoringForm;
