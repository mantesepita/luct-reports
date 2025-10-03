const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');  // For Excel export (extra credit)
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));  // Allow all for dev; tighten in prod
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',  // XAMPP default
  database: 'luct_reports'  // Your DB name
});

db.connect(err => {
  if (err) {
    console.error('DB Connection Error:', err);
    return;
  }
  console.log('✅ MySQL Connected');
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied: No token' });
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const checkRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied: Insufficient role' });
  next();
};

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'LUCT Reporting System API',
    status: 'Running',
    version: '1.0.0'
  });
});

// Auth routes (Register/Login)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role, faculty_name } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (username, email, password, role, faculty_name) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role, faculty_name],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = results[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, role: user.role, username: user.username } });
  });
});

// Courses routes (PL adds/assigns modules)
app.post('/api/courses', authenticateToken, checkRole(['pl']), (req, res) => {
  const { course_name, course_code, assigned_to_lecturer_id, stream } = req.body;
  db.query(
    'INSERT INTO courses (course_name, course_code, assigned_to_lecturer_id, stream, created_by_pl_id) VALUES (?, ?, ?, ?, ?)',
    [course_name, course_code, assigned_to_lecturer_id, stream, req.user.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Course added and assigned', courseId: result.insertId });
    }
  );
});

app.get('/api/courses', authenticateToken, (req, res) => {
  const { assigned_to_me, stream } = req.query;
  let query = 'SELECT * FROM courses WHERE 1=1';
  let params = [];
  if (assigned_to_me) {
    query += ' AND assigned_to_lecturer_id = ?';
    params.push(req.user.id);
  }
  if (stream) {
    query += ' AND stream = ?';
    params.push(stream);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Classes routes (Linked to courses, auto-retrieve total students)
app.post('/api/classes', authenticateToken, checkRole(['lecturer', 'pl']), (req, res) => {
  const { class_name, course_id, venue, scheduled_time, total_registered_students } = req.body;
  db.query(
    'INSERT INTO classes (class_name, course_id, venue, scheduled_time, total_registered_students, lecturer_id) VALUES (?, ?, ?, ?, ?, ?)',
    [class_name, course_id, venue, scheduled_time, total_registered_students, req.user.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Class created', classId: result.insertId });
    }
  );
});

app.get('/api/classes', authenticateToken, (req, res) => {
  const { course_id } = req.query;
  let query = 'SELECT * FROM classes WHERE 1=1';
  let params = [];
  if (course_id) {
    query += ' AND course_id = ?';
    params.push(course_id);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    // Auto-include total_registered_students in response
    res.json(results);
  });
});

// Reports routes (Lecturer/Student submit, PRL/PL view/add feedback)
app.post('/api/reports', authenticateToken, checkRole(['student', 'lecturer']), (req, res) => {
  const {
    faculty_name, class_name, week_of_reporting, date_of_lecture, course_name, course_code,
    lecturer_name, actual_students_present, total_registered_students, venue, scheduled_time,
    topic_taught, learning_outcomes, recommendations
  } = req.body;
  const submitted_to_role = req.user.role === 'student' ? 'prl' : 'prl';  // Default to PRL
  db.query(
    'INSERT INTO reports (faculty_name, class_name, week_of_reporting, date_of_lecture, course_name, course_code, lecturer_name, actual_students_present, total_registered_students, venue, scheduled_time, topic_taught, learning_outcomes, recommendations, submitted_by_id, submitted_to_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [faculty_name, class_name, week_of_reporting, date_of_lecture, course_name, course_code, lecturer_name, actual_students_present, total_registered_students, venue, scheduled_time, topic_taught, learning_outcomes, recommendations, req.user.id, submitted_to_role],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Report submitted', reportId: result.insertId });
    }
  );
});

app.get('/api/reports', authenticateToken, checkRole(['prl', 'pl']), (req, res) => {
  const { search, status, submitted_to_role } = req.query;  // Search extra credit
  let query = 'SELECT * FROM reports WHERE 1=1';
  let params = [];
  if (search) {
    query += ' AND (topic_taught LIKE ? OR recommendations LIKE ? OR course_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (submitted_to_role) {
    query += ' AND submitted_to_role = ?';
    params.push(submitted_to_role);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/reports/:id/feedback', authenticateToken, checkRole(['prl', 'pl']), (req, res) => {
  const { feedback_text } = req.body;
  const reportId = req.params.id;
  db.query(
    'INSERT INTO feedback (report_id, feedback_text, provided_by_id) VALUES (?, ?, ?)',
    [reportId, feedback_text, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query('UPDATE reports SET status = "feedback_added" WHERE id = ?', [reportId]);
      res.json({ message: 'Feedback added successfully' });
    }
  );
});

// Ratings routes (All roles)
app.post('/api/ratings', authenticateToken, (req, res) => {
  const { rated_user_id, rating_score, comments, module_type } = req.body;
  db.query(
    'INSERT INTO ratings (rater_id, rated_user_id, rating_score, comments, module_type) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, rated_user_id, rating_score, comments, module_type],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Rating submitted', ratingId: result.insertId });
    }
  );
});

app.get('/api/ratings', authenticateToken, (req, res) => {
  const { rated_user_id } = req.query;
  let query = 'SELECT * FROM ratings WHERE 1=1';
  let params = [];
  if (rated_user_id) {
    query += ' AND rated_user_id = ?';
    params.push(rated_user_id);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Monitoring routes (PRL/PL monitor, Lecturer monitors students)
app.post('/api/monitoring', authenticateToken, checkRole(['lecturer', 'prl', 'pl']), (req, res) => {
  const { user_id, type, details, report_id } = req.body;
  db.query(
    'INSERT INTO monitoring (user_id, monitored_by_id, type, details, report_id) VALUES (?, ?, ?, ?, ?)',
    [user_id, req.user.id, type, details, report_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Monitoring log added', logId: result.insertId });
    }
  );
});

app.get('/api/monitoring', authenticateToken, (req, res) => {
  const { user_id } = req.query;
  let query = 'SELECT * FROM monitoring WHERE 1=1';
  let params = [];
  if (user_id) {
    query += ' AND user_id = ?';
    params.push(user_id);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Summary Reports (PRL sends to PL)
app.post('/api/summary-reports', authenticateToken, checkRole(['prl']), (req, res) => {
  const { pl_id, period_week, summary_text } = req.body;
  db.query(
    'INSERT INTO summary_reports (prl_id, pl_id, period_week, summary_text) VALUES (?, ?, ?, ?)',
    [req.user.id, pl_id, period_week, summary_text],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Summary sent to PL', summaryId: result.insertId });
    }
  );
});

app.get('/api/summary-reports', authenticateToken, checkRole(['pl']), (req, res) => {
  db.query('SELECT * FROM summary_reports WHERE pl_id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/summary-reports/:id/feedback', authenticateToken, checkRole(['pl']), (req, res) => {
  const { feedback_from_pl } = req.body;
  const summaryId = req.params.id;
  db.query('UPDATE summary_reports SET feedback_from_pl = ?, status = "feedback_received" WHERE id = ?', [feedback_from_pl, summaryId]);
  res.json({ message: 'Feedback added to summary' });
});

// Extra Credit: Downloadable Excel Reports
app.get('/api/reports/export', authenticateToken, checkRole(['prl', 'pl']), (req, res) => {
  db.query('SELECT * FROM reports', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const ws = xlsx.utils.json_to_sheet(results);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Reports');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=luct-reports.xlsx');
    res.send(buffer);
  });
});

// Role-based route mounts (uncommented and functional; create ./routes/student.js etc. if needed for modularity)
app.use('/api/student', authenticateToken, checkRole(['student']), (req, res) => {
  res.json({ message: 'Student dashboard endpoint' });  // Extend with specific logic
});
app.use('/api/lecturer', authenticateToken, checkRole(['lecturer']), (req, res) => {
  res.json({ message: 'Lecturer dashboard endpoint' });
});
app.use('/api/prl', authenticateToken, checkRole(['prl']), (req, res) => {
  res.json({ message: 'PRL dashboard endpoint' });
});
app.use('/api/pl', authenticateToken, checkRole(['pl']), (req, res) => {
  res.json({ message: 'PL dashboard endpoint' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});