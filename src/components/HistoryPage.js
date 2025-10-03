import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const HistoryPage = ({ apiBaseUrl = 'http://localhost:4000/api', user = {} }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWeek, setFilterWeek] = useState('');

  // Sample data for demonstration (you'll replace this with API call)
  useEffect(() => {
    // Simulating API call with dummy data
    const fetchReports = async () => {
      try {
        // Replace this with actual API call to your backend
        // const response = await fetch(`${apiBaseUrl}/reports?user_id=${user.user_id}`);
        // const data = await response.json();
        
        // For now, using dummy data
        const dummyData = [
          {
            report_id: 1,
            class_name: 'DIWA2110 - Web Development',
            course_name: 'Web Application Development',
            week_of_reporting: 6,
            date_of_lecture: '2024-09-15',
            actual_present: 28,
            total_registered: 32,
            topic_taught: 'React Components and Props',
            learning_outcomes: 'Students can create functional React components',
            created_at: '2024-09-15T10:30:00'
          },
          {
            report_id: 2,
            class_name: 'DIWA2110 - Web Development',
            course_name: 'Web Application Development',
            week_of_reporting: 5,
            date_of_lecture: '2024-09-08',
            actual_present: 30,
            total_registered: 32,
            topic_taught: 'JavaScript ES6 Features',
            learning_outcomes: 'Understanding arrow functions, destructuring, and modules',
            created_at: '2024-09-08T10:30:00'
          },
          {
            report_id: 3,
            class_name: 'DIWA2110 - Web Development',
            course_name: 'Web Application Development',
            week_of_reporting: 4,
            date_of_lecture: '2024-09-01',
            actual_present: 31,
            total_registered: 32,
            topic_taught: 'HTML5 and CSS3 Advanced Features',
            learning_outcomes: 'Students can create responsive layouts using CSS Grid and Flexbox',
            created_at: '2024-09-01T10:30:00'
          }
        ];
        
        setReports(dummyData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching reports:', error);
        setLoading(false);
      }
    };

    fetchReports();
  }, [apiBaseUrl, user.user_id]);

  // Filter reports based on search term and week
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.topic_taught.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.course_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesWeek = filterWeek === '' || 
      report.week_of_reporting.toString() === filterWeek;
    
    return matchesSearch && matchesWeek;
  });

  const handleExportSelected = async (reportIds) => {
    try {
      const response = await fetch(`${apiBaseUrl}/export/selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportIds })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected-reports.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting reports:', error);
      alert('Error exporting reports');
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header bg-info text-white">
          <h4 className="mb-0">Report History</h4>
        </div>
        <div className="card-body">
          {/* Search and Filter Controls */}
          <div className="row mb-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by topic, class, or course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select 
                className="form-select"
                value={filterWeek}
                onChange={(e) => setFilterWeek(e.target.value)}
              >
                <option value="">All Weeks</option>
                <option value="4">Week 4</option>
                <option value="5">Week 5</option>
                <option value="6">Week 6</option>
                <option value="7">Week 7</option>
                <option value="8">Week 8</option>
                <option value="9">Week 9</option>
              </select>
            </div>
            <div className="col-md-3">
              <button 
                className="btn btn-success w-100"
                onClick={() => handleExportSelected(filteredReports.map(r => r.report_id))}
              >
                Export All
              </button>
            </div>
          </div>

          {/* Reports Table */}
          {filteredReports.length === 0 ? (
            <div className="alert alert-info text-center">
              <h5>No reports found</h5>
              <p>Try adjusting your search criteria or submit a new report.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Week</th>
                    <th>Date</th>
                    <th>Class</th>
                    <th>Topic</th>
                    <th>Attendance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.report_id}>
                      <td>
                        <span className="badge bg-primary">
                          Week {report.week_of_reporting}
                        </span>
                      </td>
                      <td>{new Date(report.date_of_lecture).toLocaleDateString()}</td>
                      <td>
                        <strong>{report.class_name}</strong>
                        <br />
                        <small className="text-muted">{report.course_name}</small>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }}>
                          {report.topic_taught}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          (report.actual_present / report.total_registered) >= 0.8 
                            ? 'bg-success' 
                            : (report.actual_present / report.total_registered) >= 0.6 
                            ? 'bg-warning' 
                            : 'bg-danger'
                        }`}>
                          {report.actual_present}/{report.total_registered}
                        </span>
                        <br />
                        <small className="text-muted">
                          {Math.round((report.actual_present / report.total_registered) * 100)}%
                        </small>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button 
                            className="btn btn-outline-primary"
                            data-bs-toggle="modal"
                            data-bs-target={`#modal-${report.report_id}`}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button 
                            className="btn btn-outline-success"
                            onClick={() => handleExportSelected([report.report_id])}
                            title="Export This Report"
                          >
                            <i className="bi bi-download"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals for Report Details */}
      {filteredReports.map((report) => (
        <div 
          key={`modal-${report.report_id}`}
          className="modal fade" 
          id={`modal-${report.report_id}`} 
          tabIndex="-1"
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Report Details - Week {report.week_of_reporting}
                </h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Class:</strong> {report.class_name}</p>
                    <p><strong>Course:</strong> {report.course_name}</p>
                    <p><strong>Date:</strong> {new Date(report.date_of_lecture).toLocaleDateString()}</p>
                    <p><strong>Week:</strong> {report.week_of_reporting}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Present:</strong> {report.actual_present}</p>
                    <p><strong>Total Registered:</strong> {report.total_registered}</p>
                    <p><strong>Attendance Rate:</strong> {Math.round((report.actual_present / report.total_registered) * 100)}%</p>
                  </div>
                </div>
                <hr />
                <div className="mb-3">
                  <strong>Topic Taught:</strong>
                  <p>{report.topic_taught}</p>
                </div>
                <div className="mb-3">
                  <strong>Learning Outcomes:</strong>
                  <p>{report.learning_outcomes}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Close
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={() => handleExportSelected([report.report_id])}
                >
                  Export This Report
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryPage;